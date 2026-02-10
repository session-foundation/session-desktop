import { v4 } from 'uuid';

/**
 * Simple wrapper around uuid v4 to easily import with a better name than `v4`
 */
export function uuidV4() {
  return v4();
}
