import AbortController from 'abort-controller';
import { PubKey } from '../../../types';
import { batchFirstSubIsSuccess, OpenGroupBatchRow, sogsBatchSend } from './sogsV3BatchPoll';
import { OpenGroupRequestCommonType } from '../../../../data/types';
import { DURATION } from '../../../constants';

export const sogsV3BanUser = async (
  userToBan: PubKey,
  roomInfos: OpenGroupRequestCommonType,
  deleteAllMessages: boolean
): Promise<boolean> => {
  const sequence: Array<OpenGroupBatchRow> = [
    {
      type: 'banUnbanUser',
      banUnbanUser: {
        sessionId: userToBan.key,
        roomId: roomInfos.roomId,
        type: 'ban',
      },
    },
  ];

  if (deleteAllMessages) {
    sequence.push({
      type: 'deleteAllPosts',
      deleteAllPosts: { sessionId: userToBan.key, roomId: roomInfos.roomId },
    });
  }

  const batchSendResponse = await sogsBatchSend(
    roomInfos.serverUrl,
    new Set([roomInfos.roomId]),
    new AbortController().signal,
    sequence,
    'sequence',
    10 * DURATION.SECONDS
  );
  return batchFirstSubIsSuccess(batchSendResponse);
};

export const sogsV3UnbanUser = async (
  userToBan: PubKey,
  roomInfos: OpenGroupRequestCommonType
): Promise<boolean> => {
  const batchSendResponse = await sogsBatchSend(
    roomInfos.serverUrl,
    new Set([roomInfos.roomId]),
    new AbortController().signal,
    [
      {
        type: 'banUnbanUser',
        banUnbanUser: {
          sessionId: userToBan.key,
          roomId: roomInfos.roomId,
          type: 'unban',
        },
      },
    ],
    'batch',
    10 * DURATION.SECONDS
  );
  return batchFirstSubIsSuccess(batchSendResponse);
};
