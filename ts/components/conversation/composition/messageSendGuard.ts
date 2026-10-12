export function createMessageSendGuard() {
  const conversationsSending = new Set<string>();

  return async (conversationKey: string, sendMessage: () => Promise<void>) => {
    if (conversationsSending.has(conversationKey)) {
      return;
    }

    conversationsSending.add(conversationKey);
    try {
      await sendMessage();
    } finally {
      conversationsSending.delete(conversationKey);
    }
  };
}
