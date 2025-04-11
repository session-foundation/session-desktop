import { compact, flatten, isEqual } from 'lodash';
import { SessionDataTestId, useEffect, useState } from 'react';

import { useDispatch } from 'react-redux';
import useInterval from 'react-use/lib/useInterval';

import { Data } from '../../../../data/data';
import { SessionIcon } from '../../../icon';

import {
  useConversationUsername,
  useDisappearingMessageSettingText,
  useIsClosedGroup,
  useIsGroupDestroyed,
  useIsKickedFromGroup,
  useIsPublic,
  useNotificationSetting,
} from '../../../../hooks/useParamSelector';
import { useIsRightPanelShowing } from '../../../../hooks/useUI';
import {
  showAddModeratorsByConvoId,
  showDeleteGroupByConvoId,
  showLeaveGroupByConvoId,
  showRemoveModeratorsByConvoId,
  showUpdateGroupMembersByConvoId,
  showUpdateGroupNameByConvoId,
} from '../../../../interactions/conversationInteractions';
import { Constants } from '../../../../session';
import { PubKey } from '../../../../session/types';
import { hasClosedGroupV2QAButtons } from '../../../../shared/env_vars';
import { groupInfoActions } from '../../../../state/ducks/metaGroups';
import { setRightOverlayMode } from '../../../../state/ducks/section';
import {
  useConversationIsExpired03Group,
  useSelectedConversationKey,
  useSelectedIsActive,
  useSelectedIsBlocked,
  useSelectedIsGroupOrCommunity,
  useSelectedIsGroupV2,
  useSelectedIsKickedFromGroup,
  useSelectedIsPublic,
  useSelectedWeAreAdmin,
} from '../../../../state/selectors/selectedConversation';
import { AttachmentTypeWithPath } from '../../../../types/Attachment';
import { getAbsoluteAttachmentPath } from '../../../../types/MessageAttachment';
import { Flex } from '../../../basic/Flex';
import { SpacerLG, SpacerXL } from '../../../basic/Text';
import { PanelButtonGroup, PanelIconButton } from '../../../buttons';
import { MediaItemType } from '../../../lightbox/LightboxGallery';
import { MediaGallery } from '../../media-gallery/MediaGallery';
import { StyledScrollContainer } from './components';
import {
  showDeleteGroupItem,
  showLeaveGroupItem,
} from '../../../menu/items/LeaveAndDeleteGroup/guard';
import { useIsMessageRequestOverlayShown } from '../../../../state/selectors/section';
import { showLeaveCommunityItem } from '../../../menu/items/LeaveCommunity/guard';
import { useShowNotificationFor } from '../../../menuAndSettingsHooks/useShowNotificationFor';
import type { ConversationNotificationSettingType } from '../../../../models/conversationAttributes';
import { localize } from '../../../../localization/localeTools';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';
import { PanelIconLucideIcon } from '../../../buttons/PanelIconButton';

async function getMediaGalleryProps(conversationId: string): Promise<{
  documents: Array<MediaItemType>;
  media: Array<MediaItemType>;
}> {
  // We fetch more documents than media as they don’t require to be loaded
  // into memory right away. Revisit this once we have infinite scrolling:
  const rawMedia = await Data.getMessagesWithVisualMediaAttachments(
    conversationId,
    Constants.CONVERSATION.DEFAULT_MEDIA_FETCH_COUNT
  );
  const rawDocuments = await Data.getMessagesWithFileAttachments(
    conversationId,
    Constants.CONVERSATION.DEFAULT_DOCUMENTS_FETCH_COUNT
  );

  const media = flatten(
    rawMedia.map(attributes => {
      const { attachments, source, id, timestamp, serverTimestamp, received_at } = attributes;

      return (attachments || [])
        .filter(
          (attachment: AttachmentTypeWithPath) =>
            attachment.thumbnail && !attachment.pending && !attachment.error
        )
        .map((attachment: AttachmentTypeWithPath, index: number) => {
          const { thumbnail } = attachment;

          const mediaItem: MediaItemType = {
            objectURL: getAbsoluteAttachmentPath(attachment.path),
            thumbnailObjectUrl: thumbnail ? getAbsoluteAttachmentPath(thumbnail.path) : undefined,
            contentType: attachment.contentType || '',
            index,
            messageTimestamp: timestamp || serverTimestamp || received_at || 0,
            messageSender: source,
            messageId: id,
            attachment,
          };

          return mediaItem;
        });
    })
  );

  // Unlike visual media, only one non-image attachment is supported
  const documents = rawDocuments.map(attributes => {
    // this is to not fail if the attachment is invalid (could be a Long Attachment type which is not supported)
    if (!attributes.attachments?.length) {
      // window?.log?.info(
      //   'Got a message with an empty list of attachment. Skipping...'
      // );
      return null;
    }
    const attachment = attributes.attachments[0];
    const { source, id, timestamp, serverTimestamp, received_at } = attributes;

    return {
      contentType: attachment.contentType,
      index: 0,
      attachment,
      messageTimestamp: timestamp || serverTimestamp || received_at || 0,
      messageSender: source,
      messageId: id,
    };
  });

  return {
    media,
    documents: compact(documents), // remove null
  };
}

