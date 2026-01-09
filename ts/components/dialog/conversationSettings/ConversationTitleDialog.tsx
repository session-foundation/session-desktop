import { useCurrentUserHasPro, useShowProBadgeFor } from '../../../hooks/useHasPro';
import {
  useIsPublic,
  useIsClosedGroup,
  useIsMe,
  useConversationUsernameWithFallback,
  useIsGroupV2,
} from '../../../hooks/useParamSelector';
import { tr } from '../../../localization/localeTools';
import type { WithConvoId } from '../../../session/types/with';
import { H5 } from '../../basic/Heading';
import { ProIconButton } from '../../buttons/ProButton';
import { useChangeNickname } from '../../menuAndSettingsHooks/useChangeNickname';
import { useProBadgeOnClickCb } from '../../menuAndSettingsHooks/useProBadgeOnClickCb';
import { useShowUpdateGroupOrCommunityDetailsCb } from '../../menuAndSettingsHooks/useShowUpdateGroupNameDescription';

/**
 * Return the callback to use for the title click event, if one is allowed
 */
function useOnTitleClickCb(conversationId: string, editable: boolean) {
  const changeNicknameCb = useChangeNickname(conversationId);
  const updateGroupOrCommunityCb = useShowUpdateGroupOrCommunityDetailsCb({ conversationId });
  if (!editable) {
    return null;
  }
  return changeNicknameCb || updateGroupOrCommunityCb;
}

function ProBadge({ conversationId }: WithConvoId) {
  const weArePro = useCurrentUserHasPro();

  const showProBadgeForUser = useShowProBadgeFor(conversationId);
  const isMe = useIsMe(conversationId);
  const isGroupV2 = useIsGroupV2(conversationId);

  const onProClickCb = useProBadgeOnClickCb({
    context: 'conversation-title-dialog',
    args: { userHasPro: showProBadgeForUser, currentUserHasPro: weArePro, isMe, isGroupV2 },
  });

  if (!onProClickCb.show) {
    return null;
  }
  const sharedProps = {
    dataTestId: 'pro-badge-conversation-title',
    iconSize: 'medium',
    style: { display: 'inline', marginInlineStart: 'var(--margins-xs)', flexShrink: 0 },
  } as const;
  return <ProIconButton {...sharedProps} onClick={onProClickCb.cb} />;
}

// NOTE: [react-compiler] this has to live here for the hook to be identified as static
function useConversationDetailsInternal(conversationId?: string) {
  const nicknameOrDisplayName = useConversationUsernameWithFallback(true, conversationId);
  const isCommunity = useIsPublic(conversationId);
  const isClosedGroup = useIsClosedGroup(conversationId);
  const isMe = useIsMe(conversationId);

  return {
    nicknameOrDisplayName,
    isCommunity,
    isClosedGroup,
    isMe,
  };
}

export const ConversationTitleDialog = ({
  conversationId,
  editable,
}: WithConvoId & {
  editable: boolean;
}) => {
  const { nicknameOrDisplayName, isCommunity, isClosedGroup, isMe } =
    useConversationDetailsInternal(conversationId);

  const onClickCb = useOnTitleClickCb(conversationId, editable);

  // the data-test-id depends on the type of conversation
  const dataTestId = isCommunity
    ? 'community-name'
    : isClosedGroup
      ? 'group-name'
      : // for 1o1, this will hold the nickname if set, or the display name
        'preferred-display-name';

  return (
    <H5
      dataTestId={dataTestId}
      style={{
        wordBreak: 'break-all',
        textAlign: 'center',
        cursor: onClickCb ? 'pointer' : 'inherit',
      }}
      onClick={onClickCb || undefined}
    >
      {isMe ? tr('you') : nicknameOrDisplayName}
      <ProBadge conversationId={conversationId} />
    </H5>
  );
};
