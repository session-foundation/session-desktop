/* eslint-disable @typescript-eslint/no-misused-promises */
import { Dispatch, type KeyboardEvent, type MouseEvent, useRef } from 'react';

import { isNil, isNumber, isString } from 'lodash';
import { MenuOnHideCallback, MenuOnShowCallback } from 'react-contexify';
import styled from 'styled-components';
import { toNumber } from 'lodash/fp';
import { getAppDispatch } from '../../../../state/dispatch';
import { Data } from '../../../../data/data';

import { MessageRenderingProps } from '../../../../models/messageType';
import { openRightPanel, showMessageInfoView } from '../../../../state/ducks/conversations';
import {
  useMessageAttachments,
  useMessageDirection,
  useMessageIsControlMessage,
  useMessageIsDeleted,
  useMessageSender,
  useMessageSenderIsAdmin,
  useMessageStatus,
} from '../../../../state/selectors';
import {
  useSelectedConversationKey,
  useSelectedIsLegacyGroup,
} from '../../../../state/selectors/selectedConversation';
import { SessionContextMenuContainer } from '../../../SessionContextMenuContainer';
import { CopyAccountIdMenuItem } from '../../../menu/items/CopyAccountId/CopyAccountIdMenuItem';
import { Localizer } from '../../../basic/Localizer';
import { Menu, MenuItem } from '../../../menu/items/MenuItem';
import { WithMessageId, type WithContextMenuId } from '../../../../session/types/with';
import { DeleteItem } from '../../../menu/items/DeleteMessage/DeleteMessageMenuItem';
import { RetryItem } from '../../../menu/items/RetrySend/RetrySendMenuItem';
import { useBanUserCb } from '../../../menuAndSettingsHooks/useBanUser';
import { useUnbanUserCb } from '../../../menuAndSettingsHooks/useUnbanUser';
import { tr } from '../../../../localization/localeTools';
import { sectionActions } from '../../../../state/ducks/section';
import { useRemoveSenderFromCommunityAdmin } from '../../../menuAndSettingsHooks/useRemoveSenderFromCommunityAdmin';
import { useAddSenderAsCommunityAdmin } from '../../../menuAndSettingsHooks/useAddSenderAsCommunityAdmin';
import { showContextMenu } from '../../../../util/contextMenu';
import { clampNumber } from '../../../../util/maths';
import { type WithSetPopoverPosition } from '../../../SessionTooltip';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';
import { SelectMessageMenuItem } from '../../../menu/items/SelectMessage/SelectMessageMenuItem';
import { useCopyText, useReply, useSaveAttachment } from '../../../../hooks/useMessageInteractions';

export type MessageContextMenuSelectorProps = Pick<
  MessageRenderingProps,
  'sender' | 'direction' | 'status' | 'isSenderAdmin' | 'text' | 'serverTimestamp' | 'timestamp'
>;

