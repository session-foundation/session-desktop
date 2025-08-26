/* eslint-disable no-case-declarations */
import { AbortSignal } from 'abort-controller';
import { flatten, isEmpty, isNumber, isObject } from 'lodash';
import { OpenGroupData } from '../../../../data/opengroups';
import { assertUnreachable, roomHasBlindEnabled } from '../../../../types/sqlSharedTypes';
import { Reactions } from '../../../../util/reactions';
import { OnionSending, OnionV4JSONSnodeResponse } from '../../../onions/onionSend';
import { MethodBatchType } from '../../snode_api/SnodeRequestTypes';
import {
  OpenGroupPollingUtils,
  OpenGroupRequestHeaders,
} from '../opengroupV2/OpenGroupPollingUtils';
import { addJsonContentTypeToHeaders } from './sogsV3SendMessage';
import type {
  WithImageId,
  WithMessageId,
  WithRoomDescription,
  WithRoomId,
  WithRoomName,
  WithSessionIds,
} from './sogsWith';

type BatchFetchRequestOptions = {
  method: 'POST' | 'PUT' | 'GET' | 'DELETE';
  path: string;
  headers?: any;
};

/**
 * Should only have this or the json field but not both at the same time
 */
type BatchBodyRequestSharedOptions = {
  method: 'POST' | 'PUT' | 'GET' | 'DELETE';
  path: string;
  headers?: any;
};

interface BatchJsonSubRequestOptions extends BatchBodyRequestSharedOptions {
  json: object;
}

type BatchBodyRequest = BatchJsonSubRequestOptions;

type BatchSubRequest = BatchBodyRequest | BatchFetchRequestOptions;

type BatchRequest = {
  /** Used by server to process request */
  endpoint: string;
  /** Used by server to process request */
  method: string;
  /** Used by server to process request */
  body: string;
  /** Used by server to process request and authentication */
  headers: OpenGroupRequestHeaders;
};

export type BatchSogsResponse = {
  status_code: number;
  body?: Array<{ body: object; code: number; headers?: Record<string, string> }>;
};

export const sogsBatchSend = async (
  serverUrl: string,
  roomInfos: Set<string>,
  abortSignal: AbortSignal,
  batchRequestOptions: Array<OpenGroupBatchRow>,
  batchType: MethodBatchType,
  timeoutMs: number
): Promise<BatchSogsResponse | null> => {
  // getting server pk for room
  const [roomId] = roomInfos;
  const fetchedRoomInfo = OpenGroupData.getV2OpenGroupRoomByRoomId({
    serverUrl,
    roomId,
  });
  if (!fetchedRoomInfo || !fetchedRoomInfo?.serverPublicKey) {
    window?.log?.warn("Couldn't get fetched info or server public key -- aborting batch request");
    return null;
  }
  const { serverPublicKey } = fetchedRoomInfo;
  // send with blinding if we need to

  const requireBlinding = Boolean(roomHasBlindEnabled(fetchedRoomInfo));
  // creating batch request
  const batchRequest = await getBatchRequest(
    serverPublicKey,
    batchRequestOptions,
    requireBlinding,
    batchType
  );
  if (!batchRequest) {
    window?.log?.error('Could not generate batch request. Aborting request');
    return null;
  }

  const result = await sendSogsBatchRequestOnionV4(
    serverUrl,
    serverPublicKey,
    batchRequest,
    abortSignal,
    timeoutMs
  );
  if (abortSignal.aborted) {
    window.log.info('sendSogsBatchRequestOnionV4 aborted.');
    return null;
  }

  return result || null;
};

export function parseBatchGlobalStatusCode(
  response?: BatchSogsResponse | OnionV4JSONSnodeResponse | null
): number | undefined {
  return response?.status_code;
}

export function batchGlobalIsSuccess(
  response?: BatchSogsResponse | OnionV4JSONSnodeResponse | null
): boolean {
  const status = parseBatchGlobalStatusCode(response);
  return Boolean(status && isNumber(status) && status >= 200 && status <= 300);
}

function parseBatchFirstSubStatusCode(response?: BatchSogsResponse | null): number | undefined {
  return response?.body?.[0].code;
}

export function batchFirstSubIsSuccess(response?: BatchSogsResponse | null): boolean {
  const status = parseBatchFirstSubStatusCode(response);
  return Boolean(status && isNumber(status) && status >= 200 && status <= 300);
}

export type SubRequestCapabilitiesType = { type: 'capabilities' };

export type SubRequestMessagesObjectType =
  | (WithRoomId & {
      sinceSeqNo?: number;
    })
  | undefined;

