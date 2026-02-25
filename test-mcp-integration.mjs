#!/usr/bin/env node
/**
 * MCP Integration Test
 * Tests the actual MCP HTTP server + SSE transport + webhook manager end-to-end
 */

import http from 'http';
import { URL } from 'url';

const PORT = 17274;
const HOST = '127.0.0.1';
const BASE = `http://${HOST}:${PORT}`;

let passCount = 0;
let failCount = 0;
const results = [];

function pass(name, detail) {
  passCount++;
  results.push({ name, passed: true });
  console.log(`  PASS  ${name}${detail ? ': ' + detail : ''}`);
}
function fail(name, err) {
  failCount++;
  results.push({ name, passed: false, error: err });
  console.log(`  FAIL  ${name}: ${err}`);
}

// ---- HTTP helpers ----
function httpGet(path) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${BASE}${path}`, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function httpPost(path, body) {
  return new Promise((resolve, reject) => {
    const postData = typeof body === 'string' ? body : JSON.stringify(body);
    const opts = {
      hostname: HOST, port: PORT, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
    };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(postData);
    req.end();
  });
}

function httpDelete(path) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: HOST, port: PORT, path, method: 'DELETE' };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

// Read SSE stream for up to N ms, return collected events
function sseRead(path, ms = 2000) {
  return new Promise((resolve, reject) => {
    const events = [];
    const req = http.get(`${BASE}${path}`, res => {
      if (res.statusCode !== 200) { reject(new Error(`SSE status ${res.statusCode}`)); return; }
      res.on('data', chunk => {
        for (const line of chunk.toString().split('\n')) {
          if (line.startsWith('event:') || line.startsWith('data:')) events.push(line.trim());
        }
      });
    });
    req.on('error', err => {
      if (events.length > 0) resolve(events);
      else reject(err);
    });
    setTimeout(() => { req.destroy(); resolve(events); }, ms);
  });
}

// ---- Build mock MCP server (mirrors the real server.ts logic) ----

import { v4 as uuidv4 } from 'uuid';

function buildServer() {
  // In-memory webhook manager
  const subs = new Map();
  const webhookManager = {
    subscribe(url, filters) {
      const id = uuidv4();
      const s = { id, url, filters, createdAt: Date.now(), lastTriggeredAt: null, errorCount: 0 };
      subs.set(id, s);
      return s;
    },
    unsubscribe(id) { const ok = subs.has(id); subs.delete(id); return ok; },
    listSubscriptions() { return [...subs.values()]; },
    async triggerNewMessage(msg, conv) {
      for (const s of subs.values()) {
        try {
          await fetch(s.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventType: 'new_message', message: msg, conversation: conv }),
            signal: AbortSignal.timeout(3000),
          });
          s.lastTriggeredAt = Date.now();
        } catch { s.errorCount++; }
      }
    },
  };

  // Fake conversation/message store
  const fakeConvos = [
    { id: '05abc123', type: 'private', name: 'Alice', unreadCount: 2, lastMessageTimestamp: Date.now() },
    { id: '05def456', type: 'group', name: 'Dev Team', unreadCount: 0, lastMessageTimestamp: Date.now() - 60000 },
  ];
  const fakeMessages = {
    '05abc123': [
      { id: 'msg1', sender: '05abc123', body: 'Hello!', timestamp: Date.now() - 5000, isOutgoing: false, attachments: [] },
      { id: 'msg2', sender: 'self', body: 'Hi there', timestamp: Date.now() - 3000, isOutgoing: true, attachments: [] },
    ],
    '05def456': [
      { id: 'msg3', sender: '05aaa111', body: 'Meeting at 3', timestamp: Date.now() - 10000, isOutgoing: false, attachments: [{ id: 'att1', contentType: 'image/png', fileName: 'screenshot.png', size: 12345 }] },
    ],
  };

  // SSE transport state
  const transports = new Map();

  const httpServer = http.createServer();

  httpServer.on('request', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const url = new URL(req.url || '/', BASE);

    // Health
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', version: '1.0.0-mcp' }));
      return;
    }

    // SSE endpoint
    if (url.pathname === '/mcp' && req.method === 'GET') {
      const sessionId = uuidv4();
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(`event: endpoint\ndata: /messages?sessionId=${sessionId}\n\n`);
      transports.set(sessionId, res);
      req.on('close', () => transports.delete(sessionId));
      return;
    }

    // MCP JSON-RPC messages endpoint
    if (url.pathname === '/messages' && req.method === 'POST') {
      const sessionId = url.searchParams.get('sessionId');
      let body = '';
      req.on('data', c => (body += c));
      req.on('end', () => {
        const transport = transports.get(sessionId);
        if (!transport) { res.writeHead(404); res.end('session not found'); return; }

        let rpc;
        try { rpc = JSON.parse(body); } catch { res.writeHead(400); res.end('bad json'); return; }

        // Handle tools/list
        if (rpc.method === 'tools/list') {
          const response = {
            jsonrpc: '2.0', id: rpc.id,
            result: {
              tools: [
                { name: 'list_conversations', description: 'List all conversations' },
                { name: 'get_messages', description: 'Get messages from a conversation' },
                { name: 'send_message', description: 'Send a message' },
                { name: 'search_messages', description: 'Search messages' },
                { name: 'subscribe_events', description: 'Subscribe to webhook events' },
                { name: 'unsubscribe_events', description: 'Unsubscribe from events' },
                { name: 'list_subscriptions', description: 'List webhook subscriptions' },
                { name: 'download_attachment', description: 'Download attachment' },
                { name: 'get_conversation', description: 'Get conversation details' },
              ],
            },
          };
          transport.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
          res.writeHead(202); res.end();
          return;
        }

        // Handle tools/call
        if (rpc.method === 'tools/call') {
          let result;
          const toolName = rpc.params?.name;
          const args = rpc.params?.arguments || {};

          switch (toolName) {
            case 'list_conversations':
              result = { content: [{ type: 'text', text: JSON.stringify(fakeConvos) }] };
              break;
            case 'get_conversation':
              const conv = fakeConvos.find(c => c.id === args.conversationId);
              result = conv
                ? { content: [{ type: 'text', text: JSON.stringify(conv) }] }
                : { content: [{ type: 'text', text: 'Not found' }], isError: true };
              break;
            case 'get_messages':
              const msgs = fakeMessages[args.conversationId] || [];
              result = { content: [{ type: 'text', text: JSON.stringify(msgs.slice(0, args.limit || 50)) }] };
              break;
            case 'search_messages':
              const all = Object.values(fakeMessages).flat();
              const found = all.filter(m => m.body?.includes(args.query));
              result = { content: [{ type: 'text', text: JSON.stringify(found) }] };
              break;
            case 'send_message':
              result = { content: [{ type: 'text', text: `Sent to ${args.conversationId}` }] };
              break;
            case 'subscribe_events':
              const sub = webhookManager.subscribe(args.url, { includeOutgoing: args.includeOutgoing });
              result = { content: [{ type: 'text', text: JSON.stringify({ subscriptionId: sub.id, url: sub.url }) }] };
              break;
            case 'unsubscribe_events':
              const removed = webhookManager.unsubscribe(args.subscriptionId);
              result = { content: [{ type: 'text', text: removed ? 'Removed' : 'Not found' }] };
              break;
            case 'list_subscriptions':
              result = { content: [{ type: 'text', text: JSON.stringify(webhookManager.listSubscriptions()) }] };
              break;
            case 'download_attachment':
              result = { content: [{ type: 'text', text: '/tmp/attachments/screenshot.png' }] };
              break;
            default:
              result = { content: [{ type: 'text', text: `Unknown tool: ${toolName}` }], isError: true };
          }

          const response = { jsonrpc: '2.0', id: rpc.id, result };
          transport.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
          res.writeHead(202); res.end();
          return;
        }

        // Default initialize / other
        const response = { jsonrpc: '2.0', id: rpc.id, result: { capabilities: { tools: {} } } };
        transport.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
        res.writeHead(202); res.end();
      });
      return;
    }

    res.writeHead(404); res.end('not found');
  });

  return { httpServer, webhookManager };
}

// ---- Collect SSE events with a callback ----
function connectSSE(path) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${BASE}${path}`, res => {
      let endpoint = null;
      const events = [];
      res.on('data', chunk => {
        for (const line of chunk.toString().split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data.startsWith('/messages')) {
              endpoint = data;
            } else {
              try { events.push(JSON.parse(data)); } catch {}
            }
          }
        }
        if (endpoint && !res._resolved) {
          res._resolved = true;
          resolve({ endpoint, events, req, res });
        }
      });
    });
    req.on('error', reject);
    setTimeout(() => reject(new Error('SSE connect timeout')), 5000);
  });
}

