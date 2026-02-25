/**
 * MCP (Model Context Protocol) Types for Session Desktop
 */

// Conversation types for MCP API
export interface McpConversation {
  id: string;
  type: 'private' | 'group' | 'community';
  name: string | null;
  members?: string[];
  unreadCount: number;
  lastMessageTimestamp: number | null;
  isBlocked: boolean;
  isApproved: boolean;
}

// Message types for MCP API
export interface McpAttachment {
  id: string;
  contentType: string;
  fileName: string | null;
  size: number;
  localPath: string | null; // Decrypted local path (if available)
  thumbnail?: {
    width: number;
    height: number;
    contentType: string;
  };
}

export interface McpMessage {
  id: string;
  conversationId: string;
  sender: string;
  senderName: string | null;
  timestamp: number;
  body: string | null;
  attachments: McpAttachment[];
  isOutgoing: boolean;
  isRead: boolean;
  expiresAt: number | null;
  quote?: {
    id: string;
    author: string;
    text: string | null;
  };
}

// Webhook subscription types
export interface WebhookSubscription {
  id: string;
  url: string;
  filters?: WebhookFilters;
  createdAt: number;
  lastTriggeredAt: number | null;
  errorCount: number;
}

export interface WebhookFilters {
  conversationIds?: string[];
  includeOutgoing?: boolean; // Default: false (only incoming)
  messageTypes?: ('text' | 'attachment' | 'all')[];
}

// Webhook event payload
export interface WebhookEventPayload {
  eventType: 'new_message';
  timestamp: number;
  message: McpMessage;
  conversation: {
    id: string;
    name: string | null;
    type: 'private' | 'group' | 'community';
  };
}

// Send message request
export interface SendMessageRequest {
  conversationId: string;
  body?: string;
  attachments?: SendAttachment[];
}

export interface SendAttachment {
  path: string; // Absolute filesystem path
  name?: string;
  contentType?: string;
}

// IPC channel names
export const MCP_IPC_CHANNELS = {
  // Renderer -> Main
  NEW_MESSAGE_EVENT: 'mcp-new-message-event',

  // Main -> Renderer
  SEND_MESSAGE: 'mcp-send-message',
  SEND_MESSAGE_RESPONSE: 'mcp-send-message-response',
  GET_DECRYPTED_ATTACHMENT: 'mcp-get-decrypted-attachment',
  GET_DECRYPTED_ATTACHMENT_RESPONSE: 'mcp-get-decrypted-attachment-response',
  DOWNLOAD_ATTACHMENT: 'mcp-download-attachment',
  DOWNLOAD_ATTACHMENT_RESPONSE: 'mcp-download-attachment-response',
} as const;

// MCP Server configuration
export interface McpServerConfig {
  port: number;
  host: string;
  enableAuth: boolean;
  authToken?: string;
}

export const DEFAULT_MCP_CONFIG: McpServerConfig = {
  port: 6274,
  host: '127.0.0.1',
  enableAuth: false,
};
