/**
 * MCP (Model Context Protocol) Module for Session Desktop
 *
 * Provides AI agent access to Session conversations and messaging via MCP protocol.
 *
 * Architecture:
 * - Main process: MCP HTTP server, webhook management, direct SQL access for reads
 * - Renderer process: Message sending, attachment encryption/decryption
 * - IPC bridge: Communication between main and renderer for operations requiring renderer
 */

// Types
export * from './types';

// Main process exports
export { startMcpServer, setupMcpIpcHandlers, handleIpcResponse } from './server';
export { webhookManager } from './webhookManager';

// Renderer process exports
export { initMcpRendererHandlers } from './rendererHandlers';
export { notifyNewMessage, getConversationType } from './messageEventHook';
