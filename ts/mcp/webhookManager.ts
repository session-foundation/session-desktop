/**
 * Webhook Subscription Manager for MCP
 * Handles webhook subscriptions for real-time message notifications
 */

import { v4 as uuidv4 } from 'uuid';
import type { WebhookSubscription, WebhookFilters, WebhookEventPayload, McpMessage } from './types';

class WebhookManager {
  private subscriptions: Map<string, WebhookSubscription> = new Map();
  private maxRetries = 3;
  private retryDelayMs = 1000;

  /**
   * Subscribe to message events
   */
  subscribe(url: string, filters?: WebhookFilters): WebhookSubscription {
    const id = uuidv4();
    const subscription: WebhookSubscription = {
      id,
      url,
      filters,
      createdAt: Date.now(),
      lastTriggeredAt: null,
      errorCount: 0,
    };
    this.subscriptions.set(id, subscription);
    console.log(`[MCP Webhook] Subscription created: ${id} -> ${url}`);
    return subscription;
  }

  /**
   * Unsubscribe from message events
   */
  unsubscribe(subscriptionId: string): boolean {
    const existed = this.subscriptions.has(subscriptionId);
    if (existed) {
      this.subscriptions.delete(subscriptionId);
      console.log(`[MCP Webhook] Subscription removed: ${subscriptionId}`);
    }
    return existed;
  }

  /**
   * List all active subscriptions
   */
  listSubscriptions(): WebhookSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Get a specific subscription
   */
  getSubscription(subscriptionId: string): WebhookSubscription | undefined {
    return this.subscriptions.get(subscriptionId);
  }

  /**
   * Trigger webhooks for a new message event
   */
  async triggerNewMessage(
    message: McpMessage,
    conversation: { id: string; name: string | null; type: 'private' | 'group' | 'community' }
  ): Promise<void> {
    const payload: WebhookEventPayload = {
      eventType: 'new_message',
      timestamp: Date.now(),
      message,
      conversation,
    };

    const promises: Promise<void>[] = [];

    for (const subscription of this.subscriptions.values()) {
      if (this.shouldTrigger(subscription, message, conversation)) {
        promises.push(this.sendWebhook(subscription, payload));
      }
    }

    await Promise.allSettled(promises);
  }

  /**
   * Check if subscription should be triggered for this message
   */
  private shouldTrigger(
    subscription: WebhookSubscription,
    message: McpMessage,
    conversation: { id: string; name: string | null; type: 'private' | 'group' | 'community' }
  ): boolean {
    const { filters } = subscription;

    if (!filters) {
      // No filters = trigger for all incoming messages
      return !message.isOutgoing;
    }

    // Check conversation filter
    if (filters.conversationIds && filters.conversationIds.length > 0) {
      if (!filters.conversationIds.includes(conversation.id)) {
        return false;
      }
    }

    // Check outgoing filter
    if (!filters.includeOutgoing && message.isOutgoing) {
      return false;
    }

    // Check message type filter
    if (filters.messageTypes && filters.messageTypes.length > 0) {
      const hasAttachments = message.attachments.length > 0;
      const hasText = message.body && message.body.length > 0;

      const matchesType = filters.messageTypes.some(type => {
        if (type === 'all') return true;
        if (type === 'attachment') return hasAttachments;
        if (type === 'text') return hasText && !hasAttachments;
        return false;
      });

      if (!matchesType) {
        return false;
      }
    }

    return true;
  }

  /**
   * Send webhook with retry logic
   */
  private async sendWebhook(
    subscription: WebhookSubscription,
    payload: WebhookEventPayload
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await fetch(subscription.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-MCP-Event': payload.eventType,
            'X-Session-MCP-Subscription-Id': subscription.id,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        if (response.ok) {
          // Success - update subscription
          subscription.lastTriggeredAt = Date.now();
          subscription.errorCount = 0;
          this.subscriptions.set(subscription.id, subscription);
          console.log(`[MCP Webhook] Delivered to ${subscription.url}`);
          return;
        }

        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }

      // Wait before retry (exponential backoff)
      if (attempt < this.maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelayMs * Math.pow(2, attempt)));
      }
    }

    // All retries failed
    subscription.errorCount++;
    this.subscriptions.set(subscription.id, subscription);
    console.error(
      `[MCP Webhook] Failed to deliver to ${subscription.url} after ${this.maxRetries} attempts:`,
      lastError
    );

    // Auto-remove subscription after too many errors
    if (subscription.errorCount >= 10) {
      console.log(
        `[MCP Webhook] Removing subscription ${subscription.id} due to too many errors`
      );
      this.subscriptions.delete(subscription.id);
    }
  }

  /**
   * Clear all subscriptions
   */
  clearAll(): void {
    this.subscriptions.clear();
    console.log('[MCP Webhook] All subscriptions cleared');
  }
}

// Singleton instance
export const webhookManager = new WebhookManager();
