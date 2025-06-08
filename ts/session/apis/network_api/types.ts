// #region /info

// NOTE: Dont import the whole package because we would need to setup the providers which we dont need
import { isAddress } from 'viem/utils';
import { z } from 'zod';

const ResponseSchema = z.object({
  status_code: z.number(),
  t: z.number(),
});

/**
 * Response object for all endpoints
 * @property status_code - HTTP status code
 * @property t - Request unix timestamp (seconds)
 */
export type NetworkAPIResponse = z.infer<typeof ResponseSchema>;

/**
 * Token price info object
 * @property usd - Current token price (USD)
 * @property usd_market_cap - Current market cap value in (USD)
 * @property t_price - The timestamp the price data is accurate at (seconds)
 * @property t_stale - Stale unix timestamp for the price data (seconds)
 */
const PriceSchema = z.object({
  usd: z.number(),
  usd_market_cap: z.number(),
  t_price: z.number(),
  t_stale: z.number(),
});

/**
 * Token-specific info
 * @property staking_requirement - The number of tokens required to stake a node. This is the effective "token amount" per node (SESH)
 * @property staking_reward_pool - The number of tokens in the staking reward pool (SESH)
 * @property contract_address - Token contract address. (42 char Hexadecimal - Including 0x prefix)
 */
const TokenSchema = z.object({
  staking_requirement: z.number(),
  staking_reward_pool: z.number(),
  contract_address: z.string().refine(val => isAddress(val)),
});

/** Network info object
 * @property network_size - number of nodes in the Session Network (integer)
 */
const NetworkSchema = z.object({
  network_size: z.number(),
  network_staked_tokens: z.number(),
  network_staked_usd: z.number(),
});

const InfoSchema = ResponseSchema.extend({
  price: PriceSchema,
  token: TokenSchema,
  network: NetworkSchema,
});

/**
 * General token info. This endpoint combines the /price and /token endpoint information.
 * @note All Session Token values are already in units of SESH, not atomic values, and have a precision of 9 decimal places. These SESH values are calculated using: atomic/(10^9).
 * @note All timestamps are in seconds and are unix epoch timestamps.
 * @note All fiat currency values are in USD and have a precision of 9 decimal places.
 */
export type InfoResponse = z.infer<typeof InfoSchema>;

// #endregion /info

// #region /validate/headers

const ValidateHeaderSchema = ResponseSchema.extend({
  success: z.boolean(),
  blinded_id: z.string(),
});

/**
 * Validate the header of a request
 * @property success - Success of the header validation
 * @property blinded_id - VBID that was used in the request headers
 */
export type ValidateHeaderResponse = z.infer<typeof ValidateHeaderSchema>;
// #endregion /validate/headers
