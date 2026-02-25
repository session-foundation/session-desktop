/**
 * MCP Server for Session Desktop
 * Provides AI agent access to Session conversations and messaging
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import http from 'http';
import { URL } from 'url';
import * as z from 'zod';
import path from 'path';
import { app } from 'electron';

import { webhookManager } from './webhookManager';
import { sqlNode } from '../node/sql';
import { getAttachmentsPath } from '../shared/attachments/shared_attachments';

// Get attachments path using app.getPath
function getAttachmentBasePath(): string {
  return getAttachmentsPath(app.getPath('userData'));
}
import type {
  McpConversation,
  McpMessage,
  McpAttachment,
  McpServerConfig,
  SendMessageRequest,
} from './types';
import { MCP_IPC_CHANNELS } from './types';

// Pending IPC requests
const pendingRequests = new Map<
  string,
  { resolve: (value: unknown) => void; reject: (error: Error) => void }
>();

let requestIdCounter = 0;

// Store transports by session ID
const transports: Map<string, SSEServerTransport> = new Map();

/**
 * Convert raw conversation from DB to MCP format
 */
function formatConversation(raw: any): McpConversation {
  return {
    id: raw.id,
    type: raw.type === 'group' ? 'group' : raw.isPublic ? 'community' : 'private',
    name: raw.displayNameInProfile || raw.name || null,
    members: raw.members ? (typeof raw.members === 'string' ? JSON.parse(raw.members) : raw.members) : undefined,
    unreadCount: raw.unreadCount || 0,
    lastMessageTimestamp: raw.lastMessageTimestamp || null,
    isBlocked: Boolean(raw.isBlocked),
    isApproved: Boolean(raw.isApproved),
  };
}

/**
 * Convert raw message from DB to MCP format
 */
function formatMessage(raw: any, conversationId: string): McpMessage {
  const attachments: McpAttachment[] = [];

  if (raw.attachments) {
    const parsedAttachments = typeof raw.attachments === 'string'
      ? JSON.parse(raw.attachments)
      : raw.attachments;

    for (const att of parsedAttachments || []) {
      attachments.push({
        id: att.id || att.digest || `${raw.id}-${attachments.length}`,
        contentType: att.contentType || 'application/octet-stream',
        fileName: att.fileName || null,
        size: att.size || 0,
        localPath: att.path ? path.join(getAttachmentBasePath(), att.path) : null,
        thumbnail: att.thumbnail
          ? {
              width: att.thumbnail.width,
              height: att.thumbnail.height,
              contentType: att.thumbnail.contentType,
            }
          : undefined,
      });
    }
  }

  let quote;
  if (raw.quote) {
    const parsedQuote = typeof raw.quote === 'string' ? JSON.parse(raw.quote) : raw.quote;
    if (parsedQuote) {
      quote = {
        id: parsedQuote.id || '',
        author: parsedQuote.author || '',
        text: parsedQuote.text || null,
      };
    }
  }

  return {
    id: raw.id,
    conversationId,
    sender: raw.source || raw.sender || '',
    senderName: raw.senderName || null,
    timestamp: raw.sent_at || raw.timestamp || 0,
    body: raw.body || null,
    attachments,
    isOutgoing: raw.type === 'outgoing' || raw.direction === 'outgoing',
    isRead: Boolean(raw.read),
    expiresAt: raw.expiresAt || null,
    quote,
  };
}

/**
 * Create the MCP server with all tools
 */
