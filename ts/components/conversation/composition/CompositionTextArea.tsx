import {
  type KeyboardEventHandler,
  type KeyboardEvent,
  RefObject,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useEffect,
} from 'react';
import { uniq } from 'lodash';
import { useSelector } from 'react-redux';
import { renderToString } from 'react-dom/server';
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
import { localize, type MergedLocalizerTokens } from '../../../localization/localeTools';
import { PubKey } from '../../../session/types';
import { useLibGroupMembers } from '../../../state/selectors/groups';
import { use05GroupMembers } from '../../../hooks/useParamSelector';
import CompositionInput, {
  type CompositionInputRef,
  type ContentEditableEvent,
  ZeroWidthNode,
} from './CompositionInput';
import { SessionPopoverContent } from '../../SessionPopover';
import LIBSESSION_CONSTANTS from '../../../session/utils/libsession/libsession_constants';
import { Mention } from '../AddMentions';
import { useDebugInputCommands } from '../../dialog/debug/hooks/useDebugInputCommands';

type Props = {
  draft: string;
  setDraft: (draft: string) => void;
  container: RefObject<HTMLDivElement>;
  inputRef: RefObject<CompositionInputRef>;
  typingEnabled: boolean;
  onKeyDown: KeyboardEventHandler<HTMLDivElement>;
};

function useMembersInThisChat(): Array<SessionSuggestionDataItem & { searchable?: Array<string> }> {
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

  const convo = ConvoHub.use();

  return members.map(id => {
    const model = convo.get(id);
    const searchable: Array<string> = [id];

    const nickname = model.getNicknameOrRealUsernameOrPlaceholder();
    if (nickname) {
      searchable.push(nickname.toLowerCase());
    }

    const username = model.getRealSessionUsername();
    if (username && username !== nickname) {
      searchable.push(username.toLowerCase());
    }

    const isYou = UserUtils.isUsFromCache(id);
    const display = isYou ? localize('you').toString() : nickname || PubKey.shorten(id);

    if (display && display !== nickname) {
      searchable.push(display.toLowerCase());
      if (isYou) {
        const enYou = localize('you').forceEnglish().toString();
        if (enYou !== display) {
          searchable.push(localize('you').forceEnglish().toString().toLowerCase());
        }
      }
    }

    return {
      id,
      display,
      searchable,
    };
  });
}

enum PREFIX {
  USER = '@',
  EMOJI = ':',
}

type MentionDetails = {
  prefix: PREFIX;
  content: string;
};

const MENTION_ESCAPE_STRINGS = [' ', '\n'];

function findValidMention(val: string, cursorPosition: number, prefix: PREFIX) {
  const pos = val.lastIndexOf(prefix);
  if (pos === -1) {
    return null;
  }

  const content = val.substring(pos + 1, cursorPosition);

  if (MENTION_ESCAPE_STRINGS.some(char => content.lastIndexOf(char) !== -1)) {
    return null;
  }

  return {
    content,
    prefix,
  };
}

function getMentionDetails(
  val: string,
  cursorPosition: number,
  maxLength: number
): MentionDetails | null {
  if (!val || cursorPosition > val.length || maxLength <= 0) {
    return null;
  }

  const startIdx = Math.max(0, cursorPosition - maxLength);
  const searchableVal = val.slice(startIdx, cursorPosition);

  const userMention = findValidMention(searchableVal, cursorPosition, PREFIX.USER);
  if (userMention) {
    return userMention;
  }

  const emojiMention = findValidMention(searchableVal, cursorPosition, PREFIX.EMOJI);
  if (emojiMention) {
    return emojiMention;
  }

  return null;
}

function createUserMentionHtml({ id, display }: SessionSuggestionDataItem) {
  return `${renderToString(
    <Mention dataUserId={id} key={id} text={display} inComposableElement={true}>
      <ZeroWidthNode />
    </Mention>
  )} `;
}

