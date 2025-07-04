/* eslint-disable @typescript-eslint/no-misused-promises */
import { Dispatch, useCallback, useEffect, useRef, useState } from 'react';

import { isNumber } from 'lodash';
import { ItemParams, Menu, useContextMenu } from 'react-contexify';
import { useDispatch } from 'react-redux';
import useClickAway from 'react-use/lib/useClickAway';
import useMouse from 'react-use/lib/useMouse';
import styled from 'styled-components';
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
import { saveAttachmentToDisk } from '../../../../util/attachmentsUtil';
import { Reactions } from '../../../../util/reactions';
import { SessionContextMenuContainer } from '../../../SessionContextMenuContainer';
import { SessionEmojiPanel, StyledEmojiPanel } from '../../SessionEmojiPanel';
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
import {
  sogsV3RemoveAdmins,
  sogsV3AddAdmin,
} from '../../../../session/apis/open_group_api/sogsv3/sogsV3AddRemoveMods';
import { ConvoHub } from '../../../../session/conversations';
import { PubKey } from '../../../../session/types';
import { ToastUtils } from '../../../../session/utils';
import { localize } from '../../../../localization/localeTools';
import { sectionActions } from '../../../../state/ducks/section';

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

const StyledMessageContextMenu = styled.div`
  position: relative;

  .contexify {
    margin-left: -104px;
  }
`;

const StyledEmojiPanelContainer = styled.div<{ x: number; y: number }>`
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
`;

async function removeSenderFromCommunityAdmin(sender: string, convoId: string) {
  try {
    const pubKeyToRemove = PubKey.cast(sender);
    const convo = ConvoHub.use().getOrThrow(convoId);

    const userDisplayName =
      ConvoHub.use().get(sender)?.getNicknameOrRealUsernameOrPlaceholder() ||
      localize('unknown').toString();

    const roomInfo = convo.toOpenGroupV2();
    const res = await sogsV3RemoveAdmins([pubKeyToRemove], roomInfo);
    if (!res) {
      window?.log?.warn('failed to remove moderator:', res);

      ToastUtils.pushFailedToRemoveFromModerator([userDisplayName]);
    } else {
      window?.log?.info(`${pubKeyToRemove.key} removed from moderators...`);
      ToastUtils.pushUserRemovedFromModerators([userDisplayName]);
    }
  } catch (e) {
    window?.log?.error('Got error while removing moderator:', e);
  }
}

async function addSenderAsCommunityAdmin(sender: string, convoId: string) {
  try {
    const pubKeyToAdd = PubKey.cast(sender);
    const convo = ConvoHub.use().getOrThrow(convoId);

    const roomInfo = convo.toOpenGroupV2();
    const res = await sogsV3AddAdmin([pubKeyToAdd], roomInfo);
    if (!res) {
      window?.log?.warn('failed to add moderator:', res);

      ToastUtils.pushFailedToAddAsModerator();
    } else {
      window?.log?.info(`${pubKeyToAdd.key} added to moderators...`);
      const userDisplayName =
        ConvoHub.use().get(sender)?.getNicknameOrRealUsernameOrPlaceholder() ||
        localize('unknown').toString();
      ToastUtils.pushUserAddedToModerators([userDisplayName]);
    }
  } catch (e) {
    window?.log?.error('Got error while adding moderator:', e);
  }
}

