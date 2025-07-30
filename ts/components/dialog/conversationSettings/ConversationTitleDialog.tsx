import { useCurrentUserHasPro, useUserHasPro } from '../../../hooks/useHasPro';
import {
  useNicknameOrProfileNameOrShortenedPubkey,
  useIsPublic,
  useIsClosedGroup,
  useIsMe,
} from '../../../hooks/useParamSelector';
import { tr } from '../../../localization/localeTools';
import type { WithConvoId } from '../../../session/types/with';
import { H5 } from '../../basic/Heading';
import { ProIconButton } from '../../buttons/ProButton';
import { useChangeNickname } from '../../menuAndSettingsHooks/useChangeNickname';
import { useShowUpdateGroupNameDescriptionCb } from '../../menuAndSettingsHooks/useShowUpdateGroupNameDescription';
import { useProBadgeOnClickCb } from '../../menuAndSettingsHooks/useProBadgeOnClickCb';

/**
 * Return the callback to use for the title click event, if one is allowed
 */
function useOnTitleClickCb(conversationId: string, editable: boolean) {
  const changeNicknameCb = useChangeNickname(conversationId);
  const updateNameDescCb = useShowUpdateGroupNameDescriptionCb({ conversationId });
  if (!editable) {
    return null;
  }
  return changeNicknameCb || updateNameDescCb;
}

export const ConversationTitleDialog = ({
  conversationId,
  editable,
}: WithConvoId & { editable: boolean }) => {
  const nicknameOrDisplayName = useNicknameOrProfileNameOrShortenedPubkey(conversationId);
  const isCommunity = useIsPublic(conversationId);
  const isClosedGroup = useIsClosedGroup(conversationId);
  const isMe = useIsMe(conversationId);
  const weArePro = useCurrentUserHasPro();

  const userHasPro = useUserHasPro(conversationId);

  const onClickCb = useOnTitleClickCb(conversationId, editable);

  // the data-test-id depends on the type of conversation
  const dataTestId = isCommunity
    ? 'community-name'
    : isClosedGroup
      ? 'group-name'
      : // for 1o1, this will hold the nickname if set, or the display name
        'preferred-display-name';

  const onProClickCb = useProBadgeOnClickCb({
    context: 'conversation-title-dialog',
    args: { userHasPro, currentUserHasPro: weArePro },
  });

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
      {isMe ? tr('noteToSelf') : nicknameOrDisplayName}
      {onProClickCb ? (
        <ProIconButton
          dataTestId="pro-badge-conversation-title"
          iconSize={'medium'}
          disabled={weArePro}
          onClick={onProClickCb}
          style={{ display: 'inline', marginInlineStart: 'var(--margins-xs)' }}
        />
      ) : null}
    </H5>
  );
};
