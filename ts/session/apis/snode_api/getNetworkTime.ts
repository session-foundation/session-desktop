/**
 * Makes a post to a node to receive the timestamp info. If non-existent, returns -1
 * @param snode Snode to send request to
 * @returns timestamp of the response from snode
 */

import { isNumber } from 'lodash';

import { NetworkTime } from '../../../util/NetworkTime';

function handleTimestampOffsetFromNetwork(_request: string, snodeTimestamp: number) {
  if (snodeTimestamp && isNumber(snodeTimestamp) && snodeTimestamp > 1609419600 * 1000) {
    // first january 2021. Arbitrary, just want to make sure the return timestamp is somehow valid and not some crazy low value
    const clockTime = Date.now();
    NetworkTime.setLatestTimestampOffset(clockTime - snodeTimestamp);
  }
}

export const GetNetworkTime = {
  handleTimestampOffsetFromNetwork,
};
