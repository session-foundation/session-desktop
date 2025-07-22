import { MemberListItem } from '../../MemberListItem';

export const renderUserMentionRow = (id: string, isPublic: boolean) => {
  return (
    <MemberListItem
      key={`suggestion-list-${id}`}
      isSelected={false}
      pubkey={id}
      inMentions={true}
      isPublic={isPublic}
      dataTestId="mentions-popup-row"
      maxNameWidth="100%"
    />
  );
};
