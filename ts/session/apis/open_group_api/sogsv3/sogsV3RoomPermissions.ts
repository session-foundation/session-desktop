/**
 * @file
 * Set certain default room permissions.
 */

import AbortController from 'abort-controller';
import { OpenGroupRequestCommonType } from '../../../../data/types';
import { sogsBatchSend } from './sogsV3BatchPoll';

export type OpenGroupRoomPermissionType =
  | 'default_read'
  | 'default_write'
  | 'default_accessible'
  | 'default_upload';

export type OpenGroupRoomPermissionSetType = Record<OpenGroupRoomPermissionType, boolean>;

type PermsToSet = Partial<OpenGroupRoomPermissionSetType>;

export const sogsV3SetRoomPermissions = async (
  roomInfos: OpenGroupRequestCommonType,
  permissions: OpenGroupRoomPermissionSetType
): Promise<boolean> => {
  const permsToSet: PermsToSet = {};
  Object.entries(permissions).forEach(([permission, value]) => {
    permsToSet[permission as OpenGroupRoomPermissionType] = value;
  });
  const batchSendResponse = await sogsBatchSend(
    roomInfos.serverUrl,
    new Set([roomInfos.roomId]),
    new AbortController().signal,
    [
      {
        type: 'updateRoomPerms',
        updateRoomPerms: {
          roomId: roomInfos.roomId,
          permsToSet,
        },
      },
    ],
    'batch'
  );
  const isSuccess = batchSendResponse?.body?.every(m => m?.code === 200) || false;
  if (!isSuccess) {
    window.log.warn('set permissions failed with body', batchSendResponse?.body);
  }
  return isSuccess;
};
