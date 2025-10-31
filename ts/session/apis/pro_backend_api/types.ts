import { z } from 'zod';
import { SessionBackendBaseResponseSchema } from '../session_backend_server';

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

const ProStatusItemSchema = z.object({});

const ProStatusResultSchema = z.object({
  auto_renewing: z.boolean(),
  expiring_unix_ts_ms: z.number(),
  grace_period_duration_ms: z.number(),
  status: z.number(),
  version: z.number(),
  items: z.array(ProStatusItemSchema),
});

export type ProStatusResultType = z.infer<typeof ProStatusResultSchema>;

export const GetProStatusResponseSchema = SessionBackendBaseResponseSchema.extend({
  result: ProStatusResultSchema,
});

export type GetProStatusResponseType = z.infer<typeof GetProStatusResponseSchema>;
