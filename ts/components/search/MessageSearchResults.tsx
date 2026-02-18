import styled, { type CSSProperties } from 'styled-components';

import {
  useConversationUsernameWithFallback,
  useIsPrivate,
  useIsPublic,
} from '../../hooks/useParamSelector';
import { isUsAnySogsFromCache } from '../../session/apis/open_group_api/sogsv3/knownBlindedkeys';
import { PubKey } from '../../session/types';
import { UserUtils } from '../../session/utils';
import { getOurPubKeyStrFromCache } from '../../session/utils/User';
import { openConversationToSpecificMessage } from '../../state/ducks/conversations';
import { MessageResultProps } from '../../types/message';
import { Avatar, AvatarSize } from '../avatar/Avatar';
import { MessageBodyHighlight } from '../basic/MessageBodyHighlight';
import { ContactName } from '../conversation/ContactName/ContactName';
import { Timestamp } from '../conversation/Timestamp';
import { leftPaneListWidth } from '../leftpane/LeftPane';
import { tr } from '../../localization/localeTools';
import { createButtonOnKeyDownForClickEventHandler } from '../../util/keyboardShortcuts';
import { Localizer } from '../basic/Localizer';

const StyledConversationTitleResults = styled.div`
  flex-grow: 1;
  flex-shrink: 1;
  font-size: 14px;
  line-height: 18px;
  overflow-x: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--text-secondary-color);
  /* We don't want this to overflow horizontally past the timestamp */
  width: 90px;
`;

const StyledConversationFromUserInGroup = styled(StyledConversationTitleResults)`
  display: inline;
  font-size: 12px;
  line-height: 14px;
  overflow-x: hidden;
  font-weight: 700;
  color: var(--text-secondary-color);
`;

const StyledSearchResults = styled.div`
  padding: var(--margins-sm) var(--margins-md);
  height: var(--contact-row-height);
  max-width: ${leftPaneListWidth}px;

  display: flex;
  flex-direction: row;
  align-items: flex-start;

  cursor: pointer;

  &:hover,
  &:focus-visible {
    background-color: var(--conversation-tab-background-hover-color);
  }
`;

const StyledLoadingSnippetContainer = styled.span`
  font-style: 'italic';
  opacity: 0.6;
`;

const StyledResultText = styled.div`
  flex-grow: 1;
  margin-inline-start: 12px;
  display: inline-flex;
  flex-direction: column;
  align-items: stretch;
  min-width: 0;
`;

const ResultsHeader = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const StyledMessageResultsHeaderName = styled.span`
  font-weight: 300;
`;

const FromName = (props: { source: string; conversationId: string }) => {
  const { conversationId, source } = props;

  const isNoteToSelf = conversationId === getOurPubKeyStrFromCache() && source === conversationId;

  if (isNoteToSelf) {
    return <StyledMessageResultsHeaderName>{tr('noteToSelf')}</StyledMessageResultsHeaderName>;
  }

  if (source === getOurPubKeyStrFromCache()) {
    return <StyledMessageResultsHeaderName>{tr('you')}</StyledMessageResultsHeaderName>;
  }

  return (
    <ContactName
      pubkey={conversationId}
      module="module-message-search-result__header__name"
      contactNameContext="message-search-result-from"
      conversationId={conversationId}
    />
  );
};

const ConversationHeader = (props: { source: string; conversationId: string }) => {
  const { source, conversationId } = props;

  const ourKey = getOurPubKeyStrFromCache();

  if (conversationId !== ourKey) {
    return (
      <StyledConversationTitleResults>
        <StyledMessageResultsHeaderName>
          <ContactName
            pubkey={conversationId}
            contactNameContext="message-search-result-conversation"
            conversationId={conversationId}
          />
        </StyledMessageResultsHeaderName>
      </StyledConversationTitleResults>
    );
  }

  return (
    <StyledConversationTitleResults>
      <FromName source={source} conversationId={conversationId} />
    </StyledConversationTitleResults>
  );
};

