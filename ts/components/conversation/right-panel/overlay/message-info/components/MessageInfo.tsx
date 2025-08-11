import styled from 'styled-components';
import { MessageFrom } from '.';
import {
  useMessageBody,
  useMessageDirection,
  useMessageExpirationDurationMs,
  useMessageExpirationTimestamp,
  useMessageExpirationType,
  useMessageHash,
  useMessageReceivedAt,
  useMessageSender,
  useMessageSenderIsAdmin,
  useMessageSentWithProFeatures,
  useMessageServerId,
  useMessageServerTimestamp,
  useMessageTimestamp,
} from '../../../../../../state/selectors';

import { isDevProd } from '../../../../../../shared/env_vars';
import { useSelectedConversationKey } from '../../../../../../state/selectors/selectedConversation';

import { Flex } from '../../../../../basic/Flex';
import { SpacerSM } from '../../../../../basic/Text';
import { CopyToClipboardIcon } from '../../../../../buttons';
import {
  formatTimeDistanceToNow,
  formatTimeDurationMs,
  formatDateWithLocale,
  formatNumber,
} from '../../../../../../util/i18n/formatting/generics';
import { saveLogToDesktop } from '../../../../../../util/logger/renderer_process_logging';
import { tr } from '../../../../../../localization/localeTools';

import { Localizer } from '../../../../../basic/Localizer';
import { LucideIcon } from '../../../../../icon/LucideIcon';
import { LUCIDE_ICONS_UNICODE } from '../../../../../icon/lucide';
import { useProBadgeOnClickCb } from '../../../../../menuAndSettingsHooks/useProBadgeOnClickCb';
import { useCurrentUserHasPro } from '../../../../../../hooks/useHasPro';
import { ProIconButton } from '../../../../../buttons/ProButton';
import { assertUnreachable } from '../../../../../../types/sqlSharedTypes';
import { ProMessageFeature } from '../../../../../../models/proMessageFeature';

export const MessageInfoLabel = styled.label<{ color?: string }>`
  font-size: var(--font-size-lg);
  font-weight: bold;
  ${props => props.color && `color: ${props.color};`}
`;

const MessageInfoData = styled.div<{ color?: string }>`
  font-size: var(--font-size-md);
  user-select: text;
  ${props => props.color && `color: ${props.color};`}
`;

const LabelWithInfoContainer = styled.div`
  ${props => props.onClick && 'cursor: pointer;'}
`;

type LabelWithInfoProps = {
  label: string;
  info: string;
  labelColor?: string;
  dataColor?: string;
  title?: string;
  onClick?: () => void;
};

const isDev = isDevProd();

export const LabelWithInfo = (props: LabelWithInfoProps) => {
  return (
    <LabelWithInfoContainer title={props.title || undefined} onClick={props.onClick}>
      <MessageInfoLabel color={props.labelColor}>{props.label}</MessageInfoLabel>
      <Flex $container={true} $justifyContent="flex-start" $alignItems="flex-start">
        <MessageInfoData color={props.dataColor}>{props.info}</MessageInfoData>
        {isDev ? (
          <CopyToClipboardIcon
            iconSize={'small'}
            copyContent={props.info}
            margin={'0 0 0 var(--margins-xs)'}
          />
        ) : null}
      </Flex>
    </LabelWithInfoContainer>
  );
};

const formatTimestampStr = 'hh:mm d LLL, yyyy' as const;

const DebugMessageInfo = ({ messageId }: { messageId: string }) => {
  const convoId = useSelectedConversationKey();
  const messageHash = useMessageHash(messageId);
  const serverId = useMessageServerId(messageId);
  const expirationType = useMessageExpirationType(messageId);
  const expirationDurationMs = useMessageExpirationDurationMs(messageId);
  const expirationTimestamp = useMessageExpirationTimestamp(messageId);
  const timestamp = useMessageTimestamp(messageId);
  const serverTimestamp = useMessageServerTimestamp(messageId);
  const message = useMessageBody(messageId);

  if (!isDevProd()) {
    return null;
  }
  // Note: the strings here are hardcoded because we do not share them with other platforms through crowdin
  return (
    <>
      {convoId ? <LabelWithInfo label={`Conversation ID:`} info={convoId} /> : null}
      {messageHash ? <LabelWithInfo label={`Message Hash:`} info={messageHash} /> : null}
      {serverId ? <LabelWithInfo label={`Server ID:`} info={`${serverId}`} /> : null}
      {timestamp ? <LabelWithInfo label={`Timestamp:`} info={String(timestamp)} /> : null}
      {serverTimestamp ? (
        <LabelWithInfo label={`Server Timestamp:`} info={String(serverTimestamp)} />
      ) : null}
      {expirationType ? <LabelWithInfo label={`Expiration Type:`} info={expirationType} /> : null}
      {expirationDurationMs ? (
        <LabelWithInfo
          label={`Expiration Duration:`}
          info={formatTimeDurationMs(Math.floor(expirationDurationMs))}
        />
      ) : null}
      {expirationTimestamp ? (
        <LabelWithInfo
          label={`Disappears:`}
          info={formatTimeDistanceToNow(Math.floor(expirationTimestamp / 1000))}
        />
      ) : null}
      {message ? (
        <LabelWithInfo label={'Characters:'} info={formatNumber(message.length ?? 0)} />
      ) : null}
    </>
  );
};