type Props = WithMessageId & WithContextMenuId & WithSetPopoverPosition;

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
      <MenuItem
        onClick={banUserCb}
        iconType={LUCIDE_ICONS_UNICODE.USER_ROUND_X}
        isDangerAction={true}
      >
        {tr('banUser')}
      </MenuItem>
      <MenuItem
        onClick={unbanUserCb}
        iconType={LUCIDE_ICONS_UNICODE.USER_ROUND_CHECK}
        isDangerAction={true}
      >
        {tr('banUnbanUser')}
      </MenuItem>
      {/* only an admin can promote/remove moderators from a community. Another moderator cannot. */}
      {isSenderAdmin ? (
        removeSenderFromCommunityAdminCb ? (
          <MenuItem
            onClick={removeSenderFromCommunityAdminCb}
            iconType="deleteModerator"
            isDangerAction={true}
          >
            {tr('adminRemoveAsAdmin')}
          </MenuItem>
        ) : null
      ) : addSenderAsCommunityAdminCb ? (
        <MenuItem
          onClick={addSenderAsCommunityAdminCb}
          iconType="addModerator"
          isDangerAction={true}
        >
          {tr('adminPromoteToAdmin')}
        </MenuItem>
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

function SaveAttachmentMenuItem({ messageId }: { messageId: string }) {
  const attachments = useMessageAttachments(messageId);
  const saveAttachment = useSaveAttachment(messageId);

  if (!saveAttachment) {
    return null;
  }

  return attachments?.length && attachments.every(m => !m.pending && m.path) ? (
    <MenuItem
      onClick={saveAttachment}
      iconType={LUCIDE_ICONS_UNICODE.ARROW_DOWN_TO_LINE}
      isDangerAction={false}
    >
      {tr('save')}
    </MenuItem>
  ) : null;
}

function MessageInfoMenuItem({ messageId }: { messageId: string }) {
  const dispatch = getAppDispatch();

  return (
    <MenuItem
      onClick={() => {
        void showMessageInfoOverlay({ messageId, dispatch });
      }}
      iconType={LUCIDE_ICONS_UNICODE.INFO}
      isDangerAction={false}
    >
      <Localizer token="info" />
    </MenuItem>
  );
}

function CopyBodyMenuItem({ messageId }: { messageId: string }) {
  const copyText = useCopyText(messageId);

  if (!copyText) {
    return null;
  }

  return (
    <MenuItem onClick={copyText} iconType={LUCIDE_ICONS_UNICODE.COPY} isDangerAction={false}>
      {tr('copy')}
    </MenuItem>
  );
}

export const MessageContextMenu = (props: Props) => {
  const { messageId, contextMenuId, setTriggerPosition } = props;

  const reply = useReply(messageId);

  const isLegacyGroup = useSelectedIsLegacyGroup();
  const convoId = useSelectedConversationKey();
  const direction = useMessageDirection(messageId);
  const status = useMessageStatus(messageId);
  const isDeleted = useMessageIsDeleted(messageId);
  const sender = useMessageSender(messageId);
  const isControlMessage = useMessageIsControlMessage(messageId);

  const isOutgoing = direction === 'outgoing';
  const isSent = status === 'sent' || status === 'read'; // a read message should be replyable

  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  const onShow: MenuOnShowCallback = (_, { x, y }) => {
    const triggerHeight = contextMenuRef.current?.clientHeight ?? 0;
    const triggerWidth = contextMenuRef.current?.clientWidth ?? 0;

    // FIXME: there is a bug with react-contexify where the position is just the event position,
    // it does not include changes to prevent the menu from overflowing the window. This temporary
    // fix resolves this by mirroring the y-offset adjustment.
    const yClamped = clampNumber(y, 0, window.innerHeight - triggerHeight);
    setTriggerPosition({
      x,
      // Changes the x-anchor from the center to the far left
      offsetX: -triggerWidth / 2,
      y: yClamped,
      height: triggerHeight,
      width: triggerWidth,
    });
  };

  const onHide: MenuOnHideCallback = () => {
    setTriggerPosition(null);
  };

  if (!convoId) {
    return null;
  }

  if (isDeleted || isControlMessage) {
    return (
      <StyledMessageContextMenu>
        <SessionContextMenuContainer>
          <Menu id={contextMenuId}>
            <SelectMessageMenuItem messageId={messageId} />
            <DeleteItem messageId={messageId} />
          </Menu>
        </SessionContextMenuContainer>
      </StyledMessageContextMenu>
    );
  }

  if (isLegacyGroup) {
    // legacy groups are deprecated
    return null;
  }

  return (
    <StyledMessageContextMenu>
      <SessionContextMenuContainer>
        <Menu
          ref={contextMenuRef}
          id={contextMenuId}
          onShow={onShow}
          onHide={onHide}
          viewportMargin={12}
        >
          <RetryItem messageId={messageId} />
          <SaveAttachmentMenuItem messageId={messageId} />
          {(isSent || !isOutgoing) && !!reply && (
            <MenuItem onClick={reply} iconType={LUCIDE_ICONS_UNICODE.REPLY} isDangerAction={false}>
              {tr('reply')}
            </MenuItem>
          )}
          <CopyBodyMenuItem messageId={messageId} />
          <MessageInfoMenuItem messageId={messageId} />
          <SelectMessageMenuItem messageId={messageId} />
          <CopyAccountIdMenuItem pubkey={sender} messageId={messageId} />
          <DeleteItem messageId={messageId} />
          <CommunityAdminActionItems messageId={messageId} />
        </Menu>
      </SessionContextMenuContainer>
    </StyledMessageContextMenu>
  );
};
