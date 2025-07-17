import { useIsPublic, useWeAreAdmin } from '../../hooks/useParamSelector';
import { tr } from '../../localization/localeTools';
import { sogsV3AddAdmin } from '../../session/apis/open_group_api/sogsv3/sogsV3AddRemoveMods';
import { ConvoHub } from '../../session/conversations';
import { PubKey } from '../../session/types';
import { ToastUtils } from '../../session/utils';

async function addSenderAsCommunityAdmin(sender: string, convoId: string) {
  try {
    const pubKeyToAdd = PubKey.cast(sender);
    const convo = ConvoHub.use().getOrThrow(convoId);

    const roomInfo = convo.toOpenGroupV2();
    const res = await sogsV3AddAdmin([pubKeyToAdd], roomInfo);
    if (!res) {
      window?.log?.warn('failed to add moderator:', res);

      ToastUtils.pushFailedToAddAsModerator();
    } else {
      window?.log?.info(`${pubKeyToAdd.key} added to moderators...`);
      const userDisplayName =
        ConvoHub.use().get(sender)?.getNicknameOrRealUsernameOrPlaceholder() || tr('unknown');
      ToastUtils.pushUserAddedToModerators([userDisplayName]);
    }
  } catch (e) {
    window?.log?.error('Got error while adding moderator:', e);
  }
}

export function useAddSenderAsCommunityAdmin({
  conversationId,
  senderId,
}: {
  conversationId?: string;
  senderId?: string;
}) {
  const isPublic = useIsPublic(conversationId);
  const weAreCommunityAdmin = useWeAreAdmin(conversationId);

  // only an admin can promote moderators in a community. Another moderator cannot.

  if (!isPublic || !conversationId || !senderId || !weAreCommunityAdmin) {
    return null;
  }

  return () => {
    void addSenderAsCommunityAdmin(senderId, conversationId);
  };
}