export type SubRequestMessagesType = {
  type: 'messages';
  messages?: SubRequestMessagesObjectType;
};

export type SubRequestPollInfoType = {
  type: 'pollInfo';
  pollInfo: WithRoomId & {
    infoUpdated?: number;
  };
};

export type SubRequestInboxType = {
  type: 'inbox';
  inbox?: {
    /**
     * Deletes all of the user's received messages.
     * @returns a JSON object with one key "deleted" set to the number of
     * deleted messages.
     */
    type: 'delete';
  };
  inboxSince?: {
    id?: number;
  };
};

export type SubRequestOutboxType = {
  type: 'outbox';
  outboxSince?: {
    id?: number;
  };
};

export type SubRequestDeleteMessageType = {
  type: 'deleteMessage';
  deleteMessage: WithRoomId & WithMessageId;
};

export type SubRequestAddRemoveModeratorType = {
  type: 'addRemoveModerators';
  addRemoveModerators: WithSessionIds & // can be blinded id or not
    WithRoomId & {
      // for now we support only granting/removing mods to single rooms from session
      type: 'add_mods' | 'remove_mods';
    };
};

export type SubRequestBanUnbanUserType = {
  type: 'banUnbanUser';
  banUnbanUser: {
    type: 'ban' | 'unban';
    sessionId: string; // can be blinded id or not
    roomId: string;
  };
};

export type SubRequestDeleteAllUserPostsType = {
  type: 'deleteAllPosts';
  deleteAllPosts: {
    sessionId: string; // can be blinded id or not
    roomId: string;
  };
};

export type SubRequestUpdateRoomType = {
  type: 'updateRoom';
  updateRoom: WithRoomId &
    Partial<
      WithImageId &
        // the fileId uploaded to this sogs and to be referenced as preview/room
        WithRoomName &
        WithRoomDescription
    >;
};

export type SubRequestDeleteReactionType = {
  type: 'deleteReaction';
  deleteReaction: {
    reaction: string;
    messageId: number;
    roomId: string;
  };
};

export type OpenGroupBatchRow =
  | SubRequestCapabilitiesType
  | SubRequestMessagesType
  | SubRequestPollInfoType
  | SubRequestInboxType
  | SubRequestOutboxType
  | SubRequestDeleteMessageType
  | SubRequestAddRemoveModeratorType
  | SubRequestBanUnbanUserType
  | SubRequestDeleteAllUserPostsType
  | SubRequestUpdateRoomType
  | SubRequestDeleteReactionType;

/**
 *
 * @param options Array of subRequest options to be made.
 */