const FromUserInGroup = (props: { authorPubkey: string; conversationId: string }) => {
  const { authorPubkey, conversationId } = props;

  const ourKey = getOurPubKeyStrFromCache();
  const isPublic = useIsPublic(conversationId);
  const convoIsPrivate = useIsPrivate(conversationId);
  const authorConvoName = useConversationUsernameWithFallback(true, authorPubkey);

  if (convoIsPrivate) {
    return null;
  }

  if (
    authorPubkey === ourKey ||
    (isPublic && PubKey.isBlinded(authorPubkey) && isUsAnySogsFromCache(authorPubkey))
  ) {
    return <StyledConversationFromUserInGroup>{tr('you')}: </StyledConversationFromUserInGroup>;
  }
  return <StyledConversationFromUserInGroup>{authorConvoName}: </StyledConversationFromUserInGroup>;
};

const AvatarItem = (props: { source: string }) => {
  return <Avatar size={AvatarSize.S} pubkey={props.source} />;
};

const ResultBody = styled.div`
  margin-top: 1px;
  flex-shrink: 1;

  font-size: var(--font-size-sm);

  color: var(--text-secondary-color);

  max-height: 3.6em;

  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
`;

const StyledTimestampContainer = styled.div`
  flex-shrink: 0;
  margin-inline-start: 6px;

  font-size: var(--font-size-xs);
  line-height: 16px;
  letter-spacing: 0.3px;

  overflow-x: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;

  text-transform: uppercase;

  color: var(--text-secondary-color);
`;

type MessageSearchResultProps = MessageResultProps & { style: CSSProperties };

export const MessageSearchResult = (props: MessageSearchResultProps) => {
  const {
    id,
    conversationId,
    received_at,
    snippet,
    source,
    sent_at,
    serverTimestamp,
    timestamp,
    direction,
    style,
  } = props;

  /** destination is only used for search results (showing the `from:` and `to`)
   *  1.  for messages we sent or synced from another of our devices
   *    - the conversationId for a private convo
   *    - the conversationId for a closed group convo
   *    - the conversationId for an opengroup
   *
   *  2. for messages we received
   *    - our own pubkey for a private conversation
   *    - the conversationID for a closed group
   *    - the conversationID for a public group
   */
  const me = UserUtils.getOurPubKeyStrFromCache();
  const convoIsPrivate = useIsPrivate(conversationId);
  const isPublic = useIsPublic(conversationId);

  const destination =
    direction === 'incoming' ? conversationId : convoIsPrivate ? me : conversationId;

  const onClick = () =>
    void openConversationToSpecificMessage({
      conversationKey: conversationId,
      messageIdToNavigateTo: id,
      shouldHighlightMessage: true,
    });

  const onKeyDown = createButtonOnKeyDownForClickEventHandler(onClick);

  if (!source && !destination) {
    return null;
  }

  return (
    <StyledSearchResults
      key={`div-msg-searchresult-${id}`}
      style={style}
      tabIndex={0}
      role="button"
      onKeyDown={onKeyDown}
      onClick={onClick}
    >
      <AvatarItem source={conversationId} />
      <StyledResultText>
        <ResultsHeader>
          <ConversationHeader source={destination} conversationId={conversationId} />
          <StyledTimestampContainer>
            <Timestamp
              timestamp={serverTimestamp || timestamp || sent_at || received_at}
              isConversationSearchResult={true}
            />
          </StyledTimestampContainer>
        </ResultsHeader>
        <ResultBody>
          <FromUserInGroup authorPubkey={source} conversationId={conversationId} />
          {snippet === null ? (
            <StyledLoadingSnippetContainer>
              <Localizer token="loading" />
            </StyledLoadingSnippetContainer>
          ) : (
            <MessageBodyHighlight
              text={snippet || ''}
              isGroup={!convoIsPrivate}
              isPublic={isPublic}
            />
          )}
        </ResultBody>
      </StyledResultText>
    </StyledSearchResults>
  );
};
