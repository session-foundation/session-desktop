/* eslint-disable @typescript-eslint/no-misused-promises */
import {
  Dispatch,
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useRef,
  useState,
  RefObject,
} from 'react';

import { isNil, isNumber, isString } from 'lodash';
import { ItemParams, Menu } from 'react-contexify';
import styled from 'styled-components';
import { toNumber } from 'lodash/fp';
import useClickAway from 'react-use/lib/useClickAway';
import useUpdate from 'react-use/lib/useUpdate';
import { getAppDispatch } from '../../../../state/dispatch';
import { Data } from '../../../../data/data';

import { MessageInteraction } from '../../../../interactions';
import { replyToMessage } from '../../../../interactions/conversationInteractions';
import { MessageRenderingProps } from '../../../../models/messageType';
import { pushUnblockToSend } from '../../../../session/utils/Toast';
import {
  openRightPanel,
  showMessageInfoView,
  toggleSelectedMessageId,
} from '../../../../state/ducks/conversations';
import {
  useMessageAttachments,
  useMessageBody,
  useMessageDirection,
  useMessageIsDeletable,
  useMessageSender,
  useMessageSenderIsAdmin,
  useMessageServerTimestamp,
  useMessageStatus,
  useMessageTimestamp,
} from '../../../../state/selectors';
import {
  useSelectedConversationKey,
  useSelectedIsBlocked,
  useSelectedIsLegacyGroup,
} from '../../../../state/selectors/selectedConversation';
import { saveAttachmentToDisk } from '../../../../util/attachment/attachmentsUtil';
import { Reactions } from '../../../../util/reactions';
import { SessionContextMenuContainer } from '../../../SessionContextMenuContainer';
import { MessageReactBar } from './MessageReactBar';
import { CopyAccountIdMenuItem } from '../../../menu/items/CopyAccountId/CopyAccountIdMenuItem';
import { Localizer } from '../../../basic/Localizer';
import { ItemWithDataTestId } from '../../../menu/items/MenuItemWithDataTestId';
import { getMenuAnimation } from '../../../menu/MenuAnimation';
import { WithMessageId } from '../../../../session/types/with';
import { DeleteItem } from '../../../menu/items/DeleteMessage/DeleteMessageMenuItem';
import { RetryItem } from '../../../menu/items/RetrySend/RetrySendMenuItem';
import { useBanUserCb } from '../../../menuAndSettingsHooks/useBanUser';
import { useUnbanUserCb } from '../../../menuAndSettingsHooks/useUnbanUser';
import { tr } from '../../../../localization/localeTools';
import { sectionActions } from '../../../../state/ducks/section';
import { useRemoveSenderFromCommunityAdmin } from '../../../menuAndSettingsHooks/useRemoveSenderFromCommunityAdmin';
import { useAddSenderAsCommunityAdmin } from '../../../menuAndSettingsHooks/useAddSenderAsCommunityAdmin';
import { closeContextMenus, showContextMenu } from '../../../../util/contextMenu';
import { clampNumber } from '../../../../util/maths';
import { SessionEmojiPanelPopover } from '../../SessionEmojiPanelPopover';
import { SessionPopoverContent } from '../../../SessionPopover';
import { useTriggerPosition } from '../../../SessionTooltip';

export type MessageContextMenuSelectorProps = Pick<
  MessageRenderingProps,
  | 'sender'
  | 'direction'
  | 'status'
  | 'isDeletable'
  | 'isSenderAdmin'
  | 'text'
  | 'serverTimestamp'
  | 'timestamp'
>;

type Props = { messageId: string; contextMenuId: string; enableReactions: boolean };

const CONTEXTIFY_MENU_WIDTH_PX = 200;
const SCREEN_RIGHT_MARGIN_PX = 104;

export type ShowMessageContextMenuParams = {
  id: string;
  event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>;
  triggerPosition?: { x: number; y: number };
};

