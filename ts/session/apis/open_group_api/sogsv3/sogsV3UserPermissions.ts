/**
 * @file
 * Add, remove, or clear certain per-room user permissions.
 */

import AbortController from 'abort-controller';
import { PubKey } from '../../../types';
import { OpenGroupRequestCommonType } from '../../../../data/types';
import { sogsBatchSend } from './sogsV3BatchPoll';

export type OpenGroupPermissionType = 'access' | 'read' | 'upload' | 'write';

export const sogsV3AddPermissions = async (
  usersToAddPermissionsTo: Array<PubKey>,
  roomInfos: OpenGroupRequestCommonType,
  permissions: Array<OpenGroupPermissionType>
): Promise<boolean> => {
  const batchSendResponse = await sogsBatchSend(
    roomInfos.serverUrl,
    new Set([roomInfos.roomId]),
    new AbortController().signal,
    usersToAddPermissionsTo.map((user) => (
      {
        type: 'updateRoomUserPerms',
        updateUserRoomPerms: {
          roomId: roomInfos.roomId,
          sessionId: user.key,
          permsToAdd: permissions,
        }
      }
    )),
    'batch'
  );
  const isSuccess = batchSendResponse?.body?.every(m => m?.code === 200) || false;
  if (!isSuccess) {
    window.log.warn('add permissions failed with body', batchSendResponse?.body);
  }
  return isSuccess;
}

export const sogsV3ClearPermissions = async (
  usersToClearPermissionsFor: Array<PubKey>,
  roomInfos: OpenGroupRequestCommonType,
  permissions: Array<OpenGroupPermissionType>
): Promise<boolean> => {
  const batchSendResponse = await sogsBatchSend(
    roomInfos.serverUrl,
    new Set([roomInfos.roomId]),
    new AbortController().signal,
    usersToClearPermissionsFor.map((user) => (
      {
        type: 'updateRoomUserPerms',
        updateUserRoomPerms: {
          roomId: roomInfos.roomId,
          sessionId: user.key,
          permsToClear: permissions
        }
      }
    )),
    'batch'
  );
  const isSuccess = batchSendResponse?.body?.every(m => m?.code === 200) || false;
  if (!isSuccess) {
    window.log.warn('add permissions failed with body', batchSendResponse?.body);
  }
  return isSuccess;
}
