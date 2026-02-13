// NOTE: [react-compiler] we are telling the compiler to not attempt to compile this
// file in the babel config as it is highly complex and has a lot of very fine tuned
// callbacks, its probably not worth trying to refactor at this stage

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
  type Dispatch,
  type MutableRefObject,
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
import { tEnglish, tr, type MergedLocalizerTokens } from '../../../localization/localeTools';
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
import { useKeyboardShortcut } from '../../../hooks/useKeyboardShortcut';
import { KbdShortcut } from '../../../util/keyboardShortcuts';
import { PopoverTriggerPosition } from '../../SessionTooltip';
import { getAppDispatch } from '../../../state/dispatch';
import { setIsCompositionTextAreaFocused } from '../../../state/ducks/conversations';

type Props = {
  initialDraft: string;
  draft: string;
  setDraft: (draft: string) => void;
  container: RefObject<HTMLDivElement | null>;
  inputRef: RefObject<CompositionInputRef | null>;
  typingEnabled: boolean;
  onKeyDown: KeyboardEventHandler<HTMLDivElement>;
};

type SearchableSuggestion = SessionSuggestionDataItem & { searchable?: Array<string> };

function useMembersInThisChat(): Array<SearchableSuggestion> {
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

    const nickname = model?.getNicknameOrRealUsernameOrPlaceholder();
    if (nickname) {
      searchable.push(nickname.toLowerCase());
    }

    const username = model?.getRealSessionUsername();
    if (username && username !== nickname) {
      searchable.push(username.toLowerCase());
    }

    const isYou = UserUtils.isUsFromCache(id);
    const display = isYou ? tr('you') : nickname || PubKey.shorten(id);

    if (display && display !== nickname) {
      searchable.push(display.toLowerCase());
      if (isYou) {
        const enYou = tEnglish('you');
        if (enYou !== display) {
          searchable.push(tEnglish('you').toLowerCase());
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
    pos,
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
    // NOTE: this prevents the emoji list from appearing if the user is typing a url
    const potentialUrlProtocol = val.slice(Math.max(0, emojiMention.pos - 5), emojiMention.pos);
    if (potentialUrlProtocol === 'https' || potentialUrlProtocol.endsWith('http')) {
      return null;
    }
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

function useMentionResults(mention: MentionDetails | null) {
  const membersInThisChat = useMembersInThisChat();
  return useMemo(
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
}

function useHandleSelect({
  focusedItem,
  handleMentionCleanup,
  inputRef,
  mention,
  results,
  setDraft,
}: {
  focusedItem: SearchableSuggestion;
  handleMentionCleanup: () => void;
  inputRef: RefObject<CompositionInputRef | null>;
  mention: MentionDetails | null;
  results: Array<SearchableSuggestion>;
  setDraft: Dispatch<string>;
}) {
  return useCallback(
    (item?: SessionSuggestionDataItem) => {
      const selected = item ?? focusedItem;
      if (!mention || !results.length || !selected) {
        return;
      }

      const val = mention.prefix === PREFIX.EMOJI ? selected.id : createUserMentionHtml(selected);

      const searchInput = mention.prefix + mention.content;
      if (inputRef.current?.getVisibleText() === searchInput) {
        setDraft(val);
      } else {
        inputRef.current?.typeAtCaret(val, searchInput.length);
      }
      handleMentionCleanup();
    },
    [focusedItem, mention, results.length, inputRef, handleMentionCleanup, setDraft]
  );
}

function usePopoverContent({
  focusedItem,
  handleSelect,
  mention,
  results,
  selectedMentionRef,
}: {
  focusedItem: SearchableSuggestion;
  handleSelect: (item?: SessionSuggestionDataItem) => void;
  mention: MentionDetails | null;
  results: Array<SearchableSuggestion>;
  selectedMentionRef: MutableRefObject<HTMLLIElement | null>;
}) {
  const selectedConvoKey = useSelectedConversationKey();
  return useMemo(() => {
    if (!mention || !results.length) {
      return null;
    }
    return (
      <ul role="listbox" data-testid="mentions-container">
        {results.map(item => {
          const { id, display } = item;
          const selected = focusedItem.id === id;
          return (
            <li
              role="option"
              data-testid="mentions-container-row"
              id={id}
              key={id}
              value={id}
              onClick={() => handleSelect(item)}
              className={selected ? 'selected-option' : undefined}
              autoFocus={selected}
              aria-selected={selected}
              ref={selected ? selectedMentionRef : undefined}
            >
              {mention.prefix === PREFIX.USER
                ? renderUserMentionRow(id, selectedConvoKey)
                : renderEmojiQuickResultRow(id, display)}
            </li>
          );
        })}
      </ul>
    );
  }, [mention, focusedItem, handleSelect, selectedConvoKey, results, selectedMentionRef]);
}

function useMessagePlaceholder() {
  const isKickedFromGroup = useSelectedIsKickedFromGroup();
  const isGroupDestroyed = useSelectedIsGroupDestroyed();
  const isBlocked = useSelectedIsBlocked();
  const groupName = useSelectedNicknameOrProfileNameOrShortenedPubkey();

  return useMemo(() => {
    let localizerToken: MergedLocalizerTokens = 'message';
    if (isGroupDestroyed) {
      localizerToken = 'groupDeletedMemberDescription';
    } else if (isKickedFromGroup) {
      localizerToken = 'groupRemovedYou';
    } else if (isBlocked) {
      localizerToken = 'blockBlockedDescription';
    }
    return tr(localizerToken, { group_name: groupName });
  }, [groupName, isBlocked, isGroupDestroyed, isKickedFromGroup]);
}

function useHandleKeyDown({
  draft,
  mention,
  results,
  focusedItem,
  handleSelect,
  inputRef,
  setFocusedMentionItem,
  onKeyDown,
  handleMentionCleanup,
  handleMentionCheck,
}: {
  draft: string;
  focusedItem: SearchableSuggestion;
  handleMentionCheck: (content: string, htmlIndex?: number | null) => void;
  handleMentionCleanup: () => void;
  handleSelect: (item?: SessionSuggestionDataItem) => void;
  inputRef: RefObject<CompositionInputRef | null>;
  mention: MentionDetails | null;
  onKeyDown: KeyboardEventHandler<HTMLDivElement>;
  results: Array<SearchableSuggestion>;
  setFocusedMentionItem: Dispatch<SearchableSuggestion>;
}) {
  const htmlDirection = useHTMLDirection();
  return useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!mention) {
        onKeyDown(e);
        return;
      }

      if (e.key === 'Escape') {
        // Exit mention mode and disable escape default behaviour
        e.preventDefault();
        handleMentionCleanup();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        // Navigate through mentions options and disable input text navigation
        e.preventDefault();
        const idx = results.findIndex(({ id }) => id === focusedItem?.id);

        if (idx !== -1) {
          let newIdx = 0;
          if (e.key === 'ArrowDown') {
            newIdx = idx === results.length - 1 ? 0 : idx + 1;
          } else if (e.key === 'ArrowUp') {
            newIdx = idx ? idx - 1 : results.length - 1;
          }

          const item = results[newIdx];
          if (item) {
            setFocusedMentionItem(item);
          }
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // Update mention search content for where the new cursor position will be
        const pos = inputRef.current?.getCaretIndex() ?? 0;
        const dirModifier = htmlDirection === 'ltr' ? 1 : -1;
        const delta = (e.key === 'ArrowRight' ? 1 : -1) * dirModifier;
        handleMentionCheck(draft, pos + delta);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
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
          // The Enter key can insert new lines and/or send a message, and the tab key will increment
          // the tab index, focusing a new element. We want to prevent this when selecting a mention.
          e.preventDefault();
          handleSelect();
        }
      } else {
        onKeyDown(e);
      }
    },
    [
      draft,
      focusedItem,
      handleMentionCheck,
      handleMentionCleanup,
      handleSelect,
      htmlDirection,
      inputRef,
      mention,
      onKeyDown,
      results,
      setFocusedMentionItem,
    ]
  );
}

function useHandleKeyUp({
  draft,
  lastBumpTypingMessageLength,
  selectedConversationKey,
  setLastBumpTypingMessageLength,
}: {
  draft: string;
  lastBumpTypingMessageLength: number;
  selectedConversationKey?: string;
  setLastBumpTypingMessageLength: Dispatch<number>;
}) {
  return useCallback(() => {
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
  }, [draft, lastBumpTypingMessageLength, selectedConversationKey, setLastBumpTypingMessageLength]);
}

export function CompositionTextArea(props: Props) {
  const { draft, initialDraft, setDraft, inputRef, typingEnabled, onKeyDown } = props;

  const dispatch = getAppDispatch();
  const [lastBumpTypingMessageLength, setLastBumpTypingMessageLength] = useState(0);
  const [mention, setMention] = useState<MentionDetails | null>(null);
  const [focusedMentionItem, setFocusedMentionItem] = useState<SessionSuggestionDataItem | null>(
    null
  );
  const [popoverTriggerPos, setPopoverTriggerPos] = useState<PopoverTriggerPosition | null>(null);

  const selectedConversationKey = useSelectedConversationKey();
  const messagePlaceHolder = useMessagePlaceholder();
  const selectedMentionRef = useRef<HTMLLIElement | null>(null);

  useDebugInputCommands({ value: draft, setValue: setDraft });

  const handleMentionCleanup = useCallback(() => {
    setMention(null);
    setFocusedMentionItem(null);
    setPopoverTriggerPos(null);
  }, []);

  /**
   * Resets the state when the conversation id changes
   * TODO: remove this once the CompositionBox has become a functional component and we don't need to rely on the
   *   conversation id state
   */
  useEffect(() => {
    handleMentionCleanup();
    inputRef.current?.resetState(initialDraft);
    inputRef.current?.focus();
  }, [handleMentionCleanup, initialDraft, inputRef, selectedConversationKey]);

  const results = useMentionResults(mention);

  /**
   * The focused item should remain selected as long as it is one of the results. This means if you have focused
   * the 3rd result "Alice" and continue to type such that "Alice" becomes the second result, "Alice" is still
   * focused. If you continue typing such that "Alice" is no longer one of the results, the first result will become
   * the focused result until "Alice" is visible again, or you focus a new result.
   */
  const focusedItem = useMemo(
    () => results.find(({ id }) => focusedMentionItem?.id === id) ?? results[0],
    [results, focusedMentionItem]
  );

  const handleSelect = useHandleSelect({
    focusedItem,
    handleMentionCleanup,
    inputRef,
    mention,
    results,
    setDraft,
  });

  const popoverContent = usePopoverContent({
    focusedItem,
    handleSelect,
    mention,
    results,
    selectedMentionRef,
  });

  const handleUpdatePopoverPosition = useCallback(() => {
    const pos = inputRef.current?.getCaretCoordinates();
    if (pos) {
      setPopoverTriggerPos({ x: pos.left, y: pos.top - 6, height: 18, width: 1 });
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

  const handleKeyUp = useHandleKeyUp({
    draft,
    lastBumpTypingMessageLength,
    selectedConversationKey,
    setLastBumpTypingMessageLength,
  });

  const handleMentionCheck = useCallback((content: string, htmlIndex?: number | null) => {
    const pos = htmlIndex ?? content.length;
    const newMention = getMentionDetails(
      content,
      pos,
      LIBSESSION_CONSTANTS.CONTACT_MAX_NAME_LENGTH
    );
    setMention(newMention);
  }, []);

  const handleKeyDown = useHandleKeyDown({
    draft,
    focusedItem,
    handleMentionCheck,
    handleMentionCleanup,
    handleSelect,
    inputRef,
    mention,
    onKeyDown,
    results,
    setFocusedMentionItem,
  });

  const handleOnChange = useCallback(
    (e: ContentEditableEvent) => {
      if (!selectedConversationKey) {
        throw new Error('selectedConversationKey is needed');
      }

      const content = e.target.value;

      handleMentionCheck(content, e.target.caretIndex);
      setDraft(content);
      updateDraftForConversation({ conversationKey: selectedConversationKey, draft: content });
    },
    [handleMentionCheck, selectedConversationKey, setDraft]
  );

  useKeyboardShortcut({
    shortcut: KbdShortcut.conversationFocusTextArea,
    handler: () => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    },
  });

  const onFocus = () => {
    dispatch(setIsCompositionTextAreaFocused(true));
  };

  const onBlur = () => {
    dispatch(setIsCompositionTextAreaFocused(false));
  };

  if (!selectedConversationKey) {
    return null;
  }

  const showPopover = !!(popoverTriggerPos && popoverContent);

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
        autoFocus={false}
        ref={inputRef}
        $scrollbarPadding={140}
        autoCorrect="off"
        aria-haspopup="listbox"
        aria-autocomplete="list"
        aria-label={messagePlaceHolder}
        data-testid="message-input-text-area"
        // NOTE: we want to close any mentions when clicking within the input as clicking will invalidate the cursor position
        onClick={handleMentionCleanup}
        onFocus={onFocus}
        onBlur={onBlur}
      />
      {showPopover ? (
        <SessionPopoverContent
          className="mention-container"
          open={showPopover}
          triggerPosition={popoverTriggerPos}
          horizontalPosition="right"
          verticalPosition="top"
        >
          {popoverContent}
        </SessionPopoverContent>
      ) : null}
    </>
  );
}
