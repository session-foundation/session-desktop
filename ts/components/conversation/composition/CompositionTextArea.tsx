import { RefObject, useState } from 'react';
import { Mention, MentionsInput } from 'react-mentions';
import { uniq } from 'lodash';
import { useSelector } from 'react-redux';
import {
  useSelectedConversationKey,
  useSelectedIsBlocked,
  useSelectedIsGroupDestroyed,
  useSelectedIsKickedFromGroup,
  useSelectedIsPrivate,
  useSelectedIsPublic,
  useSelectedNicknameOrProfileNameOrShortenedPubkey,
} from '../../../state/selectors/selectedConversation';
import { updateDraftForConversation } from '../SessionConversationDrafts';
import { renderEmojiQuickResultRow, searchEmojiForQuery } from './EmojiQuickResult';
import { renderUserMentionRow, styleForCompositionBoxSuggestions } from './UserMentions';
import { HTMLDirection, useHTMLDirection } from '../../../util/i18n/rtlSupport';
import { ConvoHub } from '../../../session/conversations';
import { Constants } from '../../../session';
import type { SessionSuggestionDataItem } from './types';
import { getMentionsInput } from '../../../state/selectors/conversations';
import { UserUtils } from '../../../session/utils';
import { localize } from '../../../localization/localeTools';
import { PubKey } from '../../../session/types';
import { useLibGroupMembers } from '../../../state/selectors/groups';
import { use05GroupMembers } from '../../../hooks/useParamSelector';

const sendMessageStyle = (dir?: HTMLDirection) => {
  return {
    control: {
      wordBreak: 'break-all',
    },
    input: {
      overflow: 'auto',
      maxHeight: '50vh',
      wordBreak: 'break-word',
      padding: '0px',
      margin: '0px',
    },
    highlighter: {
      boxSizing: 'border-box',
      overflow: 'hidden',
      maxHeight: '50vh',
    },
    flexGrow: 1,
    minHeight: '24px',
    width: '100%',
    ...styleForCompositionBoxSuggestions(dir),
  } as const;
};

type Props = {
  draft: string;
  setDraft: (draft: string) => void;
  container: RefObject<HTMLDivElement>;
  textAreaRef: RefObject<HTMLTextAreaElement>;
  typingEnabled: boolean;
  onKeyDown: (event: any) => void;
};

function filterMentionDataByQuery(query: string, mentionData: Array<SessionSuggestionDataItem>) {
  return (
    mentionData
      .filter(d => !!d)
      .filter(
        d =>
          d.display?.toLowerCase()?.includes(query.toLowerCase()) ||
          d.id?.toLowerCase()?.includes(query.toLowerCase())
      ) || []
  );
}

function useMembersInThisChat(): Array<SessionSuggestionDataItem> {
  const selectedConvoKey = useSelectedConversationKey();
  const isPrivate = useSelectedIsPrivate();
  const isPublic = useSelectedIsPublic();
  const membersForCommunity = useSelector(getMentionsInput);
  const membersFor03Group = useLibGroupMembers(selectedConvoKey);

  const membersFor05LegacyGroup = use05GroupMembers(selectedConvoKey);

  if (!selectedConvoKey) {
    return [];
  }
  if (isPublic) {
    return membersForCommunity || [];
  }
  const members = isPrivate
    ? uniq([UserUtils.getOurPubKeyStrFromCache(), selectedConvoKey])
    : PubKey.is03Pubkey(selectedConvoKey)
      ? membersFor03Group
      : membersFor05LegacyGroup;

  return members.map(m => {
    return {
      id: m,
      display: UserUtils.isUsFromCache(m)
        ? localize('you').toString()
        : ConvoHub.use().get(m)?.getNicknameOrRealUsernameOrPlaceholder() || PubKey.shorten(m),
    };
  });
}

function fetchMentionData(
  query: string,
  fetchedMembersInThisChat: Array<SessionSuggestionDataItem>
): Array<SessionSuggestionDataItem> {
  let overriddenQuery = query;
  if (!query) {
    overriddenQuery = '';
  }

  return filterMentionDataByQuery(overriddenQuery, fetchedMembersInThisChat);
}

