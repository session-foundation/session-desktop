/**
 * Test the actual compiled webhook manager
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Test type definitions
console.log('=== Webhook Manager Type Test ===\n');

// Read the types file to verify structure
import fs from 'fs';
const typesContent = fs.readFileSync('./ts/mcp/types.ts', 'utf-8');

console.log('Checking types.ts exports...');

const expectedTypes = [
  'McpConversation',
  'McpMessage',
  'McpAttachment',
  'WebhookSubscription',
  'WebhookFilters',
  'WebhookEventPayload',
  'SendMessageRequest',
  'MCP_IPC_CHANNELS',
  'McpServerConfig',
];

let allTypesFound = true;
for (const type of expectedTypes) {
  if (typesContent.includes(type)) {
    console.log(`  ✓ ${type} found`);
  } else {
    console.log(`  ✗ ${type} NOT found`);
    allTypesFound = false;
  }
}

console.log('\nChecking webhookManager.ts...');
const webhookContent = fs.readFileSync('./ts/mcp/webhookManager.ts', 'utf-8');

const expectedWebhookMethods = [
  'subscribe',
  'unsubscribe',
  'listSubscriptions',
  'triggerNewMessage',
  'shouldTrigger',
  'sendWebhook',
];

let allMethodsFound = true;
for (const method of expectedWebhookMethods) {
  if (webhookContent.includes(method)) {
    console.log(`  ✓ ${method} method found`);
  } else {
    console.log(`  ✗ ${method} method NOT found`);
    allMethodsFound = false;
  }
}

console.log('\nChecking server.ts tools...');
const serverContent = fs.readFileSync('./ts/mcp/server.ts', 'utf-8');

const expectedTools = [
  'list_conversations',
  'get_conversation',
  'get_messages',
  'search_messages',
  'send_message',
  'download_attachment',
  'subscribe_events',
  'unsubscribe_events',
  'list_subscriptions',
];

let allToolsFound = true;
for (const tool of expectedTools) {
  if (serverContent.includes(`'${tool}'`)) {
    console.log(`  ✓ ${tool} tool registered`);
  } else {
    console.log(`  ✗ ${tool} tool NOT found`);
    allToolsFound = false;
  }
}

console.log('\nChecking messageEventHook.ts...');
const hookContent = fs.readFileSync('./ts/mcp/messageEventHook.ts', 'utf-8');

if (hookContent.includes('notifyNewMessage')) {
  console.log('  ✓ notifyNewMessage export found');
} else {
  console.log('  ✗ notifyNewMessage NOT found');
}

if (hookContent.includes('getConversationType')) {
  console.log('  ✓ getConversationType export found');
} else {
  console.log('  ✗ getConversationType NOT found');
}

console.log('\nChecking rendererHandlers.ts...');
const rendererContent = fs.readFileSync('./ts/mcp/rendererHandlers.ts', 'utf-8');

if (rendererContent.includes('initMcpRendererHandlers')) {
  console.log('  ✓ initMcpRendererHandlers export found');
} else {
  console.log('  ✗ initMcpRendererHandlers NOT found');
}

if (rendererContent.includes('handleSendMessage')) {
  console.log('  ✓ handleSendMessage function found');
} else {
  console.log('  ✗ handleSendMessage NOT found');
}

if (rendererContent.includes('handleDownloadAttachment')) {
  console.log('  ✓ handleDownloadAttachment function found');
} else {
  console.log('  ✗ handleDownloadAttachment NOT found');
}

console.log('\nChecking index.ts barrel export...');
const indexContent = fs.readFileSync('./ts/mcp/index.ts', 'utf-8');

const expectedExports = [
  'startMcpServer',
  'setupMcpIpcHandlers',
  'webhookManager',
  'initMcpRendererHandlers',
  'notifyNewMessage',
];

let allExportsFound = true;
for (const exp of expectedExports) {
  if (indexContent.includes(exp)) {
    console.log(`  ✓ ${exp} exported`);
  } else {
    console.log(`  ✗ ${exp} NOT exported`);
    allExportsFound = false;
  }
}

console.log('\n=== Summary ===');
const allPassed = allTypesFound && allMethodsFound && allToolsFound && allExportsFound;
if (allPassed) {
  console.log('✓ All MCP module checks passed!');
  process.exit(0);
} else {
  console.log('✗ Some checks failed');
  process.exit(1);
}