const LeaveCommunityPanelButton = () => {
  const selectedConvoKey = useSelectedConversationKey();
  const selectedUsername = useConversationUsername(selectedConvoKey) || selectedConvoKey;
  const isPublic = useIsPublic(selectedConvoKey);

  const showItem = showLeaveCommunityItem({ isPublic });

  if (!selectedConvoKey || !showItem) {
    return null;
  }

  return (
    <PanelIconButton
      text={window.i18n('communityLeave')}
      dataTestId="leave-group-button"
      onClick={() => void showLeaveGroupByConvoId(selectedConvoKey, selectedUsername)}
      color={'var(--danger-color)'}
      iconElement={<PanelIconLucideIcon iconUnicode={LUCIDE_ICONS_UNICODE.TRASH2} />}
    />
  );
};

const DeleteGroupPanelButton = () => {
  const convoId = useSelectedConversationKey();
  const isGroup = useIsClosedGroup(convoId);
  const isMessageRequestShown = useIsMessageRequestOverlayShown();
  const isKickedFromGroup = useIsKickedFromGroup(convoId) || false;
  const selectedUsername = useConversationUsername(convoId) || convoId;
  const isPublic = useIsPublic(convoId);
  const isGroupDestroyed = useIsGroupDestroyed(convoId);
  const is03GroupExpired = useConversationIsExpired03Group(convoId);

  const showItem = showDeleteGroupItem({
    isGroup,
    isKickedFromGroup,
    isMessageRequestShown,
    isPublic,
    isGroupDestroyed,
    is03GroupExpired,
  });

  if (!showItem || !convoId) {
    return null;
  }

  const token = PubKey.is03Pubkey(convoId) ? 'groupDelete' : 'conversationsDelete';

  return (
    <PanelIconButton
      text={window.i18n(token)}
      dataTestId="leave-group-button"
      onClick={() => void showDeleteGroupByConvoId(convoId, selectedUsername)}
      color={'var(--danger-color)'}
      iconElement={<PanelIconLucideIcon iconUnicode={LUCIDE_ICONS_UNICODE.TRASH2} />}
    />
  );
};

const LeaveGroupPanelButton = () => {
  const selectedConvoKey = useSelectedConversationKey();
  const isGroup = useIsClosedGroup(selectedConvoKey);
  const username = useConversationUsername(selectedConvoKey) || selectedConvoKey;
  const isMessageRequestShown = useIsMessageRequestOverlayShown();
  const isKickedFromGroup = useIsKickedFromGroup(selectedConvoKey) || false;
  const isPublic = useIsPublic(selectedConvoKey);
  const isGroupDestroyed = useIsGroupDestroyed(selectedConvoKey);

  const showItem = showLeaveGroupItem({
    isGroup,
    isKickedFromGroup,
    isMessageRequestShown,
    isPublic,
    isGroupDestroyed,
  });

  if (!selectedConvoKey || !showItem) {
    return null;
  }

  return (
    <PanelIconButton
      text={window.i18n('groupLeave')}
      dataTestId="leave-group-button"
      onClick={() => void showLeaveGroupByConvoId(selectedConvoKey, username)}
      color={'var(--danger-color)'}
      iconElement={<PanelIconLucideIcon iconUnicode={LUCIDE_ICONS_UNICODE.LOG_OUT} />}
    />
  );
};