export const CompositionTextArea = (props: Props) => {
  const { draft, setDraft, inputRef, typingEnabled, onKeyDown } = props;

  const [lastBumpTypingMessageLength, setLastBumpTypingMessageLength] = useState(0);
  const [mention, setMention] = useState<MentionDetails | null>(null);
  const [focusedMentionItem, setFocusedMentionItem] = useState<number>(0);
  const [popoverX, setPopoverX] = useState<number | null>(null);
  const [popoverY, setPopoverY] = useState<number | null>(null);

  const selectedConversationKey = useSelectedConversationKey();
  const htmlDirection = useHTMLDirection();
  const isKickedFromGroup = useSelectedIsKickedFromGroup();
  const isGroupDestroyed = useSelectedIsGroupDestroyed();
  const isBlocked = useSelectedIsBlocked();
  const groupName = useSelectedNicknameOrProfileNameOrShortenedPubkey();
  const membersInThisChat = useMembersInThisChat();

  const selectedMentionRef = useRef<HTMLLIElement | null>(null);

  useDebugInputCommands({ value: draft, setValue: setDraft });

  const handleMentionCleanup = () => {
    setMention(null);
    setFocusedMentionItem(0);
    setPopoverX(null);
  };

  /**
   * Resets the state when the conversation id changes
   * TODO: remove this once the CompositionBox has become a functional component and we don't need to rely on the
   *   conversation id state
   */
  useEffect(() => {
    handleMentionCleanup();
  }, [selectedConversationKey]);

  const results = useMemo(
    () =>
      mention?.prefix === PREFIX.USER
        ? membersInThisChat
            .filter(({ id, display, searchable }) => {
              if (!mention.content) {
                return true;
              }

              const lowerInput = mention.content.toLowerCase();
              if (searchable) {
                return searchable.some(str => str.indexOf(lowerInput) !== -1);
              }

              const lowerDisplay = display.toLowerCase();
              const lowerId = id.toLowerCase();
              return (
                lowerDisplay?.indexOf(lowerInput) !== -1 || lowerId?.indexOf(lowerInput) !== -1
              );
            })
            .sort(({ id }) => (UserUtils.isUsFromCache(id) ? -1 : 1))
        : mention?.prefix === PREFIX.EMOJI
          ? searchEmojiForQuery(mention.content, 10)
          : [],
    [membersInThisChat, mention]
  );

  const handleSelect = useCallback(
    (idx?: number) => {
      const index = idx ?? focusedMentionItem;
      if (!mention || !results.length || index >= results.length) {
        return;
      }

      const selected = results[index];
      const val = mention.prefix === PREFIX.EMOJI ? selected.id : createUserMentionHtml(selected);

      const searchInput = mention.prefix + mention.content;
      if (inputRef.current?.getVisibleText() === searchInput) {
        setDraft(val);
        handleMentionCleanup();
        return;
      }

      /**
       *  We cant use the input's typeAtPosition because we need to be able to remove the search text.
       *  TODO: It would be nice to have a function on the input that handles replacement of a html index range.
       */
      const pos = inputRef.current?.getCaretIndex() ?? draft.length;

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
        inputRef.current?.setCaretIndex(draftStart.length + val.length);
        /**
         * This is a workaround to force an update of the input node and trigger a re-render of the
         * character counter. Without this, when a mention is selected and inserted the character
         * count does not update until another character is entered or removed by the user.
         */
        // inputRef.current?.typeAtCaret('');
      }, 25);
      handleMentionCleanup();
    },
    [draft, focusedMentionItem, inputRef, mention, results, setDraft]
  );

  const handleOptionClick = useCallback(
    (idx: number) => {
      setFocusedMentionItem(idx);
      handleSelect(idx);
    },
    [setFocusedMentionItem, handleSelect]
  );

  const popoverContent = useMemo(() => {
    if (!mention || !results.length) {
      return null;
    }

    const selectedId = results[focusedMentionItem]?.id;
    return (
      <ul role="listbox">
        {results.map(({ id, display }, i) => {
          const selected = selectedId === id;
          return (
            <li
              role="option"
              id={id}
              key={id}
              value={id}
              onClick={() => handleOptionClick(i)}
              className={selected ? 'selected-option' : undefined}
              autoFocus={selected}
              aria-selected={selected}
              ref={selected ? selectedMentionRef : undefined}
            >
              {mention.prefix === PREFIX.USER
                ? renderUserMentionRow(id)
                : renderEmojiQuickResultRow(id, display)}
            </li>
          );
        })}
      </ul>
    );
  }, [mention, results, focusedMentionItem, handleOptionClick]);

  const handleUpdatePopoverPosition = useCallback(() => {
    const pos = inputRef.current?.getCaretCoordinates();
    if (pos) {
      setPopoverX(pos.left);
      setPopoverY(pos.top - 6);
    }
  }, [inputRef]);

  /** Handles scrolling of the mentions container */
  useLayoutEffect(() => {
    if (mention) {
      handleUpdatePopoverPosition();
      const el = selectedMentionRef.current;
      if (el) {
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }
  }, [mention, focusedMentionItem, handleUpdatePopoverPosition]);

  const messagePlaceHolder = useMemo(() => {
    let localizerToken: MergedLocalizerTokens = 'message';
    if (isGroupDestroyed) {
      localizerToken = 'groupDeletedMemberDescription';
    } else if (isKickedFromGroup) {
      localizerToken = 'groupRemovedYou';
    } else if (isBlocked) {
      localizerToken = 'blockBlockedDescription';
    }
    return localize(localizerToken).withArgs({ group_name: groupName }).toString();
  }, [groupName, isBlocked, isGroupDestroyed, isKickedFromGroup]);

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

  const handleMentionCheck = useCallback((content: string, htmlIndex?: number | null) => {
    const pos = htmlIndex ?? content.length;
    const newMention = getMentionDetails(
      content,
      pos,
      LIBSESSION_CONSTANTS.CONTACT_MAX_NAME_LENGTH
    );
    setMention(newMention);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!mention) {
        onKeyDown(e);
        return;
      }

      if (e.key === 'Escape') {
        // Exit mention mode and disable escape default behaviour
        e.preventDefault();
        handleMentionCleanup();
      } else if (e.key === 'ArrowUp') {
        // Navigate through mentions options and disable input text navigation
        e.preventDefault();
        setFocusedMentionItem(prev => (prev === 0 ? results.length - 1 : prev - 1));
      } else if (e.key === 'ArrowDown') {
        // Navigate through mentions options and disable input text navigation
        e.preventDefault();
        setFocusedMentionItem(prev => (prev === results.length - 1 ? 0 : prev + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // Update mention search content for where the new cursor position will be
        const pos = inputRef.current?.getCaretIndex() ?? 0;
        const dirModifier = htmlDirection === 'ltr' ? 1 : -1;
        const delta = (e.key === 'ArrowRight' ? 1 : -1) * dirModifier;
        handleMentionCheck(draft, pos + delta);
      } else if (e.key === 'Enter') {
        /**
         *  Exit mention mode and hand off control to the parent onKeyDown if there are no mention results.
         *  We can't use `mention.content` to define this behaviour because for user mentions we count
         *  "mention mode" as having just the @ prefix, but for emoji mentions, mention mode needs a
         *  prefix and content.
         */
        if (!results.length) {
          handleMentionCleanup();
          onKeyDown(e);
        } else {
          // The Enter key can insert new lines and/or send a message, we want to prevent then when selecting a mention.
          e.preventDefault();
          handleSelect();
        }
      } else {
        onKeyDown(e);
      }
    },
    [
      draft,
      handleMentionCheck,
      handleSelect,
      htmlDirection,
      inputRef,
      mention,
      onKeyDown,
      results.length,
    ]
  );

  const handleOnChange = useCallback(
    (e: ContentEditableEvent) => {
      if (!selectedConversationKey) {
        throw new Error('selectedConversationKey is needed');
      }

      const content = e.target.value;

      handleMentionCheck(content, e.target.caratHtmlIndex);
      setDraft(content);
      updateDraftForConversation({ conversationKey: selectedConversationKey, draft: content });
    },
    [handleMentionCheck, selectedConversationKey, setDraft]
  );

  if (!selectedConversationKey) {
    return null;
  }

  const showPopover = !!(popoverX && popoverY && popoverContent);

  return (
    <>
      <CompositionInput
        placeholder={messagePlaceHolder}
        html={draft}
        onChange={handleOnChange}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        spellCheck={true}
        disabled={!typingEnabled}
        autoFocus={true}
        ref={inputRef}
        scrollbarPadding={140}
        autoCorrect="off"
        aria-haspopup="listbox"
        aria-autocomplete="list"
        aria-label={messagePlaceHolder}
      />
      {showPopover ? (
        <SessionPopoverContent
          className="mention-container"
          open={showPopover}
          triggerX={popoverX}
          triggerY={popoverY}
          triggerHeight={18}
          triggerWidth={1}
          horizontalPosition="right"
        >
          {popoverContent}
        </SessionPopoverContent>
      ) : null}
    </>
  );
};