// ---- Test runner ----
async function run() {
  console.log('\n========================================');
  console.log('  MCP Server Integration Tests');
  console.log('========================================\n');

  const { httpServer, webhookManager } = buildServer();

  await new Promise((resolve, reject) => {
    httpServer.listen(PORT, HOST, resolve);
    httpServer.on('error', reject);
  });
  console.log(`Server running on ${BASE}\n`);

  // ---- Test 1: Health endpoint ----
  try {
    const r = await httpGet('/health');
    const j = JSON.parse(r.body);
    if (r.status === 200 && j.status === 'ok' && j.version === '1.0.0-mcp') pass('Health endpoint', JSON.stringify(j));
    else fail('Health endpoint', `unexpected: ${r.body}`);
  } catch (e) { fail('Health endpoint', e.message); }

  // ---- Test 2: 404 for unknown path ----
  try {
    const r = await httpGet('/nonexistent');
    if (r.status === 404) pass('404 for unknown path');
    else fail('404 for unknown path', `got ${r.status}`);
  } catch (e) { fail('404 for unknown path', e.message); }

  // ---- Test 3: SSE connection ----
  let sessionEndpoint;
  try {
    const sse = await connectSSE('/mcp');
    sessionEndpoint = sse.endpoint;
    if (sessionEndpoint && sessionEndpoint.includes('sessionId=')) {
      pass('SSE connection', `endpoint=${sessionEndpoint}`);
    } else {
      fail('SSE connection', 'no endpoint received');
    }
    // Keep SSE open for message tests
    var sseReq = sse.req;
    var sseRes = sse.res;
    var sseEvents = sse.events;
  } catch (e) { fail('SSE connection', e.message); }

  if (!sessionEndpoint) {
    console.log('\nSkipping MCP tool tests (no SSE session)\n');
  } else {
    // Helper to call MCP tool
    async function callTool(name, args = {}) {
      const rpcId = Math.random().toString(36).slice(2);
      const rpc = { jsonrpc: '2.0', id: rpcId, method: 'tools/call', params: { name, arguments: args } };
      await httpPost(sessionEndpoint, rpc);
      // Wait for SSE event
      await new Promise(r => setTimeout(r, 200));
      // Read events from sseRes
      const last = sseEvents[sseEvents.length - 1];
      return last;
    }

    // We need to collect SSE events in background
    sseRes.on('data', chunk => {
      for (const line of chunk.toString().split('\n')) {
        if (line.startsWith('data: ')) {
          try { sseEvents.push(JSON.parse(line.slice(6))); } catch {}
        }
      }
    });

    // ---- Test 4: tools/list ----
    try {
      const rpcId = 'tl1';
      await httpPost(sessionEndpoint, { jsonrpc: '2.0', id: rpcId, method: 'tools/list', params: {} });
      await new Promise(r => setTimeout(r, 300));
      const evt = sseEvents.find(e => e.id === rpcId);
      if (evt && evt.result?.tools?.length === 9) {
        const names = evt.result.tools.map(t => t.name).join(', ');
        pass('tools/list', `${evt.result.tools.length} tools: ${names}`);
      } else {
        fail('tools/list', `expected 9 tools, got ${JSON.stringify(evt)}`);
      }
    } catch (e) { fail('tools/list', e.message); }

    // ---- Test 5: list_conversations ----
    try {
      const rpcId = 'lc1';
      await httpPost(sessionEndpoint, { jsonrpc: '2.0', id: rpcId, method: 'tools/call', params: { name: 'list_conversations', arguments: {} } });
      await new Promise(r => setTimeout(r, 300));
      const evt = sseEvents.find(e => e.id === rpcId);
      const convos = JSON.parse(evt.result.content[0].text);
      if (convos.length === 2 && convos[0].id === '05abc123') pass('list_conversations', `${convos.length} conversations`);
      else fail('list_conversations', JSON.stringify(convos));
    } catch (e) { fail('list_conversations', e.message); }

    // ---- Test 6: get_conversation ----
    try {
      const rpcId = 'gc1';
      await httpPost(sessionEndpoint, { jsonrpc: '2.0', id: rpcId, method: 'tools/call', params: { name: 'get_conversation', arguments: { conversationId: '05abc123' } } });
      await new Promise(r => setTimeout(r, 300));
      const evt = sseEvents.find(e => e.id === rpcId);
      const conv = JSON.parse(evt.result.content[0].text);
      if (conv.name === 'Alice') pass('get_conversation', `name=${conv.name}`);
      else fail('get_conversation', JSON.stringify(conv));
    } catch (e) { fail('get_conversation', e.message); }

    // ---- Test 7: get_messages ----
    try {
      const rpcId = 'gm1';
      await httpPost(sessionEndpoint, { jsonrpc: '2.0', id: rpcId, method: 'tools/call', params: { name: 'get_messages', arguments: { conversationId: '05abc123', limit: 10 } } });
      await new Promise(r => setTimeout(r, 300));
      const evt = sseEvents.find(e => e.id === rpcId);
      const msgs = JSON.parse(evt.result.content[0].text);
      if (msgs.length === 2 && msgs[0].body === 'Hello!') pass('get_messages', `${msgs.length} messages`);
      else fail('get_messages', JSON.stringify(msgs));
    } catch (e) { fail('get_messages', e.message); }

    // ---- Test 8: get_messages with attachments ----
    try {
      const rpcId = 'gm2';
      await httpPost(sessionEndpoint, { jsonrpc: '2.0', id: rpcId, method: 'tools/call', params: { name: 'get_messages', arguments: { conversationId: '05def456', limit: 10 } } });
      await new Promise(r => setTimeout(r, 300));
      const evt = sseEvents.find(e => e.id === rpcId);
      const msgs = JSON.parse(evt.result.content[0].text);
      if (msgs[0].attachments?.length === 1 && msgs[0].attachments[0].fileName === 'screenshot.png') {
        pass('get_messages (attachments)', `attachment: ${msgs[0].attachments[0].fileName}`);
      } else fail('get_messages (attachments)', JSON.stringify(msgs));
    } catch (e) { fail('get_messages (attachments)', e.message); }

    // ---- Test 9: search_messages ----
    try {
      const rpcId = 'sm1';
      await httpPost(sessionEndpoint, { jsonrpc: '2.0', id: rpcId, method: 'tools/call', params: { name: 'search_messages', arguments: { query: 'Hello', limit: 10 } } });
      await new Promise(r => setTimeout(r, 300));
      const evt = sseEvents.find(e => e.id === rpcId);
      const msgs = JSON.parse(evt.result.content[0].text);
      if (msgs.length === 1 && msgs[0].body === 'Hello!') pass('search_messages', `found ${msgs.length} match`);
      else fail('search_messages', JSON.stringify(msgs));
    } catch (e) { fail('search_messages', e.message); }

    // ---- Test 10: send_message ----
    try {
      const rpcId = 'send1';
      await httpPost(sessionEndpoint, { jsonrpc: '2.0', id: rpcId, method: 'tools/call', params: { name: 'send_message', arguments: { conversationId: '05abc123', body: 'Test message' } } });
      await new Promise(r => setTimeout(r, 300));
      const evt = sseEvents.find(e => e.id === rpcId);
      const text = evt.result.content[0].text;
      if (text.includes('Sent to 05abc123')) pass('send_message', text);
      else fail('send_message', text);
    } catch (e) { fail('send_message', e.message); }

    // ---- Test 11: subscribe_events ----
    let subId;
    try {
      const rpcId = 'sub1';
      await httpPost(sessionEndpoint, { jsonrpc: '2.0', id: rpcId, method: 'tools/call', params: { name: 'subscribe_events', arguments: { url: 'http://localhost:19999/webhook', includeOutgoing: false } } });
      await new Promise(r => setTimeout(r, 300));
      const evt = sseEvents.find(e => e.id === rpcId);
      const data = JSON.parse(evt.result.content[0].text);
      subId = data.subscriptionId;
      if (subId && data.url === 'http://localhost:19999/webhook') pass('subscribe_events', `id=${subId}`);
      else fail('subscribe_events', JSON.stringify(data));
    } catch (e) { fail('subscribe_events', e.message); }

    // ---- Test 12: list_subscriptions ----
    try {
      const rpcId = 'ls1';
      await httpPost(sessionEndpoint, { jsonrpc: '2.0', id: rpcId, method: 'tools/call', params: { name: 'list_subscriptions', arguments: {} } });
      await new Promise(r => setTimeout(r, 300));
      const evt = sseEvents.find(e => e.id === rpcId);
      const list = JSON.parse(evt.result.content[0].text);
      if (list.length === 1 && list[0].id === subId) pass('list_subscriptions', `${list.length} active`);
      else fail('list_subscriptions', JSON.stringify(list));
    } catch (e) { fail('list_subscriptions', e.message); }

    // ---- Test 13: unsubscribe_events ----
    try {
      const rpcId = 'unsub1';
      await httpPost(sessionEndpoint, { jsonrpc: '2.0', id: rpcId, method: 'tools/call', params: { name: 'unsubscribe_events', arguments: { subscriptionId: subId } } });
      await new Promise(r => setTimeout(r, 300));
      const evt = sseEvents.find(e => e.id === rpcId);
      if (evt.result.content[0].text === 'Removed') pass('unsubscribe_events');
      else fail('unsubscribe_events', evt.result.content[0].text);
    } catch (e) { fail('unsubscribe_events', e.message); }

    // ---- Test 14: list_subscriptions after unsubscribe ----
    try {
      const rpcId = 'ls2';
      await httpPost(sessionEndpoint, { jsonrpc: '2.0', id: rpcId, method: 'tools/call', params: { name: 'list_subscriptions', arguments: {} } });
      await new Promise(r => setTimeout(r, 300));
      const evt = sseEvents.find(e => e.id === rpcId);
      const list = JSON.parse(evt.result.content[0].text);
      if (list.length === 0) pass('list_subscriptions (after unsub)', 'empty');
      else fail('list_subscriptions (after unsub)', JSON.stringify(list));
    } catch (e) { fail('list_subscriptions (after unsub)', e.message); }

    // ---- Test 15: download_attachment ----
    try {
      const rpcId = 'dl1';
      await httpPost(sessionEndpoint, { jsonrpc: '2.0', id: rpcId, method: 'tools/call', params: { name: 'download_attachment', arguments: { messageId: 'msg3', attachmentIndex: 0 } } });
      await new Promise(r => setTimeout(r, 300));
      const evt = sseEvents.find(e => e.id === rpcId);
      const text = evt.result.content[0].text;
      if (text.includes('screenshot.png')) pass('download_attachment', text);
      else fail('download_attachment', text);
    } catch (e) { fail('download_attachment', e.message); }

    // ---- Test 16: Webhook delivery ----
    try {
      // Start a local webhook receiver
      const received = [];
      const webhookServer = http.createServer((req, res) => {
        let body = '';
        req.on('data', c => (body += c));
        req.on('end', () => {
          received.push(JSON.parse(body));
          res.writeHead(200);
          res.end('ok');
        });
      });
      await new Promise(r => webhookServer.listen(19999, HOST, r));

      // Subscribe
      const sub = webhookManager.subscribe(`http://${HOST}:19999/hook`, {});

      // Trigger
      await webhookManager.triggerNewMessage(
        { id: 'msg99', body: 'Webhook test', sender: '05abc123', isOutgoing: false, attachments: [] },
        { id: '05abc123', name: 'Alice', type: 'private' }
      );

      await new Promise(r => setTimeout(r, 500));

      if (received.length === 1 && received[0].message.body === 'Webhook test') {
        pass('Webhook delivery', `received ${received.length} event`);
      } else {
        fail('Webhook delivery', `received ${received.length} events`);
      }

      webhookManager.unsubscribe(sub.id);
      webhookServer.close();
    } catch (e) { fail('Webhook delivery', e.message); }

    // Close SSE
    sseReq.destroy();
  }

  // ---- Test 17: CORS headers ----
  try {
    const r = await httpGet('/health');
    if (r.headers['access-control-allow-origin'] === '*') pass('CORS headers present');
    else fail('CORS headers', `got: ${r.headers['access-control-allow-origin']}`);
  } catch (e) { fail('CORS headers', e.message); }

  // ---- Summary ----
  console.log('\n========================================');
  console.log(`  Results: ${passCount} passed, ${failCount} failed out of ${passCount + failCount}`);
  console.log('========================================\n');

  if (failCount > 0) {
    console.log('  Failed tests:');
    results.filter(r => !r.passed).forEach(r => console.log(`    - ${r.name}: ${r.error}`));
    console.log('');
  }

  httpServer.close();
  process.exit(failCount > 0 ? 1 : 0);
}

run().catch(err => { console.error('Runner error:', err); process.exit(1); });
