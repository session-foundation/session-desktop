/**
 * The MemberListItem component is used in many places, and we sometimes want to hide the pro badge given on the context.
 * This suffix will be used to differentiate between the `member-list-item` and a more specific one.
 */
export type ContactNameSuffixInMemberList = '-mention-row' | '';

export type ContactNameContext =
  | 'conversation-list-item'
  | 'conversation-list-item-search'
  | 'quoted-message-composition' // the author of the message we are currently replying to
  | 'message-author' // the author of the message as shown in the message list
  | 'quote-author' // the author of the quoted message, shown in the message list
  | 'react-list-modal'
  | 'message-info-author' // the author of the message as shown in the message info (right panel)
  | 'message-search-result-conversation' // the conversation name in the message search results
  | 'message-search-result-from' // the name of the sender in the message search results
  | 'contact-list-row' // the name in the list of contacts (after clicking the + from the left pane)
  | `member-list-item${ContactNameSuffixInMemberList}`;
