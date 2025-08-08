import AbortController from 'abort-controller';
import { batchFirstSubIsSuccess, batchGlobalIsSuccess, sogsBatchSend } from './sogsV3BatchPoll';
import { OpenGroupRequestCommonType } from '../../../../data/types';
import { DURATION } from '../../../constants';
import type { WithRoomDescription, WithRoomName } from './sogsWith';

/**
 * This function can be used to change the room name and description of a room.
 * It will fail if the current user is not authorized, or if the name/description do not match the required format.
 */
export const changeRoomDetailsSogsV3 = async (
  roomInfos: OpenGroupRequestCommonType,
  change: Partial<WithRoomName & WithRoomDescription>
) => {
  if (!change.roomName && !change.roomDescription) {
    throw new Error('changeRoomDetailsSogsV3 requires at least one of roomName or roomDescription');
  }

  const batchResult = await sogsBatchSend(
    roomInfos.serverUrl,
    new Set([roomInfos.roomId]),
    new AbortController().signal,
    [
      {
        type: 'updateRoom',
        updateRoom: {
          roomId: roomInfos.roomId,
          roomName: change.roomName,
          roomDescription: change.roomDescription,
        },
      },
    ],
    'batch',
    10 * DURATION.SECONDS
  );

  if (!batchGlobalIsSuccess(batchResult) || !batchFirstSubIsSuccess(batchResult)) {
    window.log.warn(
      'changeRoomDetailsSogsV3 failed with',
      batchResult?.status_code,
      batchResult?.body
    );
    return false;
  }
  return true;
};
