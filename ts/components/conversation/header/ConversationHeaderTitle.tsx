import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import { useDisappearingMessageSettingText } from '../../../hooks/useParamSelector';
import { useIsRightPanelShowing } from '../../../hooks/useUI';
import { closeRightPanel } from '../../../state/ducks/conversations';
import {
  useSelectedConversationDisappearingMode,
  useSelectedConversationKey,
  useSelectedIsBlocked,
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
import { ConversationHeaderSubtitle, type SubTitleArray } from './ConversationHeaderSubtitle';
import { useLocalisedNotificationOf } from '../../menuAndSettingsHooks/useLocalisedNotificationFor';
import { useShowConversationSettingsFor } from '../../menuAndSettingsHooks/useShowConversationSettingsFor';
import { tr } from '../../../localization/localeTools';
import { ProIcon } from '../../buttons/ProButton';
import { useUserHasPro } from '../../../hooks/useHasPro';
import { useProBadgeOnClickCb } from '../../menuAndSettingsHooks/useProBadgeOnClickCb';

export type SubtitleStrings = Record<string, string> & {
  notifications?: string;
  members?: string;
  disappearingMessages?: string;
};

export type SubtitleStringsType = keyof Pick<
  SubtitleStrings,
  'notifications' | 'members' | 'disappearingMessages'
>;

function useSubtitleArray(convoId?: string) {
  const subscriberCount = useSelectedSubscriberCount();

  const isPublic = useSelectedIsPublic();
  const isKickedFromGroup = useSelectedIsKickedFromGroup();
  const isGroup = useSelectedIsGroupOrCommunity();
  const selectedMembersCount = useSelectedMembersCount();

  const notification = useSelectedNotificationSetting();
  const disappearingMessageSubtitle = useDisappearingMessageSettingText({
    convoId,
  });

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
      return tr(isPublic ? 'membersActive' : 'members', { count });
    }

    return null;
  }, [isGroup, isKickedFromGroup, isPublic, selectedMembersCount, subscriberCount]);

  const subtitleArray = useMemo(() => {
    const innerSubtitleArray: SubTitleArray = [];
    if (disappearingMessageSubtitle.id !== 'off') {
      innerSubtitleArray.push({
        type: 'disappearingMessages',
        label: disappearingMessageSubtitle.label,
      });
    }

    if (notificationSubtitle) {
      innerSubtitleArray.push({ type: 'notifications', label: notificationSubtitle });
    }

    if (memberCountSubtitle) {
      innerSubtitleArray.push({ type: 'members', label: memberCountSubtitle });
    }
    return innerSubtitleArray;
  }, [disappearingMessageSubtitle, notificationSubtitle, memberCountSubtitle]);
  return subtitleArray;
}

const StyledConversationTitleContainer = styled.div`
  min-width: 0;
  display: block;
  text-align: center;
  flex-grow: 1;
`;

const StyledConversationTitleFlex = styled.div`
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  max-width: 100%;
  font-weight: bold;
  width: 100%;
  display: flex;
  font-size: var(--font-size-md);
`;

const StyledConversationTitle = styled.div`
  margin: 0px 20px;

  min-width: 0;
  font-size: 16px;
  line-height: 26px;
  font-weight: 400;
  color: var(--text-primary-color);

  // width of avatar (28px) and our 6px left margin
  max-width: calc(100% - 34px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  display: flex;
  align-items: center;

  user-select: text;
  cursor: pointer;

  flex-direction: column;
  font-weight: bold;
  width: 100%;
  display: flex;
  font-size: var(--font-size-md);

  .module-contact-name {
    width: 100%;
  }

  .module-contact-name__profile-number {
    text-align: center;
  }

  .module-contact-name__profile-name {
    width: 100%;
    overflow: hidden !important;
    text-overflow: ellipsis;
  }
`;

const StyledNameAndBadgeContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  max-width: 100%;
  gap: var(--margins-xs);
`;

const StyledName = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const ConversationHeaderTitle = ({ showSubtitle }: { showSubtitle: boolean }) => {
  const dispatch = useDispatch();
  const convoId = useSelectedConversationKey();
  const convoName = useSelectedNicknameOrProfileNameOrShortenedPubkey();
  const isRightPanelOn = useIsRightPanelShowing();
  const isMe = useSelectedIsNoteToSelf();

  const isLegacyGroup = useSelectedIsLegacyGroup();

  const expirationMode = useSelectedConversationDisappearingMode();
  const [subtitleIndex, setSubtitleIndex] = useState(0);

  // reset the subtitle selected index when the convoId changes (so the page is always 0 by default)
  useEffect(() => {
    setSubtitleIndex(0);
  }, [convoId]);

  const showConvoSettingsCb = useShowConversationSettingsFor(convoId);

  const subtitles = useSubtitleArray(convoId);
  const isBlocked = useSelectedIsBlocked();

  const userHasPro = useUserHasPro(convoId);

  const showPro = useProBadgeOnClickCb({
    context: 'conversation-header-title',
    args: { userHasPro, isMe },
  });

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

    // when the conversation is blocked, only show the default page of the modal (the other pages are not available)
    if (isBlocked) {
      showConvoSettingsCb({ settingsModalPage: 'default' });
      return;
    }

    // NOTE If disappearing messages is defined we must show it first
    if (subtitles?.[subtitleIndex]?.type === 'disappearingMessages') {
      showConvoSettingsCb({
        settingsModalPage: 'disappearing_message',
        standalonePage: true,
      });
    } else if (subtitles?.[subtitleIndex]?.type === 'notifications') {
      showConvoSettingsCb({
        settingsModalPage: 'notifications',
        standalonePage: true,
      });
    } else {
      showConvoSettingsCb({ settingsModalPage: 'default' });
    }
  };

  const displayName = isMe ? tr('noteToSelf') : convoName;

  const clampedSubtitleIndex = useMemo(() => {
    return Math.max(0, Math.min(subtitles.length - 1, subtitleIndex));
  }, [subtitles, subtitleIndex]);
  const visibleSubtitle = subtitles?.[clampedSubtitleIndex];

  const handleTitleCycle = (direction: 1 | -1) => {
    const modulo = (clampedSubtitleIndex + direction) % subtitles.length;
    if (modulo < 0) {
      setSubtitleIndex(subtitles.length - 1);
    } else {
      setSubtitleIndex(modulo);
    }
  };

  return (
    <StyledConversationTitleContainer>
      <StyledConversationTitleFlex>
        <StyledConversationTitle>
          <StyledNameAndBadgeContainer
            onClick={() => {
              showConvoSettingsCb?.({ settingsModalPage: 'default' });
            }}
            role="button"
            data-testid="header-conversation-name"
          >
            <StyledName>{displayName}</StyledName>
            {showPro.show ? (
              <ProIcon
                dataTestId="pro-badge-conversation-header"
                iconSize={'medium'}
              />
            ) : null}
          </StyledNameAndBadgeContainer>
          {showSubtitle && subtitles?.[clampedSubtitleIndex] ? (
            <ConversationHeaderSubtitle
              subtitleIndex={clampedSubtitleIndex}
              onCycle={handleTitleCycle}
              subtitlesArray={subtitles}
              onClickFunction={onHeaderClick}
              showDisappearingMessageIcon={
                visibleSubtitle.type === 'disappearingMessages' && expirationMode !== 'off'
              }
            />
          ) : null}
        </StyledConversationTitle>
      </StyledConversationTitleFlex>
    </StyledConversationTitleContainer>
  );
};
