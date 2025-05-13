import { useSelector } from 'react-redux';
import type { Address } from 'viem';
import type { StateType } from '../reducer';
import type { NetworkDataState } from '../ducks/networkData';

export const getNetworkData = (state: StateType): NetworkDataState => {
  return state.networkData;
};

// #region - Getters
const getInfoTimestamp = (state: StateType) => getNetworkData(state).t || 0;

const getUSDPrice = (state: StateType) => getNetworkData(state).price.usd;

const getUSDMarketCap = (state: StateType) => getNetworkData(state).price.usd_market_cap;

const getPriceTimestamp = (state: StateType) => getNetworkData(state).price.t_price;

const getStalePriceTimestamp = (state: StateType) => getNetworkData(state).price.t_stale;

const getStakingRequirement = (state: StateType) => getNetworkData(state).token.staking_requirement;

const getStakingRewardPool = (state: StateType) => getNetworkData(state).token.staking_reward_pool;

const getTokenContractAddress = (state: StateType) => getNetworkData(state).token.contract_address;

const getNetworkSize = (state: StateType) => getNetworkData(state).network.network_size;

const getNetworkStakedTokens = (state: StateType) =>
  getNetworkData(state).network.network_staked_tokens;

const getNetworkStakedUSD = (state: StateType) => getNetworkData(state).network.network_staked_usd;

// #endregion

// #region - Hooks
export const useInfoTimestamp = (): number => {
  return useSelector(getInfoTimestamp);
};

export const useUSDPrice = (): number | null => {
  return useSelector(getUSDPrice);
};

export const useUSDMarketCap = (): number | null => {
  return useSelector(getUSDMarketCap);
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
  return useSelector(getStakingRewardPool);
};

export const useTokenContractAddress = (): Address | null => {
  return useSelector(getTokenContractAddress);
};

export const useNetworkSize = (): number | null => {
  return useSelector(getNetworkSize);
};

export const useNetworkStakedTokens = (): number | null => {
  return useSelector(getNetworkStakedTokens);
};

export const useNetworkStakedUSD = (): number | null => {
  return useSelector(getNetworkStakedUSD);
};

// #endregion
