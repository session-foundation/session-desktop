import https from 'https';
import fetch from 'node-fetch';

/* eslint-disable no-console */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
// eslint-disable-next-line @typescript-eslint/no-restricted-imports -- this is a tools script so we want to import zod directly
import { z } from '../../ts/util/zod';
import { ServiceNodesResponseSchema } from '../../ts/session/apis/seed_node_api/types';

import { promises as fs } from 'fs';
import path from 'path';

const CACHE_FILE = path.join('assets', 'service-nodes-cache.json');
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

async function fetchServiceNodes() {
  const abortDetails = SEED_URLS.map(seedUrl => {
    const controller = new AbortController();

    return {
      seedUrl,
      controller,
      timeout: setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS),
    };
  });

  const response = await Promise.any(
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
              requested_unlock_height: true,
              height: true,
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
      return validated.result;
    })
  );

  abortDetails.forEach(details => {
    clearTimeout(details.timeout);
    details.controller.abort();
  });

  if (!response.service_node_states.length) {
    throw new Error('No valid nodes found');
  }
  return response;
}

async function main() {
  try {
    console.log('Fetching fresh service node data...');
    const parsed = await fetchServiceNodes();

    // remove the file so we are sure the date of creation will be correct (needed for session-desktop to know how old the snode pool is)
    await fs.rm(CACHE_FILE, { force: true });
    // Save to cache
    await fs.writeFile(CACHE_FILE, JSON.stringify(parsed, null, 2));
    console.log(`Cached ${parsed.service_node_states.length} nodes to ${CACHE_FILE}`);

    // Validate node count
    if (parsed.service_node_states.length < MIN_NODE_COUNT) {
      console.error(
        `❌ Only ${parsed.service_node_states.length} nodes found (minimum: ${MIN_NODE_COUNT})`
      );
      process.exit(1);
    }

    console.log(
      `✅ Found ${parsed.service_node_states.length} service nodes (minimum: ${MIN_NODE_COUNT})`
    );
    console.log('\nSample node:');
    console.log(JSON.stringify(parsed.service_node_states[0], null, 2));
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
