/* eslint-disable @typescript-eslint/no-misused-promises */
import { Dispatch, type KeyboardEvent, type MouseEvent, useRef } from 'react';

import { isNil, isNumber, isString } from 'lodash';
import { Menu, MenuOnHideCallback, MenuOnShowCallback } from 'react-contexify';
import styled from 'styled-components';
import { toNumber } from 'lodash/fp';
import { getAppDispatch } from '../../../../state/dispatch';
import { Data } from '../../../../data/data';

import { MessageRenderingProps } from '../../../../models/messageType';
import { openRightPanel, showMessageInfoView } from '../../../../state/ducks/conversations';
import {
  useMessageAttachments,
  useMessageDirection,
  useMessageIsDeletable,
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
import { ItemWithDataTestId } from '../../../menu/items/MenuItemWithDataTestId';
import { getMenuAnimation } from '../../../menu/MenuAnimation';
import { WithMessageId } from '../../../../session/types/with';
import { DeleteItem } from '../../../menu/items/DeleteMessage/DeleteMessageMenuItem';
import { RetryItem } from '../../../menu/items/RetrySend/RetrySendMenuItem';
import { useBanUserCb } from '../../../menuAndSettingsHooks/useBanUser';
import { tr } from '../../../../localization/localeTools';
import { sectionActions } from '../../../../state/ducks/section';
import { useRemoveSenderFromCommunityAdmin } from '../../../menuAndSettingsHooks/useRemoveSenderFromCommunityAdmin';
import { useAddSenderAsCommunityAdmin } from '../../../menuAndSettingsHooks/useAddSenderAsCommunityAdmin';
import {
  useAddUserPermissions,
  useClearUserPermissions,
} from '../../../menuAndSettingsHooks/useAddUserPermissions';
import { showContextMenu } from '../../../../util/contextMenu';
import { clampNumber } from '../../../../util/maths';
import { PopoverTriggerPosition } from '../../../SessionTooltip';
import { SessionLucideIconButton } from '../../../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';
import { SpacerSM } from '../../../basic/Text';
import { SessionIcon } from '../../../icon';
import { useMessageInteractions } from '../../../../hooks/useMessageInteractions';

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

type Props = {
  messageId: string;
  contextMenuId: string;
  setTriggerPosition: Dispatch<PopoverTriggerPosition | null>;
};

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

  const sharedBanUnbanProps = {
    conversationId: convoId,
    pubkey: sender,
  };

  const banUserCb = useBanUserCb({
    banType: 'ban',
    ...sharedBanUnbanProps,
  });
  const unbanUserCb = useBanUserCb({
    banType: 'unban',
    ...sharedBanUnbanProps,
  });
  const serverBanUser = useBanUserCb({
    banType: 'server-ban',
    ...sharedBanUnbanProps,
  });
  const serverUnbanUser = useBanUserCb({
    banType: 'server-unban',
    ...sharedBanUnbanProps,
  });

  const removeSenderFromCommunityAdminCb = useRemoveSenderFromCommunityAdmin({
    conversationId: convoId,
    senderId: sender,
  });

  const addSenderAsCommunityAdminCb = useAddSenderAsCommunityAdmin({
    conversationId: convoId,
    senderId: sender,
  });

  const addUploadPermissionCb = useAddUserPermissions(sender, convoId, ['upload']);
  const clearUploadPermissionCb = useClearUserPermissions(sender, convoId, ['upload']);

  // Fixed to `true` as not currently exposed by the backend/tracked in session-desktop
  const isRoomUploadRestricted = true;
  const canSenderUpload = true;
  const canSenderNotUpload = true;

  // Note: add/removeSenderFromCommunityAdminCb can be null if we are a moderator only, see below
  if (!convoId || !sender || !banUserCb || !unbanUserCb) {
    return null;
  }

  return (
    <>
      <ItemWithDataTestId onClick={banUserCb}>
        <SessionLucideIconButton
          iconSize="medium"
          iconColor="inherit"
          unicode={LUCIDE_ICONS_UNICODE.USER_ROUND_X}
        />
        <SpacerSM />
        {tr('banUser')}
      </ItemWithDataTestId>
      <ItemWithDataTestId onClick={unbanUserCb}>
        <SessionLucideIconButton
          iconSize="medium"
          iconColor="inherit"
          unicode={LUCIDE_ICONS_UNICODE.USER_ROUND_CHECK}
        />
        <SpacerSM />
        {tr('banUnbanUser')}
      </ItemWithDataTestId>
      {/* only an admin can promote/remove moderators from a community. Another moderator cannot. */}
      {isSenderAdmin ? (
        removeSenderFromCommunityAdminCb ? (
          <ItemWithDataTestId onClick={removeSenderFromCommunityAdminCb}>
            <SessionIcon iconType="deleteModerator" iconSize="medium" iconColor="inherit" />
            <SpacerSM />
            {tr('adminRemoveAsAdmin')}
          </ItemWithDataTestId>
        ) : null
      ) : addSenderAsCommunityAdminCb ? (
        <ItemWithDataTestId onClick={addSenderAsCommunityAdminCb}>
          <SessionIcon iconType="addModerator" iconSize="medium" iconColor="inherit" />
          <SpacerSM />
          {tr('adminPromoteToAdmin')}
        </ItemWithDataTestId>
      ) : null}

      {serverBanUser ? (
        <ItemWithDataTestId onClick={serverBanUser}>{tr('serverBanUserDev')}</ItemWithDataTestId>
      ) : null}
      {serverUnbanUser ? (
        <ItemWithDataTestId onClick={serverUnbanUser}>
          {tr('serverUnbanUserDev')}
        </ItemWithDataTestId>
      ) : null}
      {!isSenderAdmin && isRoomUploadRestricted && (
        <>
          {canSenderUpload && addUploadPermissionCb ? (
            <ItemWithDataTestId onClick={addUploadPermissionCb}>
              {tr('addUploadPermissionDev')}
            </ItemWithDataTestId>
          ) : null}
          {canSenderNotUpload && clearUploadPermissionCb ? (
            <ItemWithDataTestId onClick={clearUploadPermissionCb}>
              {tr('clearUploadPermissionDev')}
            </ItemWithDataTestId>
          ) : null}
        </>
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
  const { messageId, contextMenuId, setTriggerPosition } = props;

  const { copyText, saveAttachment, reply, select } = useMessageInteractions(messageId);

  const dispatch = getAppDispatch();

  const isLegacyGroup = useSelectedIsLegacyGroup();
  const convoId = useSelectedConversationKey();
  const direction = useMessageDirection(messageId);
  const status = useMessageStatus(messageId);
  const isDeletable = useMessageIsDeletable(messageId);
  const attachments = useMessageAttachments(messageId);
  const sender = useMessageSender(messageId);

  const isOutgoing = direction === 'outgoing';
  const isSent = status === 'sent' || status === 'read'; // a read message should be replyable

  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  const onShow: MenuOnShowCallback = (_, { x, y }) => {
    const triggerHeight = contextMenuRef.current?.clientHeight ?? 0;
    const triggerWidth = contextMenuRef.current?.clientWidth ?? 0;

    // FIXME: there is a bug with react-contexify where the position is just the event position,
    // it doesnt include changes to prevent the menu from overflowing the window. This temporary
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
    <StyledMessageContextMenu>
      <SessionContextMenuContainer>
        <Menu
          ref={contextMenuRef}
          id={contextMenuId}
          animation={getMenuAnimation()}
          onShow={onShow}
          onHide={onHide}
          viewportMargin={12}
        >
          {attachments?.length && attachments.every(m => !m.pending && m.path) ? (
            <ItemWithDataTestId onClick={saveAttachment}>
              <SessionLucideIconButton
                iconSize="medium"
                iconColor="inherit"
                unicode={LUCIDE_ICONS_UNICODE.ARROW_DOWN_TO_LINE}
              />
              <SpacerSM />
              {tr('save')}
            </ItemWithDataTestId>
          ) : null}
          <ItemWithDataTestId onClick={copyText}>
            <SessionLucideIconButton
              iconSize="medium"
              iconColor="inherit"
              unicode={LUCIDE_ICONS_UNICODE.COPY}
            />
            <SpacerSM />
            {tr('copy')}
          </ItemWithDataTestId>
          {(isSent || !isOutgoing) && (
            <ItemWithDataTestId onClick={reply}>
              <SessionLucideIconButton
                iconSize="medium"
                iconColor="inherit"
                unicode={LUCIDE_ICONS_UNICODE.REPLY}
              />
              <SpacerSM />
              {tr('reply')}
            </ItemWithDataTestId>
          )}
          <ItemWithDataTestId
            onClick={() => {
              void showMessageInfoOverlay({ messageId, dispatch });
            }}
          >
            <SessionLucideIconButton
              iconSize="medium"
              iconColor="inherit"
              unicode={LUCIDE_ICONS_UNICODE.INFO}
            />
            <SpacerSM />
            <Localizer token="messageInfo" />
          </ItemWithDataTestId>
          {sender && !isOutgoing ? <CopyAccountIdMenuItem pubkey={sender} /> : null}
          <RetryItem messageId={messageId} />
          {isDeletable ? (
            <ItemWithDataTestId onClick={select}>
              <SessionLucideIconButton
                iconSize="medium"
                iconColor="inherit"
                unicode={LUCIDE_ICONS_UNICODE.CIRCLE_CHECK}
              />
              <SpacerSM />
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
