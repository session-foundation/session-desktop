/**
 * Message Event Hook for MCP
 * Hooks into Session's message receiving pipeline to notify webhooks
 */

import { ipcRenderer } from 'electron';
import { MCP_IPC_CHANNELS, McpMessage, McpAttachment } from './types';

/**
 * Notify main process of a new message for webhook dispatch
 * Call this from the message receiving pipeline
 */
export function notifyNewMessage(
  message: {
    id: string;
    conversationId: string;
    source: string;
    sourceName?: string;
    timestamp: number;
    body?: string;
    attachments?: any[];
    type?: string;
    direction?: string;
    read?: boolean;
    expiresAt?: number;
    quote?: any;
  },
  conversation: {
    id: string;
    name?: string;
    type?: 'private' | 'group' | 'community';
  }
): void {
  try {
    // Format the message for MCP
    const attachments: McpAttachment[] = (message.attachments || []).map((att: any, index: number) => ({
      id: att.id || att.digest || `${message.id}-${index}`,
      contentType: att.contentType || 'application/octet-stream',
      fileName: att.fileName || null,
      size: att.size || 0,
      localPath: att.path || null, // Relative path - full path can be computed by caller
      thumbnail: att.thumbnail
        ? {
            width: att.thumbnail.width,
            height: att.thumbnail.height,
            contentType: att.thumbnail.contentType,
          }
        : undefined,
    }));

    let quote;
    if (message.quote) {
      const parsedQuote = typeof message.quote === 'string' ? JSON.parse(message.quote) : message.quote;
      if (parsedQuote) {
        quote = {
          id: parsedQuote.id || '',
          author: parsedQuote.author || '',
          text: parsedQuote.text || null,
        };
      }
    }

    const mcpMessage: McpMessage = {
      id: message.id,
      conversationId: message.conversationId,
      sender: message.source || '',
      senderName: message.sourceName || null,
      timestamp: message.timestamp,
      body: message.body || null,
      attachments,
      isOutgoing: message.type === 'outgoing' || message.direction === 'outgoing',
      isRead: Boolean(message.read),
      expiresAt: message.expiresAt || null,
      quote,
    };

    const mcpConversation = {
      id: conversation.id,
      name: conversation.name || null,
      type: conversation.type || 'private',
    };

    // Send to main process
    ipcRenderer.send(MCP_IPC_CHANNELS.NEW_MESSAGE_EVENT, {
      message: mcpMessage,
      conversation: mcpConversation,
    });
  } catch (error) {
    console.error('[MCP] Error notifying new message:', error);
  }
}

/**
 * Helper to determine conversation type from conversation model
 */
export function getConversationType(
  conversation: any
): 'private' | 'group' | 'community' {
  if (conversation.isPublic?.() || conversation.isOpenGroupV2?.()) {
    return 'community';
  }
  if (conversation.isGroup?.() || conversation.isClosedGroup?.()) {
    return 'group';
  }
  return 'private';
}