const makeBatchRequestPayload = (
  options: OpenGroupBatchRow
): BatchSubRequest | Array<BatchSubRequest> | null => {
  const type = options.type;
  switch (type) {
    case 'capabilities':
      return {
        method: 'GET',
        path: '/capabilities',
      };

    case 'messages':
      if (options.messages) {
        return {
          method: 'GET',
          path: isNumber(options.messages.sinceSeqNo)
            ? `/room/${options.messages.roomId}/messages/since/${options.messages.sinceSeqNo}?t=r&reactors=${Reactions.SOGSReactorsFetchCount}`
            : `/room/${options.messages.roomId}/messages/recent?reactors=${Reactions.SOGSReactorsFetchCount}`,
        };
      }
      break;

    case 'inbox':
      if (options.inbox?.type === 'delete') {
        return {
          method: 'DELETE',
          path: '/inbox',
        };
      }

      return {
        method: 'GET',
        path:
          options?.inboxSince?.id && isNumber(options.inboxSince.id)
            ? `/inbox/since/${options.inboxSince.id}`
            : '/inbox',
      };

    case 'outbox':
      return {
        method: 'GET',
        path:
          options?.outboxSince?.id && isNumber(options.outboxSince.id)
            ? `/outbox/since/${options.outboxSince.id}`
            : '/outbox',
      };

    case 'pollInfo':
      return {
        method: 'GET',
        path: `/room/${options.pollInfo.roomId}/pollInfo/${options.pollInfo.infoUpdated}`,
      };

    case 'deleteMessage':
      return {
        method: 'DELETE',
        path: `/room/${options.deleteMessage.roomId}/message/${options.deleteMessage.messageId}`,
      };

    case 'addRemoveModerators':
      const isAddMod = Boolean(options.addRemoveModerators.type === 'add_mods');
      return options.addRemoveModerators.sessionIds.map(sessionId => ({
        method: 'POST',
        path: `/user/${sessionId}/moderator`,

        // An admin has moderator permissions automatically, but removing his admin permissions only will keep him as a moderator.
        // We do not want this currently. When removing an admin from Session Desktop we want to remove all his permissions server side.
        // We'll need to build a complete dialog with options to make the whole admins/moderator/global/visible/hidden logic work as the server was built for.
        json: {
          rooms: [options.addRemoveModerators.roomId],
          global: false,
          visible: true,
          admin: isAddMod,
          moderator: isAddMod,
        },
      }));
    case 'banUnbanUser':
      const isBan = Boolean(options.banUnbanUser.type === 'ban');
      return {
        method: 'POST',
        path: `/user/${options.banUnbanUser.sessionId}/${isBan ? 'ban' : 'unban'}`,
        json: {
          rooms: [options.banUnbanUser.roomId],

          // watch out ban and unban user do not allow the same args
          // global: false, // for now we do not support the global argument, rooms cannot be set if we use it
          // timeout: null, // for now we do not support the timeout argument
        },
      };
    case 'deleteAllPosts':
      return {
        method: 'DELETE',
        path: `/room/${options.deleteAllPosts.roomId}/all/${options.deleteAllPosts.sessionId}`,
      };
    case 'updateRoom':
      if (
        !options.updateRoom.imageId &&
        !options.updateRoom.roomName &&
        !options.updateRoom.roomDescription
      ) {
        throw new Error('updateRoom requires at least one of imageId, roomName or roomDescription');
      }

      const json = {
        image: options.updateRoom.imageId,
        name: options.updateRoom.roomName,
        description: options.updateRoom.roomDescription,
      };

      return {
        method: 'PUT',
        path: `/room/${options.updateRoom.roomId}`,
        json,
      };

    case 'deleteReaction':
      return {
        method: 'DELETE',
        path: `/room/${options.deleteReaction.roomId}/reactions/${options.deleteReaction.messageId}/${options.deleteReaction.reaction}`,
      };
    default:
      assertUnreachable(type, 'Invalid batch request row');
  }

  return null;
};

/**
 * Get the request to get all of the details we care from an opengroup, across all rooms.
 * Only compatible with v4 onion requests.
 *
 * if isSequence is set to true, each rows will be run in order until the first one fails
 */
const getBatchRequest = async (
  serverPublicKey: string,
  batchOptions: Array<OpenGroupBatchRow>,
  requireBlinding: boolean,
  batchType: MethodBatchType
): Promise<BatchRequest | undefined> => {
  const batchEndpoint = `/${batchType}` as const;
  const batchMethod = 'POST';
  if (!batchOptions || isEmpty(batchOptions)) {
    return undefined;
  }

  const batchBody = flatten(
    batchOptions.map(options => {
      return makeBatchRequestPayload(options);
    })
  );

  const stringBody = JSON.stringify(batchBody);

  const headers = await OpenGroupPollingUtils.getOurOpenGroupHeaders(
    serverPublicKey,
    batchEndpoint,
    batchMethod,
    requireBlinding,
    stringBody
  );

  if (!headers) {
    window?.log?.error('Unable to create headers for batch request - aborting');
    return undefined;
  }

  return {
    endpoint: batchEndpoint,
    method: batchMethod,
    body: stringBody,
    headers: addJsonContentTypeToHeaders(headers),
  };
};

const sendSogsBatchRequestOnionV4 = async (
  serverUrl: string,
  serverPubkey: string,
  request: BatchRequest,
  abortSignal: AbortSignal,
  timeoutMs: number
): Promise<null | BatchSogsResponse> => {
  const { endpoint, headers, method, body } = request;
  if (!endpoint.startsWith('/')) {
    throw new Error('endpoint needs a leading /');
  }
  const builtUrl = new URL(`${serverUrl}${endpoint}`);

  // this function extracts the body and status_code and JSON.parse it already
  const batchResponse = await OnionSending.sendViaOnionV4ToNonSnodeWithRetries(
    serverPubkey,
    builtUrl,
    {
      method,
      headers,
      body,
      useV4: true,
    },
    false,
    abortSignal,
    timeoutMs
  );

  if (abortSignal.aborted) {
    return null;
  }

  if (!batchResponse) {
    window?.log?.error('sogsbatch: Undefined batch response - cancelling batch request');
    return null;
  }
  if (isObject(batchResponse.body)) {
    return batchResponse as BatchSogsResponse;
  }

  window?.log?.warn('sogsbatch: batch response decoded body is not object. Returning null');
  return null;
};