const StyledProMessageTitle = styled.div`
  display: flex;
  gap: var(--margins-xs);
  align-items: center;
  font-size: var(--font-size-xl);
  font-weight: bold;
`;

const StyledProDescription = styled.div`
  color: var(--text-primary-color);
  font-size: var(--font-size-lg);
`;

const StyledProFeatureRow = styled.div`
  color: var(--text-primary-color);
  display: flex;
  gap: var(--margins-xs);
  font-size: var(--font-size-lg);
`;

const StyledProFeaturesContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--margins-xs);
`;

function proFeatureToTrKey(proFeature: ProMessageFeature) {
  switch (proFeature) {
    case ProMessageFeature.PRO_BADGE:
      return 'proBadge' as const;
    case ProMessageFeature.PRO_INCREASED_MESSAGE_LENGTH:
      return 'proIncreasedMessageLengthFeature' as const;
    case ProMessageFeature.PRO_ANIMATED_DISPLAY_PICTURE:
      return 'proAnimatedDisplayPictureFeature' as const;
    default:
      assertUnreachable(proFeature, 'ProFeatureToTrKey: unknown case');
      throw new Error('unreachable');
  }
}

function ProMessageFeaturesDetails({ messageId }: { messageId: string }) {
  const currentUserHasPro = useCurrentUserHasPro();

  const messageSentWithProFeat = useMessageSentWithProFeatures(messageId);

  const showPro = useProBadgeOnClickCb({
    context: 'message-info-sent-with-pro',
    args: { messageSentWithProFeat, currentUserHasPro },
  });

  if (!showPro.show || !messageSentWithProFeat?.length) {
    return null;
  }

  return (
    <Flex
      $container={true}
      $flexDirection="column"
      marginBlock="0 var(--margins-md)"
      $flexGap="var(--margins-xs)"
    >
      <StyledProMessageTitle>
        <ProIconButton
          iconSize={'medium'}
          dataTestId="pro-badge-message-info"
          onClick={showPro.cb}
        />
        <Localizer token="message" />
      </StyledProMessageTitle>
      <StyledProDescription>
        <Localizer token="proMessageInfoFeatures" />
      </StyledProDescription>
      <StyledProFeaturesContainer>
        {messageSentWithProFeat.map(feature => (
          <StyledProFeatureRow key={feature}>
            <LucideIcon
              unicode={LUCIDE_ICONS_UNICODE.CIRCLE_CHECK}
              iconSize="medium"
              iconColor="var(--primary-color)"
            />
            <Localizer token={proFeatureToTrKey(feature)} />
          </StyledProFeatureRow>
        ))}
      </StyledProFeaturesContainer>
    </Flex>
  );
}

export const MessageInfo = ({ messageId, errors }: { messageId: string; errors?: string }) => {
  const sender = useMessageSender(messageId);
  const direction = useMessageDirection(messageId);
  const sentAt = useMessageTimestamp(messageId);
  const serverTimestamp = useMessageServerTimestamp(messageId);
  const receivedAt = useMessageReceivedAt(messageId);
  const isSenderAdmin = useMessageSenderIsAdmin(messageId);

  if (!messageId || !sender) {
    return null;
  }

  const sentAtStr = formatDateWithLocale({
    date: new Date(serverTimestamp || sentAt || 0),
    formatStr: formatTimestampStr,
  });
  const receivedAtStr = formatDateWithLocale({
    date: new Date(receivedAt || 0),
    formatStr: formatTimestampStr,
  });

  return (
    <Flex $container={true} $flexDirection="column" $flexGap="var(--margins-sm)">
      <ProMessageFeaturesDetails messageId={messageId} />
      <LabelWithInfo label={tr('sent')} info={sentAtStr} />
      <DebugMessageInfo messageId={messageId} />

      {direction === 'incoming' ? (
        <LabelWithInfo label={tr('received')} info={receivedAtStr} />
      ) : null}
      <SpacerSM />
      <MessageFrom sender={sender} isSenderAdmin={isSenderAdmin} />
      {!!errors && (
        <>
          <SpacerSM />
          <LabelWithInfo
            title={tr('helpReportABugExportLogsDescription')}
            label={`${tr('theError')}:`}
            info={errors || tr('errorUnknown')}
            dataColor={'var(--danger-color)'}
            onClick={() => {
              void saveLogToDesktop();
            }}
          />
        </>
      )}
    </Flex>
  );
};
