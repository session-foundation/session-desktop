import { useIsPublic, useWeAreAdmin } from '../../hooks/useParamSelector';
import { localize } from '../../localization/localeTools';
import { sogsV3RemoveAdmins } from '../../session/apis/open_group_api/sogsv3/sogsV3AddRemoveMods';
import { ConvoHub } from '../../session/conversations';
import { PubKey } from '../../session/types';
import { ToastUtils } from '../../session/utils';

async function removeSenderFromCommunityAdmin(sender: string, convoId: string) {
  try {
    const pubKeyToRemove = PubKey.cast(sender);
    const convo = ConvoHub.use().getOrThrow(convoId);

    const userDisplayName =
      ConvoHub.use().get(sender)?.getNicknameOrRealUsernameOrPlaceholder() ||
      localize('unknown').toString();

    const roomInfo = convo.toOpenGroupV2();
    const res = await sogsV3RemoveAdmins([pubKeyToRemove], roomInfo);
    if (!res) {
      window?.log?.warn('failed to remove moderator:', res);

      ToastUtils.pushFailedToRemoveFromModerator([userDisplayName]);
    } else {
      window?.log?.info(`${pubKeyToRemove.key} removed from moderators...`);
      ToastUtils.pushUserRemovedFromModerators([userDisplayName]);
    }
  } catch (e) {
    window?.log?.error('Got error while removing moderator:', e);
  }
}

export function useRemoveSenderFromCommunityAdmin({
  conversationId,
  senderId,
}: {
  conversationId?: string;
  senderId?: string;
}) {
  const isPublic = useIsPublic(conversationId);
  const weAreCommunityAdmin = useWeAreAdmin(conversationId);

  // only an admin can promote/demote moderators in a community. Another moderator cannot.

  if (!isPublic || !conversationId || !senderId || !weAreCommunityAdmin) {
    return null;
  }

  return () => {
    void removeSenderFromCommunityAdmin(senderId, conversationId);
  };
}
