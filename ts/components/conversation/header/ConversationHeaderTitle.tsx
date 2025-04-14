import { isEmpty } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useDisappearingMessageSettingText } from '../../../hooks/useParamSelector';
import { useIsRightPanelShowing } from '../../../hooks/useUI';
import { closeRightPanel } from '../../../state/ducks/conversations';
import { resetRightOverlayMode } from '../../../state/ducks/section';
import {
  useSelectedConversationDisappearingMode,
  useSelectedConversationKey,
  useSelectedIsGroupOrCommunity,
  useSelectedIsKickedFromGroup,
  useSelectedIsLegacyGroup,
  useSelectedIsNoteToSelf,
  useSelectedIsPublic,
  useSelectedMembersCount,
  useSelectedNicknameOrProfileNameOrShortenedPubkey,
  useSelectedNotificationSetting,
  useSelectedSubscriberCount,
} from '../../../state/selectors/selectedConversation';
import { ConversationHeaderSubtitle } from './ConversationHeaderSubtitle';
import { updateConversationSettingsModal } from '../../../state/ducks/modalDialog';
import { useLocalisedNotificationOf } from '../../menuAndSettingsHooks/useLocalisedNotificationFor';

export type SubtitleStrings = Record<string, string> & {
  notifications?: string;
  members?: string;
  disappearingMessages?: string;
};

export type SubtitleStringsType = keyof Pick<
  SubtitleStrings,
  'notifications' | 'members' | 'disappearingMessages'
>;

type ConversationHeaderTitleProps = {
  showSubtitle?: boolean;
};

export const ConversationHeaderTitle = (props: ConversationHeaderTitleProps) => {
  const { showSubtitle = true } = props;

  const dispatch = useDispatch();
  const convoId = useSelectedConversationKey();
  const convoName = useSelectedNicknameOrProfileNameOrShortenedPubkey();

  const isRightPanelOn = useIsRightPanelShowing();
  const subscriberCount = useSelectedSubscriberCount();

  const isPublic = useSelectedIsPublic();
  const isKickedFromGroup = useSelectedIsKickedFromGroup();
  const isMe = useSelectedIsNoteToSelf();
  const isGroup = useSelectedIsGroupOrCommunity();
  const selectedMembersCount = useSelectedMembersCount();

  const isLegacyGroup = useSelectedIsLegacyGroup();
  const notification = useSelectedNotificationSetting();

  const expirationMode = useSelectedConversationDisappearingMode();
  const disappearingMessageSubtitle = useDisappearingMessageSettingText({
    convoId,
    abbreviate: true,
  });

  const [visibleSubtitle, setVisibleSubtitle] =
    useState<SubtitleStringsType>('disappearingMessages');

  const [subtitleStrings, setSubtitleStrings] = useState<SubtitleStrings>({});
  const [subtitleArray, setSubtitleArray] = useState<Array<SubtitleStringsType>>([]);

  const { i18n } = window;

  const notificationSubtitle = useLocalisedNotificationOf(notification, 'title');

  const memberCountSubtitle = useMemo(() => {
    let count = 0;
    if (isGroup) {
      if (isPublic) {
        count = subscriberCount || 0;
      } else {
        count = selectedMembersCount;
      }
    }

    if (isGroup && count > 0 && !isKickedFromGroup) {
      return isPublic ? i18n('membersActive', { count }) : i18n('members', { count });
    }

    return null;
  }, [i18n, isGroup, isKickedFromGroup, isPublic, selectedMembersCount, subscriberCount]);

  const onHeaderClick = () => {
    if (isLegacyGroup || !convoId) {
      return;
    }
    if (isRightPanelOn) {
      dispatch(closeRightPanel());
      return;
    }

    // NOTE If disappearing messages is defined we must show it first
    if (visibleSubtitle === 'disappearingMessages') {
      dispatch(
        updateConversationSettingsModal({
          conversationId: convoId,
          settingsModalPage: 'disappearing_message',
          standalonePage: true,
        })
      );
    } else if (visibleSubtitle === 'notifications') {
      dispatch(
        updateConversationSettingsModal({
          conversationId: convoId,
          settingsModalPage: 'notifications',
          standalonePage: true,
        })
      );
    } else {
      dispatch(resetRightOverlayMode());
    }
  };

  useEffect(() => {
    if (visibleSubtitle !== 'disappearingMessages') {
      if (!isEmpty(disappearingMessageSubtitle)) {
        setVisibleSubtitle('disappearingMessages');
      } else {
        setVisibleSubtitle('notifications');
      }
    }
    // We only want this to change when a new conversation is selected or disappearing messages is toggled
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convoId, disappearingMessageSubtitle]);

  useEffect(() => {
    const newSubtitlesArray: any = [];
    const newSubtitlesStrings: any = {};

    if (disappearingMessageSubtitle) {
      newSubtitlesStrings.disappearingMessages = disappearingMessageSubtitle;
      newSubtitlesArray.push('disappearingMessages');
    }

    if (notificationSubtitle) {
      newSubtitlesStrings.notifications = notificationSubtitle;
      newSubtitlesArray.push('notifications');
    }

    if (memberCountSubtitle) {
      newSubtitlesStrings.members = memberCountSubtitle;
      newSubtitlesArray.push('members');
    }

    if (newSubtitlesArray.indexOf(visibleSubtitle) < 0) {
      setVisibleSubtitle('notifications');
    }

    setSubtitleStrings(newSubtitlesStrings);
    setSubtitleArray(newSubtitlesArray);
  }, [disappearingMessageSubtitle, memberCountSubtitle, notificationSubtitle, visibleSubtitle]);

  const className = isMe ? '' : 'module-contact-name__profile-name';
  const displayName = isMe ? i18n('noteToSelf') : convoName;

  return (
    <div className="module-conversation-header__title-container">
      <div className="module-conversation-header__title-flex">
        <div className="module-conversation-header__title">
          <span
            className={className}
            onClick={onHeaderClick}
            role="button"
            data-testid="header-conversation-name"
          >
            {displayName}
          </span>
          {showSubtitle && subtitleArray.indexOf(visibleSubtitle) > -1 && (
            <ConversationHeaderSubtitle
              currentSubtitle={visibleSubtitle}
              setCurrentSubtitle={setVisibleSubtitle}
              subtitlesArray={subtitleArray}
              subtitleStrings={subtitleStrings}
              onClickFunction={onHeaderClick}
              showDisappearingMessageIcon={
                visibleSubtitle === 'disappearingMessages' && expirationMode !== 'off'
              }
            />
          )}
        </div>
      </div>
    </div>
  );
};
