import { RefObject, useState } from 'react';
import Mentions from 'rc-mentions';
import { type MentionsRef } from 'rc-mentions/lib/Mentions';
import { uniq } from 'lodash';
import { useSelector } from 'react-redux';
import type { OptionProps } from 'rc-mentions/es/Option';
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
import { renderUserMentionRow } from './UserMentions';
import { useHTMLDirection } from '../../../util/i18n/rtlSupport';
import { ConvoHub } from '../../../session/conversations';
import type { SessionSuggestionDataItem } from './types';
import { getMentionsInput } from '../../../state/selectors/conversations';
import { UserUtils } from '../../../session/utils';
import { localize } from '../../../localization/localeTools';
import { PubKey } from '../../../session/types';
import { useLibGroupMembers } from '../../../state/selectors/groups';
import { use05GroupMembers } from '../../../hooks/useParamSelector';

type Props = {
  draft: string;
  setDraft: (draft: string) => void;
  container: RefObject<HTMLDivElement>;
  textAreaRef: RefObject<MentionsRef>;
  updateCursorPosition: (pos: number) => void;
  getCurrentCursorPosition: () => number;
  typingEnabled: boolean;
  onKeyDown: (event: any) => void;
  setIsMentioning: (mode: boolean) => void;
};

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

enum PREFIX {
  USER = '@',
  EMOJI = ':',
}

const prefixes = Object.values(PREFIX);

const isPrefix = (val: string): val is PREFIX => prefixes.includes(val as PREFIX);

export const CompositionTextArea = (props: Props) => {
  const {
    draft,
    setDraft,
    setIsMentioning,
    textAreaRef,
    typingEnabled,
    onKeyDown,
    getCurrentCursorPosition,
    updateCursorPosition,
  } = props;

  const [lastBumpTypingMessageLength, setLastBumpTypingMessageLength] = useState(0);
  const [emojiResults, setEmojiResults] = useState<Array<SessionSuggestionDataItem>>([]);
  const [mentionSearch, setMentionSearch] = useState<string>('');
  const [currentPrefix, setCurrentPrefix] = useState<PREFIX | null>(null);

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
  // const neverMatchingRegex = /($a)/;
  // const style = sendMessageStyle(htmlDirection);

  const handleOnChange = (text: string) => {
    if (!selectedConversationKey) {
      throw new Error('selectedConversationKey is needed');
    }

    const newDraft = text ?? '';
    setDraft(newDraft);
    updateDraftForConversation({ conversationKey: selectedConversationKey, draft: newDraft });
  };

  const handleKeyUp = () => {
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

  const handleSearch = (input: string, prefix: string) => {
    if (!isPrefix(prefix)) {
      return;
    }

    // This is only used by the emoji onSelect logic.
    setMentionSearch(input);

    /**
     * Because the emoji list is so long, only the 10 most relevant emojis are shown.
     */
    if (prefix === PREFIX.EMOJI) {
      setEmojiResults(searchEmojiForQuery(input, 10));
    }

    setIsMentioning(true);
    setCurrentPrefix(prefix);
  };

  // @ts-expect-error -- this is fine for now TODO: fix
  const filterOption = (input: string, { display, value }: OptionProps) => {
    // Because we handle emoji list rendering via a query we can't also filter by display
    if (currentPrefix === PREFIX.EMOJI) {
      return true;
    }

    const lowerInput = input?.toLowerCase();
    const lowerDisplay = display?.toLowerCase();
    const lowerValue = value?.toLowerCase();
    return lowerDisplay?.indexOf(lowerInput) !== -1 || lowerValue?.indexOf(lowerInput) !== -1;
  };

  const handleSelect = (option: OptionProps, prefix: string) => {
    if (!isPrefix(prefix)) {
      return;
    }

    /**
     * Emoji mention searching removes the `:` prefix, so we need to handle this case manually
     */
    if (prefix === PREFIX.EMOJI) {
      const val = option.value ?? '';
      const pos = getCurrentCursorPosition();
      const searchInput = prefix + mentionSearch;

      /**
       * Finds the start of the emoji search input, it returns the last occurrence of the user's
       * search input, not going past the user's cursor. This means the text we are going to remove
       * is the text the user input into the search, so it is safe to replace it with the emoji.
       */
      const inputStart = draft.lastIndexOf(searchInput, pos);
      const draftStart = draft.substring(0, inputStart);
      const draftEnd = draft.substring(inputStart + searchInput.length, draft.length + 1);
      const newDraft = draftStart + val + draftEnd;
      setDraft(newDraft);

      // The timeout ensures the cursor placement happens after the input has been updated, without it the cursor placement is incorrect.
      setTimeout(() => {
        updateCursorPosition(draftStart.length + val.length);
      }, 25);
    }

    setCurrentPrefix(null);
    setMentionSearch('');
    setEmojiResults([]);
    setIsMentioning(false);
  };

  return (
    <>
      <div className="textarea-layout">
        <span>{draft}</span>
      </div>
      <Mentions
        value={draft}
        onChange={handleOnChange}
        onKeyDown={onKeyDown}
        onKeyUp={handleKeyUp}
        placeholder={messagePlaceHolder}
        spellCheck={true}
        dir={htmlDirection}
        disabled={!typingEnabled}
        data-testid="message-input-text-area"
        className="textarea-container"
        prefix={prefixes}
        autoFocus={true}
        filterOption={filterOption}
        ref={textAreaRef}
        onSearch={handleSearch}
        onSelect={handleSelect}
        notFoundContent={null}
      >
        {currentPrefix === PREFIX.USER
          ? membersInThisChat.map(({ id, display }) => (
              // @ts-expect-error -- display is fine here TODO: fix
              <Mentions.Option value={id} display={display} key={id}>
                {renderUserMentionRow(id)}
              </Mentions.Option>
            ))
          : currentPrefix === PREFIX.EMOJI
            ? emojiResults.map(({ id, display }) => (
                // @ts-expect-error -- display is fine here TODO: fix
                <Mentions.Option value={id} display={display} key={id}>
                  {renderEmojiQuickResultRow(id, display)}
                </Mentions.Option>
              ))
            : null}
      </Mentions>
    </>
  );
};
