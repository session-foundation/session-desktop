import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import { PubkeyType } from 'libsession_util_nodejs';
import { isNil } from 'lodash';

import {
  useSelectedConversationDisappearingMode,
  useSelectedConversationKey,
  useSelectedExpireTimer,
  useSelectedIsGroupOrCommunity,
  useSelectedIsGroupV2,
  useSelectedIsPrivateFriend,
  useSelectedIsPublic,
} from '../../state/selectors/selectedConversation';
import { Flex } from '../basic/Flex';
import { SpacerMD, TextWithChildren } from '../basic/Text';
import { ExpirableReadableMessage } from './message/message-item/ExpirableReadableMessage';

// eslint-disable-next-line import/order
import { ConversationInteraction } from '../../interactions';
import { ConvoHub } from '../../session/conversations';
import { updateConfirmModal } from '../../state/ducks/modalDialog';
import { Localizer, type LocalizerProps } from '../basic/Localizer';
import { SessionButtonColor } from '../basic/SessionButton';
import { SessionIcon } from '../icon';
import { getTimerNotificationStr } from '../../models/timerNotifications';
import type { WithMessageId } from '../../session/types/with';
import {
  useMessageAuthor,
  useMessageAuthorIsUs,
  useMessageExpirationUpdateDisabled,
  useMessageExpirationUpdateMode,
  useMessageExpirationUpdateTimespanSeconds,
  useMessageExpirationUpdateTimespanText,
} from '../../state/selectors';

const FollowSettingButton = styled.button`
  color: var(--primary-color);
`;

function useFollowSettingsButtonClick({ messageId }: WithMessageId) {
  const selectedConvoKey = useSelectedConversationKey();
  const timespanSeconds = useMessageExpirationUpdateTimespanSeconds(messageId);
  const expirationMode = useMessageExpirationUpdateMode(messageId);
  const disabled = useMessageExpirationUpdateDisabled(messageId);
  const timespanText = useMessageExpirationUpdateTimespanText(messageId);

  const dispatch = useDispatch();
  const onExit = () => dispatch(updateConfirmModal(null));

  const doIt = () => {
    const localizedMode =
      expirationMode === 'deleteAfterRead'
        ? window.i18n('disappearingMessagesTypeRead')
        : window.i18n('disappearingMessagesTypeSent');

    const i18nMessage: LocalizerProps = disabled
      ? {
          token: 'disappearingMessagesFollowSettingOff',
        }
      : {
          token: 'disappearingMessagesFollowSettingOn',
          args: {
            time: timespanText,
            disappearing_messages_type: localizedMode,
          },
        };

    const okText = window.i18n('confirm');

    dispatch(
      updateConfirmModal({
        title: window.i18n('disappearingMessagesFollowSetting'),
        i18nMessage,
        okText,
        okTheme: SessionButtonColor.Danger,
        onClickOk: async () => {
          if (!selectedConvoKey) {
            throw new Error('no selected convo key');
          }
          const convo = ConvoHub.use().get(selectedConvoKey);
          if (!convo) {
            throw new Error('no selected convo');
          }
          if (!convo.isPrivate()) {
            throw new Error('follow settings only work for private chats');
          }
          if (expirationMode !== 'off' && !timespanSeconds) {
            throw new Error('non-off mode requires seconds arg to be given');
          }
          await ConversationInteraction.setDisappearingMessagesByConvoId(
            selectedConvoKey,
            expirationMode,
            timespanSeconds ?? undefined
          );
        },
        showExitIcon: false,
        onClickClose: onExit,
      })
    );
  };
  return { doIt };
}

function useOurExpirationMatches({ messageId }: WithMessageId) {
  const timespanSeconds = useMessageExpirationUpdateTimespanSeconds(messageId);
  const expirationMode = useMessageExpirationUpdateMode(messageId);
  const disabled = useMessageExpirationUpdateDisabled(messageId);

  const selectedMode = useSelectedConversationDisappearingMode();
  const selectedTimespan = useSelectedExpireTimer();

  if (disabled && (selectedMode === 'off' || selectedMode === undefined)) {
    return true;
  }

  if (expirationMode === selectedMode && timespanSeconds === selectedTimespan) {
    return true;
  }
  return false;
}

const FollowSettingsButton = ({ messageId }: WithMessageId) => {
  const isPrivateAndFriend = useSelectedIsPrivateFriend();
  const authorIsUs = useMessageAuthorIsUs(messageId);

  const click = useFollowSettingsButtonClick({
    messageId,
  });
  const areSameThanOurs = useOurExpirationMatches({ messageId });

  if (!isPrivateAndFriend) {
    return null;
  }
  if (authorIsUs || areSameThanOurs) {
    return null;
  }

  return (
    <FollowSettingButton
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      onClick={() => click.doIt()}
    >
      {window.i18n('disappearingMessagesFollowSetting')}
    </FollowSettingButton>
  );
};

export const TimerNotification = (props: WithMessageId) => {
  const { messageId } = props;
  const timespanSeconds = useMessageExpirationUpdateTimespanSeconds(messageId);
  const expirationMode = useMessageExpirationUpdateMode(messageId);
  const disabled = useMessageExpirationUpdateDisabled(messageId);
  const pubkey = useMessageAuthor(messageId);
  const convoId = useSelectedConversationKey();
  const isGroupOrCommunity = useSelectedIsGroupOrCommunity();
  const isGroupV2 = useSelectedIsGroupV2();
  const isPublic = useSelectedIsPublic();

  if (!convoId || !messageId || isNil(timespanSeconds) || isNil(expirationMode)) {
    return null;
  }

  const i18nProps = getTimerNotificationStr({
    convoId,
    author: pubkey as PubkeyType,
    expirationMode,
    isGroup: isGroupOrCommunity,
    timespanSeconds,
  });

  // renderOff is true when the update is put to off, or when we have a legacy group control message (as they are not expiring at all)
  const renderOffIcon = disabled || (isGroupOrCommunity && isPublic && !isGroupV2);

  return (
    <ExpirableReadableMessage
      messageId={messageId}
      isControlMessage={true}
      key={`readable-message-${messageId}`}
      dataTestId={'disappear-control-message'}
    >
      <Flex
        $container={true}
        $flexDirection="column"
        $alignItems="center"
        $justifyContent="center"
        width="90%"
        maxWidth="700px"
        margin="5px auto 10px auto" // top margin is smaller that bottom one to make the stopwatch icon of expirable message closer to its content
        padding="5px 10px"
        style={{ textAlign: 'center' }}
      >
        {renderOffIcon && (
          <>
            <SessionIcon
              iconType="timerFixed"
              iconSize={'small'}
              iconColor="var(--text-secondary-color)"
            />
            <SpacerMD />
          </>
        )}
        <TextWithChildren subtle={true}>
          <Localizer {...i18nProps} />
        </TextWithChildren>
        <FollowSettingsButton {...props} />
      </Flex>
    </ExpirableReadableMessage>
  );
};
