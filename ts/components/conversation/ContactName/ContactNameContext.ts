export type ContactNameContext =
  | 'conversation-list-item'
  | 'conversation-list-item-search'
  | 'quoted-message-composition' // the author of the message we are currently replying to
  | 'message-author' // the author of the message as shown in the message list
  | 'quote-author' // the author of the quoted message, shown in the message list
  | 'react-list-modal'
  | 'message-search-result';