export const CompositionTextArea = (props: Props) => {
  const { draft, setDraft, container, textAreaRef, typingEnabled, onKeyDown } = props;

  const [lastBumpTypingMessageLength, setLastBumpTypingMessageLength] = useState(0);

  const selectedConversationKey = useSelectedConversationKey();
  const htmlDirection = useHTMLDirection();
  const isKickedFromGroup = useSelectedIsKickedFromGroup();
  const isGroupDestroyed = useSelectedIsGroupDestroyed();
  const isBlocked = useSelectedIsBlocked();
  const groupName = useSelectedNicknameOrProfileNameOrShortenedPubkey();
  const membersInThisChat = useMembersInThisChat();

  if (!selectedConversationKey) {
    return null;
  }

  const makeMessagePlaceHolderText = () => {
    if (isGroupDestroyed) {
      return window.i18n('groupDeletedMemberDescription', { group_name: groupName });
    }
    if (isKickedFromGroup) {
      return window.i18n('groupRemovedYou', { group_name: groupName });
    }
    if (isBlocked) {
      return window.i18n('blockBlockedDescription');
    }
    return window.i18n('message');
  };

  const messagePlaceHolder = makeMessagePlaceHolderText();
  const neverMatchingRegex = /($a)/;

  const style = sendMessageStyle(htmlDirection);

  const handleOnChange = (event: any) => {
    if (!selectedConversationKey) {
      throw new Error('selectedConversationKey is needed');
    }

    const newDraft = (event.target.value ?? '').slice(
      0,
      Constants.CONVERSATION.MAX_MESSAGE_CHAR_COUNT
    );
    setDraft(newDraft);
    updateDraftForConversation({ conversationKey: selectedConversationKey, draft: newDraft });
  };

  const handleKeyUp = async () => {
    if (!selectedConversationKey) {
      throw new Error('selectedConversationKey is needed');
    }
    /** Called whenever the user changes the message composition field. But only fires if there's content in the message field after the change.
    Also, check for a message length change before firing it up, to avoid catching ESC, tab, or whatever which is not typing
     */
    if (draft && draft.length && draft.length !== lastBumpTypingMessageLength) {
      const conversationModel = ConvoHub.use().get(selectedConversationKey);
      if (!conversationModel) {
        return;
      }
      conversationModel.throttledBumpTyping();
      setLastBumpTypingMessageLength(draft.length);
    }
  };

  return (
    <MentionsInput
      value={draft}
      onChange={handleOnChange}
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      onKeyDown={onKeyDown}
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      onKeyUp={handleKeyUp}
      placeholder={messagePlaceHolder}
      spellCheck={true}
      dir={htmlDirection}
      inputRef={textAreaRef}
      maxLength={Constants.CONVERSATION.MAX_MESSAGE_CHAR_COUNT}
      disabled={!typingEnabled}
      rows={1}
      data-testid="message-input-text-area"
      style={style}
      suggestionsPortalHost={container.current || undefined}
      forceSuggestionsAboveCursor={true} // force mentions to be rendered on top of the cursor, this is working with a fork of react-mentions for now
    >
      <Mention
        appendSpaceOnAdd={true}
        // this will be cleaned on cleanMentions()
        markup="@ￒ__id__ￗ__display__ￒ" // ￒ = \uFFD2 is one of the forbidden char for a display name (check displayNameRegex)
        trigger="@"
        // this is only for the composition box visible content. The real stuff on the backend box is the @markup
        displayTransform={(_id, display) => {
          return htmlDirection === 'rtl' ? `${display}@` : `@${display}`;
        }}
        data={(query: string) => fetchMentionData(query, membersInThisChat)}
        renderSuggestion={renderUserMentionRow}
      />
      <Mention
        trigger=":"
        markup="__id__"
        appendSpaceOnAdd={true}
        regex={neverMatchingRegex}
        data={searchEmojiForQuery}
        renderSuggestion={renderEmojiQuickResultRow}
      />
    </MentionsInput>
  );
};