export function showMessageContextMenu({
  id,
  event,
  triggerPosition,
}: ShowMessageContextMenuParams) {
  // this is quite dirty but considering that we want the context menu of the message to show on click on the attachment
  // and the context menu save attachment item to save the right attachment I did not find a better way for now.
  // NOTE: If you change this, also make sure to update the `saveAttachment()`
  const attachmentIndexStr = (event?.target as any)?.parentElement?.getAttribute?.(
    'data-attachmentindex'
  );
  const attachmentIndex =
    isString(attachmentIndexStr) && !isNil(toNumber(attachmentIndexStr))
      ? toNumber(attachmentIndexStr)
      : 0;

  const MAX_TRIGGER_X = window.innerWidth - CONTEXTIFY_MENU_WIDTH_PX - SCREEN_RIGHT_MARGIN_PX;
  let _triggerPosition = triggerPosition;
  if (!_triggerPosition) {
    if (
      'clientX' in event &&
      'clientY' in event &&
      isNumber(event.clientX) &&
      isNumber(event.clientY)
    ) {
      _triggerPosition = { x: event.clientX, y: event.clientY };
    } else {
      throw new Error(
        '[showMessageContextMenu] when called without a MouseEvent and triggerPosition must be provided'
      );
    }
  }

  // NOTE: contextify seems to have window y overflow avoidance but not window x
  const position = { x: clampNumber(_triggerPosition.x, 0, MAX_TRIGGER_X), y: _triggerPosition.y };

  showContextMenu({
    id,
    event,
    position,
    props: {
      dataAttachmentIndex: attachmentIndex,
    },
  });
}

const StyledMessageContextMenu = styled.div`
  position: relative;
`;

/** const StyledEmojiPanelContainer = styled.div<{ x: number; y: number }>`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 101;

  ${StyledEmojiPanel} {
    position: absolute;
    left: ${props => `${props.x}px`};
    top: ${props => `${props.y}px`};
  }
`; */

const CommunityAdminActionItems = ({ messageId }: WithMessageId) => {
  const convoId = useSelectedConversationKey();

  const sender = useMessageSender(messageId);
  const isSenderAdmin = useMessageSenderIsAdmin(messageId);

  const banUserCb = useBanUserCb(convoId, sender);
  const unbanUserCb = useUnbanUserCb(convoId, sender);

  const removeSenderFromCommunityAdminCb = useRemoveSenderFromCommunityAdmin({
    conversationId: convoId,
    senderId: sender,
  });

  const addSenderAsCommunityAdminCb = useAddSenderAsCommunityAdmin({
    conversationId: convoId,
    senderId: sender,
  });

  // Note: add/removeSenderFromCommunityAdminCb can be null if we are a moderator only, see below
  if (!convoId || !sender || !banUserCb || !unbanUserCb) {
    return null;
  }

  return (
    <>
      <ItemWithDataTestId onClick={banUserCb}>{tr('banUser')}</ItemWithDataTestId>
      <ItemWithDataTestId onClick={unbanUserCb}>{tr('banUnbanUser')}</ItemWithDataTestId>
      {/* only an admin can promote/remove moderators from a community. Another moderator cannot. */}
      {isSenderAdmin ? (
        removeSenderFromCommunityAdminCb ? (
          <ItemWithDataTestId onClick={removeSenderFromCommunityAdminCb}>
            {tr('adminRemoveAsAdmin')}
          </ItemWithDataTestId>
        ) : null
      ) : addSenderAsCommunityAdminCb ? (
        <ItemWithDataTestId onClick={addSenderAsCommunityAdminCb}>
          {tr('adminPromoteToAdmin')}
        </ItemWithDataTestId>
      ) : null}
    </>
  );
};

export const showMessageInfoOverlay = async ({
  messageId,
  dispatch,
}: {
  messageId: string;
  dispatch: Dispatch<any>;
}) => {
  const found = await Data.getMessageById(messageId);
  if (found) {
    dispatch(showMessageInfoView(messageId));
    dispatch(
      sectionActions.setRightOverlayMode({
        type: 'message_info',
        params: { messageId, visibleAttachmentIndex: 0 },
      })
    );
    dispatch(openRightPanel());
  } else {
    window.log.warn(`[showMessageInfoOverlay] Message ${messageId} not found in db`);
  }
};

