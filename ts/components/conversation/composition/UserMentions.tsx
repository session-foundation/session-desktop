import { MemberListItem } from '../../MemberListItem';

export const renderUserMentionRow = (id: string, conversationId?: string) => {
  return (
    <MemberListItem
      key={`suggestion-list-${id}`}
      isSelected={false}
      pubkey={id}
      inMentions={true}
      dataTestId="mentions-popup-row"
      conversationId={conversationId}
      contactNameSuffix="-mention-row"
    />
  );
};
