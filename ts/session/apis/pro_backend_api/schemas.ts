import { z } from 'zod';
import { ProItemStatus, ProAccessVariant, ProPaymentProvider, ProStatus } from './types';
import { SessionBackendBaseResponseSchema } from '../session_backend_server';

export const ProProofResultSchema = z.object({
  version: z.number(),
  expiry_unix_ts_ms: z.number(),
  gen_index_hash: z.string(),
  rotating_pkey: z.string(),
  sig: z.string(),
});

export type ProProofResultType = z.infer<typeof ProProofResultSchema>;

export const GenerateProProofResponseSchema = SessionBackendBaseResponseSchema.extend({
  result: ProProofResultSchema,
});

export type GenerateProProofResponseType = z.infer<typeof GenerateProProofResponseSchema>;

const ProRevocationItemSchema = z.object({
  expiry_unix_ts_ms: z.number(),
  gen_index_hash: z.string(),
});

const ProRevocationsResultSchema = z.object({
  ticket: z.number(),
  items: z.array(ProRevocationItemSchema),
});

export type ProRevocationsResultType = z.infer<typeof ProRevocationsResultSchema>;

export const GetProRevocationsResponseSchema = SessionBackendBaseResponseSchema.extend({
  result: ProRevocationsResultSchema,
});

export type GetProRevocationsResponseType = z.infer<typeof GetProRevocationsResponseSchema>;

const ProDetailsItemSchema = z.object({
  status: z.enum(ProItemStatus),
  plan: z.enum(ProAccessVariant),
  payment_provider: z.enum(ProPaymentProvider),
  auto_renewing: z.boolean(),
  unredeemed_unix_ts_ms: z.number(),
  refund_requested_unix_ts_ms: z.number(),
  redeemed_unix_ts_ms: z.number(),
  expiry_unix_ts_ms: z.number(),
  grace_period_duration_ms: z.number(),
  platform_refund_expiry_unix_ts_ms: z.number(),
  revoked_unix_ts_ms: z.number(),
  google_payment_token: z.string().optional(),
  google_order_id: z.string().optional(),
  apple_original_tx_id: z.string().optional(),
  apple_tx_id: z.string().optional(),
  apple_web_line_order_id: z.string().optional(),
});

export const ProDetailsResultSchema = z.object({
  status: z.enum(ProStatus),
  auto_renewing: z.boolean(),
  expiry_unix_ts_ms: z.number(),
  grace_period_duration_ms: z.number(),
  error_report: z.number(),
  refund_requested_unix_ts_ms: z.number(),
  payments_total: z.number(),
  items: z.array(ProDetailsItemSchema),
});

export type ProDetailsResultType = z.infer<typeof ProDetailsResultSchema>;

export const GetProDetailsResponseSchema = SessionBackendBaseResponseSchema.extend({
  result: ProDetailsResultSchema,
});

export type GetProDetailsResponseType = z.infer<typeof GetProDetailsResponseSchema>;
