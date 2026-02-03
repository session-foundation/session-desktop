import AbortController from 'abort-controller';
import { PubKey } from '../../../types';
import { batchFirstSubIsSuccess, OpenGroupBatchRow, sogsBatchSend } from './sogsV3BatchPoll';
import { OpenGroupRequestCommonType } from '../../../../data/types';
import { DURATION } from '../../../constants';
import {
  isServerBanUnban,
  type BanServerWideOrNot,
  type UnbanServerWideOrNot,
} from '../../../../state/ducks/modalDialog';

export const sogsV3BanUser = async (args: {
  roomInfos: OpenGroupRequestCommonType;
  userToBan: PubKey;
  deleteAllMessages: boolean;
  banType: BanServerWideOrNot;
}): Promise<boolean> => {
  const sequence: Array<OpenGroupBatchRow> = [
    {
      type: 'banUnbanUser',
      banUnbanUser: {
        sessionId: args.userToBan.key,
        type: args.banType,
        roomId: args.roomInfos.roomId,
      },
    },
  ];

  if (args.deleteAllMessages) {
    sequence.push(
      isServerBanUnban(args.banType)
        ? {
            type: 'deleteAllUserPosts',
            deleteAllUserPosts: { sessionId: args.userToBan.key },
          }
        : {
            type: 'deleteAllPosts',
            deleteAllPosts: { sessionId: args.userToBan.key, roomId: args.roomInfos.roomId },
          }
    );
  }

  const batchSendResponse = await sogsBatchSend(
    args.roomInfos.serverUrl,
    new Set([args.roomInfos.roomId]),
    new AbortController().signal,
    sequence,
    'sequence',
    10 * DURATION.SECONDS
  );
  const ret = batchFirstSubIsSuccess(batchSendResponse);

  if (!ret) {
    window.log.warn(
      `sogsV3BanUser failed with statuses:`,
      batchSendResponse?.body?.map(m => m.code)
    );
  }

  return ret;
};

export const sogsV3UnbanUser = async (args: {
  userToUnban: PubKey;
  roomInfos: OpenGroupRequestCommonType;
  banType: UnbanServerWideOrNot;
}): Promise<boolean> => {
  const batchSendResponse = await sogsBatchSend(
    args.roomInfos.serverUrl,
    new Set([args.roomInfos.roomId]),
    new AbortController().signal,
    [
      {
        type: 'banUnbanUser',
        banUnbanUser: {
          sessionId: args.userToUnban.key,
          type: args.banType,
          roomId: args.roomInfos.roomId,
        },
      },
    ],
    'batch',
    10 * DURATION.SECONDS
  );
  const ret = batchFirstSubIsSuccess(batchSendResponse);

  if (!ret) {
    window.log.warn(
      `sogsV3UnbanUser failed with statuses:`,
      batchSendResponse?.body?.map(m => m.code)
    );
  }

  return ret;
};