const CommunityAdminActionItems = ({ messageId }: WithMessageId) => {
  const convoId = useSelectedConversationKey();

  const sender = useMessageSender(messageId);
  const isSenderAdmin = useMessageSenderIsAdmin(messageId);

  const banUserCb = useBanUserCb(convoId, sender);
  const unbanUserCb = useUnbanUserCb(convoId, sender);

  if (!convoId || !sender || !banUserCb || !unbanUserCb) {
    return null;
  }

  /**
   * Ideally we'd make those calls use a loader, but because this is part of the message context
   * menu, we don't have one.
   * Also, those are not using the `useRemoveModeratorsCb/useAddModeratorsCb` hooks.
   * The reason is that when we do the action as part of the message context menu,
   * we want to do the action of the right-clicked user, without showing the corresponding modal.
   */
  const addModerator = () => {
    void addSenderAsCommunityAdmin(sender, convoId);
  };

  const removeModerator = () => {
    void removeSenderFromCommunityAdmin(sender, convoId);
  };

  return (
    <>
      <ItemWithDataTestId onClick={banUserCb}>{localize('banUser')}</ItemWithDataTestId>
      <ItemWithDataTestId onClick={unbanUserCb}>{localize('banUnbanUser')}</ItemWithDataTestId>
      {isSenderAdmin ? (
        <ItemWithDataTestId onClick={removeModerator}>
          {localize('adminRemoveAsAdmin')}
        </ItemWithDataTestId>
      ) : (
        <ItemWithDataTestId onClick={addModerator}>
          {localize('adminPromoteToAdmin')}
        </ItemWithDataTestId>
      )}
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
  const dispatch = useDispatch();
  const { hideAll } = useContextMenu();
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
  const [showEmojiPanel, setShowEmojiPanel] = useState(false);
  // emoji-mart v5.2.2 default dimensions
  const emojiPanelWidth = 354;
  const emojiPanelHeight = 435;

  const contextMenuRef = useRef(null);
  const { docX, docY } = useMouse(contextMenuRef);
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);

  const onVisibilityChange = useCallback(
    (isVisible: boolean) => {
      if (isVisible) {
        if (showEmojiPanel) {
          setShowEmojiPanel(false);
        }
        window.contextMenuShown = true;
        return;
      }
      // This function will called before the click event
      // on the message would trigger (and I was unable to
      // prevent propagation in this case), so use a short timeout
      setTimeout(() => {
        window.contextMenuShown = false;
      }, 100);
    },
    [showEmojiPanel]
  );

  const onReply = useCallback(() => {
    if (isSelectedBlocked) {
      pushUnblockToSend();
      return;
    }
    void replyToMessage(messageId);
  }, [isSelectedBlocked, messageId]);

  const copyText = useCallback(() => {
    MessageInteraction.copyBodyToClipboard(text);
  }, [text]);

  const onSelect = useCallback(() => {
    dispatch(toggleSelectedMessageId(messageId));
  }, [dispatch, messageId]);

  const onShowEmoji = () => {
    hideAll();
    setMouseX(docX);
    setMouseY(docY);
    setShowEmojiPanel(true);
  };

  const onCloseEmoji = () => {
    setShowEmojiPanel(false);
    hideAll();
  };

  const onEmojiLoseFocus = () => {
    window.log.debug('closed due to lost focus');
    onCloseEmoji();
  };

  const onEmojiClick = async (args: any) => {
    const emoji = args.native ?? args;
    onCloseEmoji();
    await Reactions.sendMessageReaction(messageId, emoji);
  };

  const onEmojiKeyDown = (event: any) => {
    if (event.key === 'Escape' && showEmojiPanel) {
      onCloseEmoji();
    }
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
    onEmojiLoseFocus();
  });

  useEffect(() => {
    if (emojiPanelRef.current) {
      const { innerWidth: windowWidth, innerHeight: windowHeight } = window;

      if (mouseX + emojiPanelWidth > windowWidth) {
        let x = mouseX;
        x = (mouseX + emojiPanelWidth - windowWidth) * 2;

        if (x === mouseX) {
          return;
        }
        setMouseX(mouseX - x);
      }

      if (mouseY + emojiPanelHeight > windowHeight) {
        const y = mouseY + emojiPanelHeight * 1.25 - windowHeight;

        if (y === mouseY) {
          return;
        }
        setMouseY(mouseY - y);
      }
    }
  }, [emojiPanelWidth, emojiPanelHeight, mouseX, mouseY]);

  if (!convoId) {
    return null;
  }

  if (isLegacyGroup) {
    return (
      <StyledMessageContextMenu ref={contextMenuRef}>
        <SessionContextMenuContainer>
          <Menu
            id={contextMenuId}
            onVisibilityChange={onVisibilityChange}
            animation={getMenuAnimation()}
          >
            {attachments?.length && attachments.every(m => !m.pending && m.path) ? (
              <ItemWithDataTestId onClick={saveAttachment}>
                {localize('save').toString()}
              </ItemWithDataTestId>
            ) : null}
            <ItemWithDataTestId onClick={copyText}>
              {localize('copy').toString()}
            </ItemWithDataTestId>
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
    <StyledMessageContextMenu ref={contextMenuRef}>
      {enableReactions && showEmojiPanel && (
        <StyledEmojiPanelContainer role="button" x={mouseX} y={mouseY}>
          <SessionEmojiPanel
            ref={emojiPanelRef}
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onEmojiClicked={onEmojiClick}
            show={showEmojiPanel}
            isModal={true}
            onKeyDown={onEmojiKeyDown}
          />
        </StyledEmojiPanelContainer>
      )}
      <SessionContextMenuContainer>
        <Menu
          id={contextMenuId}
          onVisibilityChange={onVisibilityChange}
          animation={getMenuAnimation()}
        >
          {enableReactions && (
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            <MessageReactBar
              action={onEmojiClick}
              additionalAction={onShowEmoji}
              messageId={messageId}
            />
          )}
          {attachments?.length && attachments.every(m => !m.pending && m.path) ? (
            <ItemWithDataTestId onClick={saveAttachment}>
              {localize('save').toString()}
            </ItemWithDataTestId>
          ) : null}
          <ItemWithDataTestId onClick={copyText}>{localize('copy').toString()}</ItemWithDataTestId>
          {(isSent || !isOutgoing) && (
            <ItemWithDataTestId onClick={onReply}>
              {localize('reply').toString()}
            </ItemWithDataTestId>
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
  );
};
