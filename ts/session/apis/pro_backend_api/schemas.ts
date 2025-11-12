import { z } from 'zod';
import { SessionBackendBaseResponseSchema } from '../session_backend_server';
import { ProItemStatus, ProAccessVariant, ProPaymentProvider, ProStatus } from './types';

const ProProofResultSchema = z.object({
  version: z.number(),
  expiry_unix_ts_ms: z.number(),
  gen_index_hash: z.string(),
  rotating_pkey: z.string(),
  sig: z.string(),
});

export type ProProofResultType = z.infer<typeof ProProofResultSchema>;

export const GetProProofResponseSchema = SessionBackendBaseResponseSchema.extend({
  result: ProProofResultSchema,
});

export type GetProProofResponseType = z.infer<typeof GetProProofResponseSchema>;

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

const ProStatusItemSchema = z.object({
  status: z.nativeEnum(ProItemStatus),
  plan: z.nativeEnum(ProAccessVariant),
  payment_provider: z.nativeEnum(ProPaymentProvider),
  auto_renewing: z.boolean(),
  unredeemed_unix_ts_ms: z.number(),
  redeemed_unix_ts_ms: z.number(),
  expiry_unix_ts_ms: z.number(),
  grace_period_duration_ms: z.number(),
  platform_refund_expiry_unix_ts_ms: z.number(),
  revoked_unix_ts_ms: z.number(),
  google_payment_token: z.string().nullable(),
  google_order_id: z.string().nullable(),
  apple_original_tx_id: z.string().nullable(),
  apple_tx_id: z.string().nullable(),
  apple_web_line_order_id: z.string().nullable(),
});

const ProStatusResultSchema = z.object({
  status: z.nativeEnum(ProStatus),
  auto_renewing: z.boolean(),
  expiry_unix_ts_ms: z.number(),
  grace_period_duration_ms: z.number(),
  error_report: z.number(),
  payments_total: z.number(),
  items: z.array(ProStatusItemSchema),
});

export type ProStatusResultType = z.infer<typeof ProStatusResultSchema>;

export const GetProStatusResponseSchema = SessionBackendBaseResponseSchema.extend({
  result: ProStatusResultSchema,
});

export type GetProStatusResponseType = z.infer<typeof GetProStatusResponseSchema>;
