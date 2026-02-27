/**
 * MCP Server Test Script
 * Tests the MCP server components without full Electron
 */

import http from 'http';
import { URL } from 'url';
import { v4 as uuidv4 } from 'uuid';

// Mock components for testing

class MockWebhookManager {
  constructor() {
    this.subscriptions = new Map();
  }

  subscribe(url, filters) {
    const id = uuidv4();
    const subscription = {
      id,
      url,
      filters,
      createdAt: Date.now(),
      lastTriggeredAt: null,
      errorCount: 0,
    };
    this.subscriptions.set(id, subscription);
    return subscription;
  }

  unsubscribe(subscriptionId) {
    const existed = this.subscriptions.has(subscriptionId);
    this.subscriptions.delete(subscriptionId);
    return existed;
  }

  listSubscriptions() {
    return Array.from(this.subscriptions.values());
  }
}

// Test HTTP server (simulates MCP server without Electron dependencies)
function createTestMcpServer(port) {
  const webhookManager = new MockWebhookManager();
  const server = http.createServer();

  server.on('request', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);

    // Health endpoint
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', version: '1.0.0-mcp' }));
      return;
    }

    // MCP SSE endpoint
    if (url.pathname === '/mcp' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      // Send initial connection event
      const sessionId = uuidv4();
      res.write(`event: endpoint\ndata: /messages?sessionId=${sessionId}\n\n`);
      res.write(`event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', method: 'connected', params: { sessionId } })}\n\n`);

      // Keep connection open for a bit then close
      setTimeout(() => {
        res.write(`event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', method: 'ping' })}\n\n`);
      }, 100);

      req.on('close', () => {
        console.log(`[TEST] SSE connection closed for session ${sessionId}`);
      });

      return;
    }

    // Webhook test endpoints
    if (url.pathname === '/api/subscribe' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { url: webhookUrl, filters } = JSON.parse(body);
          const subscription = webhookManager.subscribe(webhookUrl, filters);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(subscription));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(error) }));
        }
      });
      return;
    }

    if (url.pathname === '/api/subscriptions' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(webhookManager.listSubscriptions()));
      return;
    }

    if (url.pathname.startsWith('/api/unsubscribe/') && req.method === 'DELETE') {
      const subId = url.pathname.split('/').pop();
      const removed = webhookManager.unsubscribe(subId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ removed }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  return { server, webhookManager };
}

// Test functions
async function testHealthEndpoint(port) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/health`, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.status === 'ok' && json.version === '1.0.0-mcp') {
            resolve({ success: true, data: json });
          } else {
            reject(new Error(`Unexpected response: ${data}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function testSseEndpoint(port) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      req.destroy();
      reject(new Error('SSE timeout'));
    }, 3000);

    const req = http.get(`http://127.0.0.1:${port}/mcp`, (res) => {
      if (res.statusCode !== 200) {
        clearTimeout(timeout);
        reject(new Error(`Unexpected status: ${res.statusCode}`));
        return;
      }

      let receivedEvents = [];
      res.on('data', chunk => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('event:') || line.startsWith('data:')) {
            receivedEvents.push(line);
          }
        }
        // Success - received SSE events
        if (receivedEvents.length >= 2) {
          clearTimeout(timeout);
          req.destroy();
          resolve({ success: true, events: receivedEvents });
        }
      });
    });

    req.on('error', (err) => {
      clearTimeout(timeout);
      // Connection closed is expected after we got events
      if (receivedEvents && receivedEvents.length >= 2) {
        resolve({ success: true, events: receivedEvents });
      } else {
        reject(err);
      }
    });
  });
}

async function testWebhookSubscription(port) {
  // Subscribe
  const subscribeRes = await fetch(`http://127.0.0.1:${port}/api/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'http://localhost:9999/webhook', filters: { includeOutgoing: false } }),
  });
  const subscription = await subscribeRes.json();

  if (!subscription.id || !subscription.url) {
    throw new Error('Invalid subscription response');
  }

  // List subscriptions
  const listRes = await fetch(`http://127.0.0.1:${port}/api/subscriptions`);
  const list = await listRes.json();

  if (!Array.isArray(list) || list.length !== 1) {
    throw new Error('List should have 1 subscription');
  }

  // Unsubscribe
  const unsubRes = await fetch(`http://127.0.0.1:${port}/api/unsubscribe/${subscription.id}`, {
    method: 'DELETE',
  });
  const unsubResult = await unsubRes.json();

  if (!unsubResult.removed) {
    throw new Error('Unsubscribe failed');
  }

  // Verify removed
  const listRes2 = await fetch(`http://127.0.0.1:${port}/api/subscriptions`);
  const list2 = await listRes2.json();

  if (list2.length !== 0) {
    throw new Error('Subscription should be removed');
  }

  return { success: true, subscription };
}

// Main test runner
async function runTests() {
  const port = 16274;
  const { server } = createTestMcpServer(port);

  console.log('\n=== MCP Server Component Tests ===\n');

  await new Promise((resolve, reject) => {
    server.listen(port, '127.0.0.1', resolve);
    server.on('error', reject);
  });

  console.log(`[TEST] Server started on port ${port}\n`);

  const results = [];

  // Test 1: Health endpoint
  try {
    console.log('Test 1: Health endpoint...');
    const result = await testHealthEndpoint(port);
    console.log('  ✓ Health endpoint works:', result.data);
    results.push({ test: 'health', passed: true });
  } catch (error) {
    console.log('  ✗ Health endpoint failed:', error.message);
    results.push({ test: 'health', passed: false, error: error.message });
  }

  // Test 2: SSE endpoint
  try {
    console.log('Test 2: SSE MCP endpoint...');
    const result = await testSseEndpoint(port);
    console.log('  ✓ SSE endpoint works, received events:', result.events.length);
    results.push({ test: 'sse', passed: true });
  } catch (error) {
    console.log('  ✗ SSE endpoint failed:', error.message);
    results.push({ test: 'sse', passed: false, error: error.message });
  }

  // Test 3: Webhook subscription flow
  try {
    console.log('Test 3: Webhook subscription flow...');
    const result = await testWebhookSubscription(port);
    console.log('  ✓ Webhook flow works, subscription ID:', result.subscription.id);
    results.push({ test: 'webhook', passed: true });
  } catch (error) {
    console.log('  ✗ Webhook flow failed:', error.message);
    results.push({ test: 'webhook', passed: false, error: error.message });
  }

  // Summary
  console.log('\n=== Test Summary ===\n');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`Passed: ${passed}/${results.length}`);
  console.log(`Failed: ${failed}/${results.length}`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.test}: ${r.error}`);
    });
  }

  // Cleanup
  server.close();

  console.log('\n=== Tests Complete ===\n');

  // Exit with error code if any tests failed
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