const NotificationPanelIconButton = (notificationSelected: ConversationNotificationSettingType) => {
  switch (notificationSelected) {
    case 'mentions_only':
      return LUCIDE_ICONS_UNICODE.AT_SIGN;
    case 'disabled':
      return LUCIDE_ICONS_UNICODE.VOLUME_OFF;
    case 'all':
    default:
      return LUCIDE_ICONS_UNICODE.VOLUME_2;
  }
};

const NotificationPanelButton = ({ convoId }: { convoId: string }) => {
  const showNotificationFor = useShowNotificationFor(convoId);

  const notificationSelected = useNotificationSetting(convoId);
  const subtitle =
    notificationSelected === 'disabled'
      ? localize('notificationsMute').toString()
      : notificationSelected === 'mentions_only'
        ? localize('notificationsMentionsOnly').toString()
        : localize('notificationsAllMessages').toString();

  if (!showNotificationFor) {
    return null;
  }

  return (
    <PanelIconButton
      iconElement={
        <PanelIconLucideIcon iconUnicode={NotificationPanelIconButton(notificationSelected)} />
      }
      text={localize('sessionNotifications').toString()}
      onClick={() => {
        throw new Error('FIXME: showUpdateGroupMembersByConvoId');
      }}
      subtitle={subtitle}
      dataTestId="group-members"
    />
  );
};

