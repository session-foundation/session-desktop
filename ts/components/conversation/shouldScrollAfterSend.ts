export function shouldScrollAfterSend({
  selectedConversationKey,
  sentConversationId,
}: {
  selectedConversationKey?: string;
  sentConversationId?: string;
}) {
  return Boolean(sentConversationId && selectedConversationKey === sentConversationId);
}
