/* eslint-disable no-console */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
// eslint-disable-next-line @typescript-eslint/no-restricted-imports -- this is a tools script so we want to import zod directly
import { z } from 'zod';
import { promises as fs, existsSync, statSync } from 'fs';

import https from 'https';
import fetch from 'node-fetch';

const CACHE_FILE = 'assets/service-nodes-cache.json';
const CACHE_MAX_AGE_MS = 60 * 60 * 1000;
const MIN_NODE_COUNT = 20;
const SEED_URLS = [
  'https://seed1.getsession.org/json_rpc',
  'https://seed2.getsession.org/json_rpc',
  'https://seed3.getsession.org/json_rpc',
];
const REQUEST_TIMEOUT_MS = 30000;
const agent = new https.Agent({
  rejectUnauthorized: false,
});

const ServiceNodeSchema = z.object({
  public_ip: z.string(),
  storage_port: z.number(),
  pubkey_ed25519: z.string(),
  pubkey_x25519: z.string(),
});

const ServiceNodesResponseSchema = z.object({
  result: z.object({
    service_node_states: z.array(ServiceNodeSchema),
  }),
});

type ServiceNode = z.infer<typeof ServiceNodeSchema>;

function isCacheRecent(): boolean {
  if (!existsSync(CACHE_FILE)) {
    return false;
  }

  const stats = statSync(CACHE_FILE);
  const ageMs = Date.now() - stats.mtimeMs;

  return ageMs < CACHE_MAX_AGE_MS;
}

async function fetchServiceNodes(): Promise<Array<ServiceNode>> {
  const abortDetails = SEED_URLS.map(seedUrl => {
    const controller = new AbortController();

    return {
      seedUrl,
      controller,
      timeout: setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS),
    };
  });

  const validatedSnodes = await Promise.any(
    SEED_URLS.map(async (seedUrl, index) => {
      console.log(`Trying ${seedUrl}...`);

      const response = await fetch(seedUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method: 'get_service_nodes',
          params: {
            active_only: true,
            fields: {
              public_ip: true,
              storage_port: true,
              pubkey_ed25519: true,
              pubkey_x25519: true,
            },
          },
        }),
        agent,
        signal: abortDetails[index].controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Validate with Zod
      const validated = ServiceNodesResponseSchema.parse(data);

      console.log(`Successfully fetched from ${seedUrl}`);
      return validated.result.service_node_states;
    })
  );

  abortDetails.forEach(details => {
    clearTimeout(details.timeout);
    details.controller.abort();
  });

  if (!validatedSnodes.length) {
    throw new Error('No valid nodes found');
  }
  return validatedSnodes;
}

async function loadCachedNodes(): Promise<Array<ServiceNode>> {
  const cached = await fs.readFile(CACHE_FILE, 'utf-8');
  const data = JSON.parse(cached);

  // Validate cached data
  const validated = z.array(ServiceNodeSchema).parse(data);
  return validated;
}

async function main() {
  try {
    let nodes: Array<ServiceNode>;

    if (isCacheRecent()) {
      console.log(`Using cached data from ${CACHE_FILE}`);
      nodes = await loadCachedNodes();
    } else {
      console.log('Fetching fresh service node data...');
      nodes = await fetchServiceNodes();

      // Save to cache
      await fs.writeFile(CACHE_FILE, JSON.stringify(nodes, null, 2));
      console.log(`Cached ${nodes.length} nodes to ${CACHE_FILE}`);
    }

    // Validate node count
    if (nodes.length < MIN_NODE_COUNT) {
      console.error(`❌ Only ${nodes.length} nodes found (minimum: ${MIN_NODE_COUNT})`);
      process.exit(1);
    }

    console.log(`✅ Found ${nodes.length} service nodes (minimum: ${MIN_NODE_COUNT})`);
    console.log('\nSample node:');
    console.log(JSON.stringify(nodes[0], null, 2));
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Validation error:', error);
    } else {
      console.error('❌ Error:', error instanceof Error ? error.message : error);
    }
    process.exit(1);
  }
}

void main();