export const MessageContextMenu = (props: Props) => {
  const { messageId, contextMenuId, enableReactions } = props;
  const dispatch = getAppDispatch();

  const forceUpdate = useUpdate();
  const isLegacyGroup = useSelectedIsLegacyGroup();

  const isSelectedBlocked = useSelectedIsBlocked();
  const convoId = useSelectedConversationKey();

  const direction = useMessageDirection(messageId);
  const status = useMessageStatus(messageId);
  const isDeletable = useMessageIsDeletable(messageId);
  const text = useMessageBody(messageId);
  const attachments = useMessageAttachments(messageId);
  const timestamp = useMessageTimestamp(messageId);
  const serverTimestamp = useMessageServerTimestamp(messageId);
  const sender = useMessageSender(messageId);

  const isOutgoing = direction === 'outgoing';
  const isSent = status === 'sent' || status === 'read'; // a read message should be replyable

  const emojiPanelRef = useRef<HTMLDivElement>(null);
  const emojiPanelTriggerRef = useRef<HTMLElement>(null);
  const emojiReactionBarRef = useRef<HTMLDivElement>(null);

  const [showEmojiPanel, setShowEmojiPanel] = useState<boolean>(false);
  const [showEmojiBar, setShowEmojiBar] = useState<boolean>(false);

  const contextMenuInternalRef = useRef<HTMLDivElement | null>(null);

  const triggerPos = useTriggerPosition(contextMenuInternalRef);

  const [contextMenuVisible, setContextMenuVisible] = useState<boolean>(false);

  const emojiBarVisible = enableReactions && (contextMenuVisible || showEmojiBar);

  const onShow = (fromHidden: boolean) => {
    window.log.warn('goblin show');
    setContextMenuVisible(true);
  };

  const onHide = () => {
    window.log.warn('goblin hide');
    setContextMenuVisible(false);
  };

  const onReply = useCallback(() => {
    if (isSelectedBlocked) {
      pushUnblockToSend();
      return;
    }
    void replyToMessage(messageId);
  }, [isSelectedBlocked, messageId]);

  const copyText = useCallback(() => {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    // Note: we want to allow to copy through the "Copy" menu item the currently selected text, if any.
    MessageInteraction.copyBodyToClipboard(selectedText || text);
  }, [text]);

  const onSelect = useCallback(() => {
    dispatch(toggleSelectedMessageId(messageId));
  }, [dispatch, messageId]);

  const closeEmojiPanel = () => {
    closeContextMenus();
    setShowEmojiPanel(false);
  };

  const openEmojiPanel = () => {
    closeContextMenus();
    setShowEmojiPanel(true);
  };

  const onEmojiClick = async (args: any) => {
    const emoji = args.native ?? args;
    closeEmojiPanel();
    await Reactions.sendMessageReaction(messageId, emoji);
  };

  const saveAttachment = (e: ItemParams) => {
    // this is quite dirty but considering that we want the context menu of the message to show on click on the attachment
    // and the context menu save attachment item to save the right attachment I did not find a better way for now.
    // Note: If you change this, also make sure to update the `handleContextMenu()` in GenericReadableMessage.tsx
    const targetAttachmentIndex = isNumber(e?.props?.dataAttachmentIndex)
      ? e.props.dataAttachmentIndex
      : 0;
    e.event.stopPropagation();
    if (!attachments?.length || !convoId || !sender) {
      return;
    }

    if (targetAttachmentIndex > attachments.length) {
      return;
    }
    const messageTimestamp = timestamp || serverTimestamp || 0;
    void saveAttachmentToDisk({
      attachment: attachments[targetAttachmentIndex],
      messageTimestamp,
      messageSender: sender,
      conversationId: convoId,
      index: targetAttachmentIndex,
    });
  };

  useClickAway(emojiPanelRef, () => {
    if (showEmojiPanel) {
      closeEmojiPanel();
    }
  });

  useClickAway(emojiReactionBarRef, () => {
    if (emojiBarVisible) {
      forceUpdate();
    }
  });

  if (!convoId) {
    return null;
  }

  if (isLegacyGroup) {
    return (
      <StyledMessageContextMenu>
        <SessionContextMenuContainer>
          <Menu id={contextMenuId} animation={getMenuAnimation()}>
            {attachments?.length && attachments.every(m => !m.pending && m.path) ? (
              <ItemWithDataTestId onClick={saveAttachment}>{tr('save')}</ItemWithDataTestId>
            ) : null}
            <ItemWithDataTestId onClick={copyText}>{tr('copy')}</ItemWithDataTestId>
            <ItemWithDataTestId
              onClick={() => {
                void showMessageInfoOverlay({ messageId, dispatch });
              }}
            >
              <Localizer token="info" />
            </ItemWithDataTestId>
            {sender ? <CopyAccountIdMenuItem pubkey={sender} /> : null}
          </Menu>
        </SessionContextMenuContainer>
      </StyledMessageContextMenu>
    );
  }

  return (
    <>
      {enableReactions ? (
        <SessionEmojiPanelPopover
          emojiPanelRef={emojiPanelRef as RefObject<HTMLDivElement>}
          triggerRef={emojiPanelTriggerRef as RefObject<HTMLElement>}
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          onEmojiClicked={onEmojiClick}
          open={showEmojiPanel}
          onClose={closeEmojiPanel}
        />
      ) : null}
      <SessionPopoverContent
        triggerX={triggerPos.triggerX}
        triggerY={triggerPos.triggerY}
        triggerHeight={triggerPos.triggerHeight}
        // NOTE: Setting triggerWidth to 0 means the trigger center is 0/2=0, so
        // the popover will anchor from the far left of the trigger
        triggerWidth={0}
        open={emojiBarVisible}
        isTooltip={false}
        verticalPosition="top"
        horizontalPosition="right"
        fallbackContentHeight={48}
        fallbackContentWidth={295}
      >
        {emojiBarVisible ? (
          <MessageReactBar
            ref={emojiReactionBarRef as RefObject<HTMLDivElement>}
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            action={onEmojiClick}
            additionalAction={openEmojiPanel}
            messageId={messageId}
            emojiPanelTriggerRef={emojiPanelTriggerRef as RefObject<HTMLElement>}
          />
        ) : null}
      </SessionPopoverContent>
      <StyledMessageContextMenu>
        <SessionContextMenuContainer>
          <Menu
            ref={contextMenuInternalRef}
            id={contextMenuId}
            animation={getMenuAnimation()}
            onShow={onShow}
            onHide={onHide}
          >
            {attachments?.length && attachments.every(m => !m.pending && m.path) ? (
              <ItemWithDataTestId onClick={saveAttachment}>{tr('save')}</ItemWithDataTestId>
            ) : null}
            <ItemWithDataTestId onClick={copyText}>{tr('copy')}</ItemWithDataTestId>
            {(isSent || !isOutgoing) && (
              <ItemWithDataTestId onClick={onReply}>{tr('reply')}</ItemWithDataTestId>
            )}
            <ItemWithDataTestId
              onClick={() => {
                void showMessageInfoOverlay({ messageId, dispatch });
              }}
            >
              <Localizer token="info" />
            </ItemWithDataTestId>
            {sender ? <CopyAccountIdMenuItem pubkey={sender} /> : null}
            <RetryItem messageId={messageId} />
            {isDeletable ? (
              <ItemWithDataTestId onClick={onSelect}>
                <Localizer token="select" />
              </ItemWithDataTestId>
            ) : null}
            <DeleteItem messageId={messageId} />
            <CommunityAdminActionItems messageId={messageId} />
          </Menu>
        </SessionContextMenuContainer>
      </StyledMessageContextMenu>
    </>
  );
};
