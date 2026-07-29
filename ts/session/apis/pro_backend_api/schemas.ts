import type {
  GenerateProProofResponse,
  GetProStatusResponse,
  GetProRevocationsResponse,
  ProPaymentItem,
  ProProof,
} from 'libsession_util_nodejs';
import { z } from '../../../util/zod';

// Wire parsing now lives in libsession (the nodejs glue `parse*Response` functions) — the single
// source of truth for the wire shape. The hand-rolled zod request/response schemas that used to live
// here were deleted; we re-export the glue-parsed response *types* from this module so the rest of the
// app keeps a stable import site.
export type ProProofResultType = ProProof;
export type GenerateProProofResponseType = GenerateProProofResponse;
export type GetProRevocationsResponseType = GetProRevocationsResponse;
export type ProStatusResultType = GetProStatusResponse;
export type ProPaymentItemType = ProPaymentItem;

// Revocation items are cached to local storage; keep a small DB schema to validate cached blobs on
// read (shape matches the glue's ProRevocationItem). An old/unknown shape fails safeParse and the
// caller resets the (re-fetchable) cache — see pro_revocation_list.ts.
export const ProRevocationItemDBSchema = z.object({
  revocationTagB64: z.string(),
  effectiveMs: z.number(),
});
export const ProRevocationItemsDBSchema = z.array(ProRevocationItemDBSchema);
export type ProRevocationItemDBType = z.infer<typeof ProRevocationItemDBSchema>;
export type ProRevocationItemsDBType = z.infer<typeof ProRevocationItemsDBSchema>;