export const OverlayRightPanelSettings = () => {
  const [documents, setDocuments] = useState<Array<MediaItemType>>([]);
  const [media, setMedia] = useState<Array<MediaItemType>>([]);

  const selectedConvoKey = useSelectedConversationKey();
  const isShowing = useIsRightPanelShowing();

  const dispatch = useDispatch();

  const isActive = useSelectedIsActive();
  const isBlocked = useSelectedIsBlocked();
  const isKickedFromGroup = useSelectedIsKickedFromGroup();
  const isGroup = useSelectedIsGroupOrCommunity();
  const isGroupV2 = useSelectedIsGroupV2();
  const isPublic = useSelectedIsPublic();
  const weAreAdmin = useSelectedWeAreAdmin();
  const disappearingMessagesSubtitle = useDisappearingMessageSettingText({
    convoId: selectedConvoKey,
  });

  useEffect(() => {
    let isCancelled = false;

    const loadDocumentsOrMedia = async () => {
      try {
        if (isShowing && selectedConvoKey) {
          const results = await getMediaGalleryProps(selectedConvoKey);

          if (!isCancelled) {
            if (!isEqual(documents, results.documents)) {
              setDocuments(results.documents);
            }

            if (!isEqual(media, results.media)) {
              setMedia(results.media);
            }
          }
        }
      } catch (error) {
        if (!isCancelled) {
          window.log.debug(`OverlayRightPanelSettings loadDocumentsOrMedia: ${error}`);
        }
      }
    };

    void loadDocumentsOrMedia();

    return () => {
      isCancelled = true;
    };
  }, [documents, isShowing, media, selectedConvoKey]);

  useInterval(async () => {
    if (isShowing && selectedConvoKey) {
      const results = await getMediaGalleryProps(selectedConvoKey);
      if (results.documents.length !== documents.length || results.media.length !== media.length) {
        setDocuments(results.documents);
        setMedia(results.media);
      }
    }
  }, 10000);

  if (!selectedConvoKey) {
    return null;
  }

  const commonNoShow = isKickedFromGroup || isBlocked || !isActive;
  const hasDisappearingMessages = !isPublic && !commonNoShow;

  const showUpdateGroupNameButton = isGroup && weAreAdmin && !commonNoShow; // legacy groups non-admin cannot change groupname anymore
  const showAddRemoveModeratorsButton = weAreAdmin && !commonNoShow && isPublic;
  const showUpdateGroupMembersButton = !isPublic && isGroup && !commonNoShow;

  return (
    <StyledScrollContainer>
      <Flex $container={true} $flexDirection={'column'} $alignItems={'center'}>
        <PanelButtonGroup style={{ margin: '0 var(--margins-lg)' }}>
          {showUpdateGroupNameButton && (
            <PanelIconButton
              iconElement={
                <PanelIconLucideIcon iconUnicode={LUCIDE_ICONS_UNICODE.USER_ROUND_PEN} />
              }
              text={window.i18n('groupEdit')}
              onClick={() => {
                void showUpdateGroupNameByConvoId(selectedConvoKey);
              }}
              dataTestId="edit-group-name"
            />
          )}

          {hasClosedGroupV2QAButtons() && isGroupV2 ? (
            <>
              <PanelIconButton
                iconElement={<PanelIconLucideIcon iconUnicode={LUCIDE_ICONS_UNICODE.BUG} />}
                text={'trigger avatar message'}
                onClick={() => {
                  if (!PubKey.is03Pubkey(selectedConvoKey)) {
                    throw new Error('triggerFakeAvatarUpdate needs a 03 pubkey');
                  }
                  window.inboxStore?.dispatch(
                    groupInfoActions.triggerFakeAvatarUpdate({ groupPk: selectedConvoKey }) as any
                  );
                }}
                dataTestId={'' as SessionDataTestId}
              />
              <PanelIconButton
                iconElement={<PanelIconLucideIcon iconUnicode={LUCIDE_ICONS_UNICODE.BUG} />}
                text={'trigger delete message before now'}
                onClick={() => {
                  if (!PubKey.is03Pubkey(selectedConvoKey)) {
                    throw new Error('We need a 03 pubkey');
                  }
                  window.inboxStore?.dispatch(
                    groupInfoActions.triggerFakeDeleteMsgBeforeNow({
                      groupPk: selectedConvoKey,
                      messagesWithAttachmentsOnly: false,
                    }) as any
                  );
                }}
                dataTestId={'' as SessionDataTestId}
              />
              <PanelIconButton
                iconElement={<PanelIconLucideIcon iconUnicode={LUCIDE_ICONS_UNICODE.BUG} />}
                text={'delete message with attachments before now'}
                onClick={() => {
                  if (!PubKey.is03Pubkey(selectedConvoKey)) {
                    throw new Error('We need a 03 pubkey');
                  }
                  window.inboxStore?.dispatch(
                    groupInfoActions.triggerFakeDeleteMsgBeforeNow({
                      groupPk: selectedConvoKey,
                      messagesWithAttachmentsOnly: true,
                    }) as any
                  );
                }}
                dataTestId={'' as SessionDataTestId}
              />
            </>
          ) : null}

          {showAddRemoveModeratorsButton && (
            <>
              <PanelIconButton
                iconElement={<SessionIcon iconSize={'large'} iconType={'addModerator'} />}
                text={window.i18n('adminPromote')}
                onClick={() => {
                  showAddModeratorsByConvoId(selectedConvoKey);
                }}
                dataTestId="add-moderators"
              />

              <PanelIconButton
                iconElement={<SessionIcon iconSize={'large'} iconType={'deleteModerator'} />}
                text={window.i18n('adminRemove')}
                onClick={() => {
                  showRemoveModeratorsByConvoId(selectedConvoKey);
                }}
                dataTestId="remove-moderators"
              />
            </>
          )}

          {showUpdateGroupMembersButton && (
            <PanelIconButton
              iconElement={<PanelIconLucideIcon iconUnicode={LUCIDE_ICONS_UNICODE.USER_ROUND} />}
              text={window.i18n('groupMembers')}
              onClick={() => {
                void showUpdateGroupMembersByConvoId(selectedConvoKey);
              }}
              dataTestId="group-members"
            />
          )}

          {hasDisappearingMessages && (
            <PanelIconButton
              iconElement={<PanelIconLucideIcon iconUnicode={LUCIDE_ICONS_UNICODE.TIMER} />}
              text={window.i18n('disappearingMessages')}
              subtitle={disappearingMessagesSubtitle}
              dataTestId="disappearing-messages"
              onClick={() => {
                dispatch(setRightOverlayMode({ type: 'disappearing_messages', params: null }));
              }}
            />
          )}

          <NotificationPanelButton convoId={selectedConvoKey} />

          <MediaGallery documents={documents} media={media} />
          {isGroup && (
            <>
              <LeaveGroupPanelButton />
              <DeleteGroupPanelButton />
              <LeaveCommunityPanelButton />
            </>
          )}
        </PanelButtonGroup>
        <SpacerLG />
        <SpacerXL />
      </Flex>
    </StyledScrollContainer>
  );
};
