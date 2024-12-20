import { findIndex } from 'lodash';
import { OpenGroupData } from '../../../../data/opengroups';
import { DecodedResponseBodiesV4 } from '../../../onions/onionv4';
import { BatchSogsResponse, OpenGroupBatchRow } from './sogsV3BatchPoll';
import { parseCapabilities } from './sogsV3Capabilities';

/**
 * @param subRequestOptionsLookup list of subRequests used for the batch request (order sensitive)
 * @param batchPollResults The result from the batch request (order sensitive)
 */
export const getCapabilitiesFromBatch = (
  subRequestOptionsLookup: Array<OpenGroupBatchRow>,
  bodies: DecodedResponseBodiesV4
): Array<string> | null => {
  const capabilitiesBatchIndex = findIndex(
    subRequestOptionsLookup,
    (subRequest: OpenGroupBatchRow) => {
      return subRequest.type === 'capabilities';
    }
  );
  const capabilities: Array<string> | null =
    parseCapabilities(bodies?.[capabilitiesBatchIndex]?.body) || null;
  return capabilities;
};

/** using this as explicit way to ensure order  */
export const handleCapabilities = async (
  subRequestOptionsLookup: Array<OpenGroupBatchRow>,
  batchPollResults: BatchSogsResponse,
  serverUrl: string
  // roomId: string
): Promise<null | Array<string>> => {
  if (!batchPollResults.body) {
    return null;
  }
  const capabilities = getCapabilitiesFromBatch(subRequestOptionsLookup, batchPollResults.body);

  if (!capabilities) {
    window?.log?.error(
      'Failed capabilities subRequest - cancelling capabilities response handling'
    );
    return null;
  }

  // get all v2OpenGroup rooms with the matching serverUrl and set the capabilities.
  // TODOLATER: capabilities are shared across a server, not a room. We should probably move this to the server but we do not a server level currently, just rooms

  const rooms = OpenGroupData.getV2OpenGroupRoomsByServerUrl(serverUrl);

  if (!rooms || !rooms.length) {
    window?.log?.error('handleCapabilities - Found no groups with matching server url');
    return null;
  }

  const updatedRooms = rooms.map(r => ({ ...r, capabilities }));
  await OpenGroupData.saveV2OpenGroupRooms(updatedRooms);

  return capabilities;
};