function createMcpServer(ipcMain?: Electron.IpcMain): McpServer {
  const server = new McpServer(
    {
      name: 'session-desktop-mcp',
      version: '1.0.0-mcp',
    },
    { capabilities: { logging: {} } }
  );

  // ============================================
  // TOOL: list_conversations
  // ============================================
  server.registerTool(
    'list_conversations',
    {
      description: 'List all Session conversations (DMs, groups, communities)',
      inputSchema: {},
    },
    async () => {
      try {
        const rawConversations = sqlNode.getAllConversations();
        const conversations = rawConversations.map(formatConversation);
        return {
          content: [{ type: 'text', text: JSON.stringify(conversations, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================
  // TOOL: get_conversation
  // ============================================
  server.registerTool(
    'get_conversation',
    {
      description: 'Get details of a specific conversation',
      inputSchema: {
        conversationId: z.string().describe('The conversation ID'),
      },
    },
    async ({ conversationId }) => {
      try {
        const raw = sqlNode.getConversationById(conversationId);
        if (!raw) {
          return {
            content: [{ type: 'text', text: `Conversation not found: ${conversationId}` }],
            isError: true,
          };
        }
        const conversation = formatConversation(raw);
        return {
          content: [{ type: 'text', text: JSON.stringify(conversation, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================
  // TOOL: get_messages
  // ============================================
  server.registerTool(
    'get_messages',
    {
      description: 'Get messages from a conversation with attachment local paths',
      inputSchema: {
        conversationId: z.string().describe('The conversation ID'),
        limit: z.number().default(50).describe('Maximum number of messages to return'),
      },
    },
    async ({ conversationId, limit }) => {
      try {
        const result = sqlNode.getMessagesByConversation(conversationId, {
          messageId: null,
        });

        const messages = (result.messages || [])
          .map((m: any) => formatMessage(m, conversationId))
          .slice(0, limit);

        return {
          content: [{ type: 'text', text: JSON.stringify(messages, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================
  // TOOL: search_messages
  // ============================================
  server.registerTool(
    'search_messages',
    {
      description: 'Search messages across all conversations',
      inputSchema: {
        query: z.string().describe('Search query'),
        limit: z.number().default(50).describe('Maximum number of results'),
      },
    },
    async ({ query, limit }) => {
      try {
        const results = sqlNode.searchMessages(query, limit);
        const messages = results.map((m: any) => formatMessage(m, m.conversationId));
        return {
          content: [{ type: 'text', text: JSON.stringify(messages, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================
  // TOOL: send_message
  // ============================================
  server.registerTool(
    'send_message',
    {
      description: 'Send a text message and/or attachments to a conversation',
      inputSchema: {
        conversationId: z.string().describe('The conversation ID to send to'),
        body: z.string().optional().default('').describe('Text message body'),
        attachmentPaths: z
          .array(z.string())
          .optional()
          .default([])
          .describe('Array of absolute filesystem paths to attach'),
      },
    },
    async ({ conversationId, body, attachmentPaths }) => {
      try {
        if (!body && (!attachmentPaths || attachmentPaths.length === 0)) {
          return {
            content: [{ type: 'text', text: 'Error: Must provide body or attachmentPaths' }],
            isError: true,
          };
        }

        const attachments = (attachmentPaths || []).map((p: string) => ({ path: p }));

        // Send via IPC to renderer process
        const requestId = `send-${++requestIdCounter}`;
        const request: SendMessageRequest = { conversationId, body, attachments };

        const result = await sendIpcRequest(
          MCP_IPC_CHANNELS.SEND_MESSAGE,
          requestId,
          request,
          ipcMain
        );

        return {
          content: [{ type: 'text', text: `Message sent to ${conversationId}: ${JSON.stringify(result)}` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error sending message: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================
  // TOOL: download_attachment
  // ============================================
  server.registerTool(
    'download_attachment',
    {
      description: 'Get the local file path for an attachment (downloads if needed)',
      inputSchema: {
        messageId: z.string().describe('The message ID containing the attachment'),
        attachmentIndex: z.number().default(0).describe('Index of the attachment (0-based)'),
      },
    },
    async ({ messageId, attachmentIndex }) => {
      try {
        const requestId = `download-${++requestIdCounter}`;
        const result = await sendIpcRequest(
          MCP_IPC_CHANNELS.DOWNLOAD_ATTACHMENT,
          requestId,
          { messageId, attachmentIndex },
          ipcMain
        );

        return {
          content: [{ type: 'text', text: `Attachment path: ${result}` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================
  // TOOL: subscribe_events
  // ============================================
  server.registerTool(
    'subscribe_events',
    {
      description: 'Subscribe to receive new message events via webhook POST',
      inputSchema: {
        url: z.string().describe('Webhook URL to POST events to'),
        conversationIds: z
          .array(z.string())
          .optional()
          .describe('Filter: only these conversation IDs (empty = all)'),
        includeOutgoing: z
          .boolean()
          .optional()
          .default(false)
          .describe('Include outgoing messages (default: incoming only)'),
      },
    },
    async ({ url, conversationIds, includeOutgoing }) => {
      try {
        const subscription = webhookManager.subscribe(url, {
          conversationIds,
          includeOutgoing,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  subscriptionId: subscription.id,
                  url: subscription.url,
                  filters: subscription.filters,
                  message: 'Webhook subscription created successfully',
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================
  // TOOL: unsubscribe_events
  // ============================================
  server.registerTool(
    'unsubscribe_events',
    {
      description: 'Unsubscribe from message events',
      inputSchema: {
        subscriptionId: z.string().describe('The subscription ID to remove'),
      },
    },
    async ({ subscriptionId }) => {
      try {
        const removed = webhookManager.unsubscribe(subscriptionId);
        return {
          content: [
            {
              type: 'text',
              text: removed
                ? `Subscription ${subscriptionId} removed successfully`
                : `Subscription ${subscriptionId} not found`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================
  // TOOL: list_subscriptions
  // ============================================
  server.registerTool(
    'list_subscriptions',
    {
      description: 'List all active webhook subscriptions',
      inputSchema: {},
    },
    async () => {
      try {
        const subscriptions = webhookManager.listSubscriptions();
        return {
          content: [{ type: 'text', text: JSON.stringify(subscriptions, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  return server;
}

/**
 * Create and start the MCP server
 */
export async function startMcpServer(
  config: McpServerConfig = {
    port: 6274,
    host: '127.0.0.1',
    enableAuth: false,
  },
  ipcMain?: Electron.IpcMain
): Promise<{ server: McpServer; httpServer: http.Server }> {
  const httpServer = http.createServer();

  httpServer.on('request', async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Auth check if enabled
    if (config.enableAuth && config.authToken) {
      const authHeader = req.headers.authorization;
      if (!authHeader || authHeader !== `Bearer ${config.authToken}`) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
    }

    const url = new URL(req.url || '/', `http://${config.host}:${config.port}`);

    // Health check endpoint
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', version: '1.0.0-mcp' }));
      return;
    }

    // SSE endpoint for MCP (GET /mcp)
    if (url.pathname === '/mcp' && req.method === 'GET') {
      try {
        const transport = new SSEServerTransport('/messages', res);
        const sessionId = transport.sessionId;
        transports.set(sessionId, transport);

        transport.onclose = () => {
          console.log(`[MCP] SSE transport closed for session ${sessionId}`);
          transports.delete(sessionId);
        };

        const server = createMcpServer(ipcMain);
        await server.connect(transport);
        console.log(`[MCP] Established SSE stream with session ID: ${sessionId}`);
      } catch (error) {
        console.error('[MCP] Error establishing SSE stream:', error);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Error establishing SSE stream' }));
        }
      }
      return;
    }

    // Messages endpoint for SSE transport (POST /messages)
    if (url.pathname === '/messages' && req.method === 'POST') {
      const sessionId = url.searchParams.get('sessionId');
      if (!sessionId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing sessionId parameter' }));
        return;
      }

      const transport = transports.get(sessionId);
      if (!transport) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Session not found' }));
        return;
      }

      let body = '';
      req.on('data', chunk => {
        body += chunk;
      });
      req.on('end', async () => {
        try {
          await transport.handlePostMessage(req, res, body);
        } catch (error) {
          console.error('[MCP] Error handling POST message:', error);
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: String(error) }));
          }
        }
      });
      return;
    }

    // Default: 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  const mcpServer = createMcpServer(ipcMain);

  return new Promise((resolve, reject) => {
    httpServer.listen(config.port, config.host, () => {
      console.log(`[MCP] Session MCP server ready at http://${config.host}:${config.port}/mcp`);
      console.log(`[MCP] Health check: http://${config.host}:${config.port}/health`);
      resolve({ server: mcpServer, httpServer });
    });

    httpServer.on('error', reject);
  });
}

/**
 * Send IPC request to renderer and wait for response
 */
async function sendIpcRequest(
  channel: string,
  requestId: string,
  data: unknown,
  ipcMain?: Electron.IpcMain
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!ipcMain) {
      reject(new Error('IPC not available - renderer process not connected'));
      return;
    }

    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error('IPC request timeout'));
    }, 30000);

    pendingRequests.set(requestId, {
      resolve: (value: unknown) => {
        clearTimeout(timeout);
        pendingRequests.delete(requestId);
        resolve(value);
      },
      reject: (error: Error) => {
        clearTimeout(timeout);
        pendingRequests.delete(requestId);
        reject(error);
      },
    });

    // Send to all windows
    const { BrowserWindow } = require('electron');
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send(channel, { requestId, data });
    }
  });
}

/**
 * Handle IPC response from renderer
 */
export function handleIpcResponse(requestId: string, error: string | null, result: unknown): void {
  const pending = pendingRequests.get(requestId);
  if (pending) {
    if (error) {
      pending.reject(new Error(error));
    } else {
      pending.resolve(result);
    }
  }
}

/**
 * Setup IPC handlers in main process
 */
export function setupMcpIpcHandlers(ipcMain: Electron.IpcMain): void {
  // Handle responses from renderer
  ipcMain.on(MCP_IPC_CHANNELS.SEND_MESSAGE_RESPONSE, (_event, { requestId, error, result }) => {
    handleIpcResponse(requestId, error, result);
  });

  ipcMain.on(
    MCP_IPC_CHANNELS.GET_DECRYPTED_ATTACHMENT_RESPONSE,
    (_event, { requestId, error, result }) => {
      handleIpcResponse(requestId, error, result);
    }
  );

  ipcMain.on(
    MCP_IPC_CHANNELS.DOWNLOAD_ATTACHMENT_RESPONSE,
    (_event, { requestId, error, result }) => {
      handleIpcResponse(requestId, error, result);
    }
  );
}
