import {
  sogsV3AddPermissions,
  sogsV3ClearPermissions,
  type OpenGroupPermissionType,
} from '../../session/apis/open_group_api/sogsv3/sogsV3UserPermissions';
import { ConvoHub } from '../../session/conversations';
import { PubKey } from '../../session/types';
import { ToastUtils } from '../../session/utils';
import { getFeatureFlag } from '../../state/ducks/types/releasedFeaturesReduxTypes';

export function useAddUserPermissions(
  sender: string | undefined,
  convoId: string | undefined,
  permissions: Array<OpenGroupPermissionType>
) {
  if (!sender || !convoId || !permissions.length || !getFeatureFlag('useDevCommunityActions')) {
    return null;
  }
  return async () => {
    try {
      const user = PubKey.cast(sender);
      const convo = ConvoHub.use().getOrThrow(convoId);

      const roomInfo = convo.toOpenGroupV2();
      const res = await sogsV3AddPermissions([user], roomInfo, permissions);
      if (!res) {
        window?.log?.warn('failed to add user permissions:', res);

        ToastUtils.pushFailedToChangeUserPermissions();
      } else {
        window?.log?.info(`${user.key} given permissions ${permissions.join(', ')}...`);
        ToastUtils.pushUserPermissionsChanged();
      }
    } catch (e) {
      window?.log?.error('Got error while adding user permissions:', e);
      ToastUtils.pushFailedToChangeUserPermissions();
    }
  };
}

export function useClearUserPermissions(
  sender: string | undefined,
  convoId: string | undefined,
  permissions: Array<OpenGroupPermissionType>
) {
  if (!sender || !convoId || !permissions.length || !getFeatureFlag('useDevCommunityActions')) {
    return null;
  }
  return async () => {
    try {
      const user = PubKey.cast(sender);
      const convo = ConvoHub.use().getOrThrow(convoId);

      const roomInfo = convo.toOpenGroupV2();
      const res = await sogsV3ClearPermissions([user], roomInfo, permissions);
      if (!res) {
        window?.log?.warn('failed to clear user permissions:', res);

        ToastUtils.pushFailedToChangeUserPermissions();
      } else {
        window?.log?.info(`${user.key} given permissions ${permissions.join(', ')}...`);
        ToastUtils.pushUserPermissionsChanged();
      }
    } catch (e) {
      window?.log?.error('Got error while clearing user permissions:', e);
      ToastUtils.pushFailedToChangeUserPermissions();
    }
  };
}
