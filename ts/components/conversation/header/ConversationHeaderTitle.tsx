import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useDisappearingMessageSettingText } from '../../../hooks/useParamSelector';
import { useIsRightPanelShowing } from '../../../hooks/useUI';
import { closeRightPanel } from '../../../state/ducks/conversations';
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
import { useLocalisedNotificationOf } from '../../menuAndSettingsHooks/useLocalisedNotificationFor';
import { useShowConversationSettingsFor } from '../../menuAndSettingsHooks/useShowConversationSettingsFor';

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

  const showConvoSettingsCb = useShowConversationSettingsFor(convoId);

  const onHeaderClick = () => {
    if (isLegacyGroup || !convoId) {
      return;
    }
    if (isRightPanelOn) {
      dispatch(closeRightPanel());
      return;
    }
    if (!showConvoSettingsCb) {
      return;
    }

    // NOTE If disappearing messages is defined we must show it first
    if (visibleSubtitle === 'disappearingMessages') {
      showConvoSettingsCb({
        settingsModalPage: 'disappearing_message',
        standalonePage: true,
      });
    } else if (visibleSubtitle === 'notifications') {
      showConvoSettingsCb({
        settingsModalPage: 'notifications',
        standalonePage: true,
      });
    } else {
      showConvoSettingsCb({ settingsModalPage: 'default' });
    }
  };

  useEffect(() => {
    const newSubtitlesArray: any = [];
    const newSubtitlesStrings: any = {};

    if (disappearingMessageSubtitle.id !== 'off') {
      newSubtitlesStrings.disappearingMessages = disappearingMessageSubtitle.label;
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
