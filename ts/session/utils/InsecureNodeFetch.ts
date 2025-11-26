import nodeFetch, {
  type FetchError,
  type RequestInfo,
  type RequestInit,
  type Response,
} from 'node-fetch';
import { ReduxOnionSelectors } from '../../state/selectors/onions';
import { ERROR_CODE_NO_CONNECT } from '../apis/snode_api/SNodeAPI';
import { getFeatureFlag } from '../../state/ducks/types/releasedFeaturesReduxTypes';
import { updateIsOnline } from '../../state/ducks/onions';

function debugLogRequestIfEnabled(params: NodeFetchParams) {
  if (getFeatureFlag('debugInsecureNodeFetch')) {
    const logObj = {
      ...params,
      destination: `${FetchDestination[params.destination]} (${params.destination})`,
    };
    window?.log?.debug('insecureNodeFetch request: ', logObj);
  }
}

function debugLogResponseIfEnabled(response: Response) {
  if (getFeatureFlag('debugInsecureNodeFetch')) {
    const logObj = {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    };
    window?.log?.debug('insecureNodeFetch response: ', logObj);
  }
}

export function setIsOnlineIfDifferent(v: boolean) {
  if (ReduxOnionSelectors.isOnlineOutsideRedux() !== v) {
    window.inboxStore?.dispatch(updateIsOnline(v));
    if (getFeatureFlag('debugOnlineState')) {
      window?.log?.debug(`Setting isOnline to ${v}`);
    }
  }
}

enum NodeFetchErrorCode {
  ENETUNREACH = 'ENETUNREACH',
  EHOSTUNREACH = 'EHOSTUNREACH',
}

export enum FetchDestination {
  SERVICE_NODE = 1,
  SEED_NODE = 2,
  SESSION_SERVER = 3,
  SOGS = 4,
  PUBLIC = 5,
}

function isFetchError(e: Error): e is FetchError {
  return 'code' in e;
}

function isClientOfflineFromError(e: FetchError) {
  return e.code === NodeFetchErrorCode.EHOSTUNREACH || e.code === NodeFetchErrorCode.ENETUNREACH;
}

// If a request succeeds and was for any destination on the Session Network we want to set online to true.
function handleGoOnline(response: Response, destination: FetchDestination) {
  if (
    response.ok &&
    (destination === FetchDestination.SERVICE_NODE ||
      destination === FetchDestination.SEED_NODE ||
      destination === FetchDestination.SESSION_SERVER ||
      destination === FetchDestination.SOGS)
  ) {
    setIsOnlineIfDifferent(true);
  }
}

// Only go offline if the device itself is offline
function handleGoOffline(error: Error) {
  if (
    !navigator.onLine ||
    error.message === ERROR_CODE_NO_CONNECT ||
    (isFetchError(error) && isClientOfflineFromError(error))
  ) {
    setIsOnlineIfDifferent(false);
  }
}

type NodeFetchParams = {
  url: RequestInfo;
  fetchOptions?: RequestInit;
  destination: FetchDestination;
  caller: string;
};

export async function insecureNodeFetch(params: NodeFetchParams) {
  try {
    debugLogRequestIfEnabled(params);
    const result = await nodeFetch(params.url, params.fetchOptions);
    handleGoOnline(result, params.destination);
    debugLogResponseIfEnabled(result);
    return result;
  } catch (e) {
    handleGoOffline(e);
    window?.log?.error('insecureNodeFetch', e);
    throw e;
  }
}
