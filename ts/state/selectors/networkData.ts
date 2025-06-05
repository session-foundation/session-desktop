import { useSelector } from 'react-redux';
import type { Address } from 'viem';
import type { StateType } from '../reducer';
import type { NetworkDataState } from '../ducks/networkData';
import { NetworkTime } from '../../util/NetworkTime';

export const getNetworkData = (state: StateType): NetworkDataState => {
  return state.networkData;
};

// #region - Getters
const getInfoTimestamp = (state: StateType) => getNetworkData(state).t || 0;

const getNetworkStatusCode = (state: StateType) => getNetworkData(state).status_code;

const getUSDPrice = (state: StateType) => getNetworkData(state).price?.usd;

const getUSDMarketCap = (state: StateType) => getNetworkData(state).price?.usd_market_cap;

const getPriceTimestamp = (state: StateType) => getNetworkData(state).price?.t_price;

const getStalePriceTimestamp = (state: StateType) => {
  const t_stale = getNetworkData(state).price?.t_stale;
  return t_stale;
};

const getStakingRequirement = (state: StateType) =>
  getNetworkData(state).token?.staking_requirement;

const getStakingRewardPool = (state: StateType) => getNetworkData(state).token?.staking_reward_pool;

const getTokenContractAddress = (state: StateType) => getNetworkData(state).token?.contract_address;

const getNetworkSize = (state: StateType) => getNetworkData(state).network?.network_size;

const getNetworkStakedTokens = (state: StateType) =>
  getNetworkData(state).network?.network_staked_tokens;

const getNetworkStakedUSD = (state: StateType) => getNetworkData(state).network?.network_staked_usd;

// #endregion

// #region - Hooks

/**
 * @returns true if we have stale data (or not data)
 */
export const useDataIsStale = (): boolean => {
  const staleTimestamp = useStalePriceTimestamp() || 0;

  return NetworkTime.getNowWithNetworkOffsetSeconds() > staleTimestamp;
};

export const useInfoTimestamp = (): number => {
  return useSelector(getInfoTimestamp);
};

export const useNetworkStatusCode = (): number | null => {
  return useSelector(getNetworkStatusCode);
};

export const useUSDPrice = (): number | null => {
  const usdPrice = useSelector(getUSDPrice);
  return usdPrice;
};

export const useUSDMarketCap = (): number | null => {
  const usdMarketCap = useSelector(getUSDMarketCap);
  return usdMarketCap;
};

export const usePriceTimestamp = (): number | null => {
  return useSelector(getPriceTimestamp);
};

export const useStalePriceTimestamp = (): number | null => {
  return useSelector(getStalePriceTimestamp);
};

export const useStakingRequirement = (): number | null => {
  return useSelector(getStakingRequirement);
};

export const useStakingRewardPool = (): number | null => {
  const stakingRewardPool = useSelector(getStakingRewardPool);
  return stakingRewardPool;
};

export const useTokenContractAddress = (): Address | null => {
  return useSelector(getTokenContractAddress);
};

export const useNetworkSize = (): number | null => {
  return useSelector(getNetworkSize);
};

export const useNetworkStakedTokens = (): number | null => {
  const networkStakedTokens = useSelector(getNetworkStakedTokens);
  return networkStakedTokens;
};

export const useNetworkStakedUSD = (): number | null => {
  const networkStakedUSD = useSelector(getNetworkStakedUSD);
  return networkStakedUSD;
};

// #endregion
