import { z } from '../../../util/zod';

/**
 * The service node item from the seed node and from a snode do not match exactly.
 * Here is the one as returned by the seed node.
 */
const ServiceNodeFromSeedSchema = z.object({
  public_ip: z.string(),
  storage_port: z.number(),
  pubkey_ed25519: z.string(),
  pubkey_x25519: z.string(),
  requested_unlock_height: z.number(),
});

export const ServiceNodesFromSeedSchema = z
  .array(ServiceNodeFromSeedSchema)
  .transform(nodes => nodes.filter(node => node.public_ip && node.public_ip !== '0.0.0.0'));

export const ServiceNodesWithHeightSchema = z.object({
  service_node_states: ServiceNodesFromSeedSchema,
  height: z.number(),
});

export const ServiceNodesResponseSchema = z.object({
  result: ServiceNodesWithHeightSchema,
});

export type SnodesFromSeed = z.infer<typeof ServiceNodesFromSeedSchema>;
export type ServiceNodesWithHeight = z.infer<typeof ServiceNodesResponseSchema>;
export type ServiceNodesResponse = z.infer<typeof ServiceNodesResponseSchema>;
