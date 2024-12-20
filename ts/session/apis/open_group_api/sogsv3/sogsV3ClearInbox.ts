import AbortController from 'abort-controller';
import { ConvoHub } from '../../../conversations';
import { getOpenGroupV2ConversationId } from '../utils/OpenGroupUtils';
import {
  batchFirstSubIsSuccess,
  batchGlobalIsSuccess,
  OpenGroupBatchRow,
  sogsBatchSend,
} from './sogsV3BatchPoll';
import { OpenGroupRequestCommonType } from '../../../../data/types';
import { DURATION } from '../../../constants';

type OpenGroupClearInboxResponse = {
  deleted: number;
};

export const clearInbox = async (roomInfos: OpenGroupRequestCommonType): Promise<boolean> => {
  let success = false;

  const conversationId = getOpenGroupV2ConversationId(roomInfos.serverUrl, roomInfos.roomId);
  const conversation = ConvoHub.use().get(conversationId);

  if (!conversation) {
    throw new Error(`clearInbox Matching conversation not found in db ${conversationId}`);
  }
  const options: Array<OpenGroupBatchRow> = [
    {
      type: 'inbox',
      inbox: {
        type: 'delete',
      },
    },
  ];

  const abortSignal = new AbortController();

  const result = await sogsBatchSend(
    roomInfos.serverUrl,
    new Set([roomInfos.roomId]),
    abortSignal.signal,
    options,
    'batch',
    10 * DURATION.SECONDS
  );

  if (!result) {
    throw new Error(`Could not clearInbox, res is invalid for ${conversationId}`);
  }

  const rawMessage = (result.body && (result.body[0].body as OpenGroupClearInboxResponse)) || null;
  if (!rawMessage) {
    throw new Error(`clearInbox parsing failed for ${conversationId}`);
  }

  try {
    if (batchGlobalIsSuccess(result) && batchFirstSubIsSuccess(result)) {
      success = true;
      window.log.info(`clearInbox ${rawMessage.deleted} messages deleted for ${conversationId} `);
    }
  } catch (e) {
    window?.log?.error(`clearInbox Can't decode JSON body for ${conversationId}`);
  }

  if (!success) {
    window.log.info(`clearInbox message deletion failed for ${conversationId}`);
  }
  return success;
};
