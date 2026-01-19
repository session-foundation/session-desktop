import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import BUILD_CONFIG from './buildConfig';

const { CACHE_FILE } = BUILD_CONFIG;
const PROJECT_ROOT = path.join(__dirname, '..');

type CacheEntry = {
  size: number;
  mtimeMs: number;
  hash?: string;
};

type FileCache = Record<string, CacheEntry>;

export type CopyStats = {
  copied: number;
  skipped: number;
  metadataHits: number;
  hashHits: number;
  hashComputations: number;
};

let cache: FileCache = {};

async function loadCache() {
  try {
    const data = await fs.readFile(CACHE_FILE, 'utf-8');
    cache = JSON.parse(data);
  } catch {
    cache = {};
  }
}

async function saveCache() {
  const dir = path.dirname(CACHE_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
}

async function getFileHash(filepath: string): Promise<string | null> {
  try {
    const content = await fs.readFile(filepath);
    return crypto.createHash('md5').update(content).digest('hex');
  } catch {
    return null;
  }
}

export async function shouldCopy(
  sourcePath: string,
  destPath: string,
  stats?: CopyStats
): Promise<boolean> {
  const cacheKey = path.relative(PROJECT_ROOT, sourcePath);

  let fileStats;
  try {
    fileStats = await fs.stat(sourcePath);
  } catch {
    return false; // Source doesn't exist
  }

  const cached = cache[cacheKey];

  // Fast path: Check metadata first (size + modification time)
  if (cached && cached.size === fileStats.size && cached.mtimeMs === fileStats.mtimeMs) {
    // Metadata unchanged - file very likely unchanged
    try {
      await fs.access(destPath);
      if (stats) stats.metadataHits++;
      return false; // File unchanged, destination exists
    } catch {
      return true; // File unchanged, but destination missing - need to copy
    }
  }

  // Slow path: Metadata changed, verify with content hash
  if (stats) stats.hashComputations++;
  const hash = await getFileHash(sourcePath);
  if (!hash) return false;

  // Check if content actually changed
  if (cached?.hash === hash) {
    // Content unchanged despite metadata change (e.g., git operations, touch)
    // Update cache with new metadata
    cache[cacheKey] = {
      size: fileStats.size,
      mtimeMs: fileStats.mtimeMs,
      hash,
    };

    try {
      await fs.access(destPath);
      if (stats) stats.hashHits++;
      return false; // Same content, destination exists
    } catch {
      return true; // Same content, but destination missing - need to copy
    }
  }

  // Content changed - update cache and copy
  cache[cacheKey] = {
    size: fileStats.size,
    mtimeMs: fileStats.mtimeMs,
    hash,
  };
  return true;
}

export async function copyDirectory(
  src: string,
  dest: string,
  stats: CopyStats = { copied: 0, skipped: 0, metadataHits: 0, hashHits: 0, hashComputations: 0 }
): Promise<CopyStats> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath, stats);
    } else {
      if (await shouldCopy(srcPath, destPath, stats)) {
        await fs.copyFile(srcPath, destPath);
        stats.copied++;
      } else {
        stats.skipped++;
      }
    }
  }

  return stats;
}

export async function copyWithCache(
  files: string[],
  directories: string[],
  destDir: string,
  sourceRoot: string = PROJECT_ROOT
) {
  await loadCache();
  const stats: CopyStats = {
    copied: 0,
    skipped: 0,
    metadataHits: 0,
    hashHits: 0,
    hashComputations: 0,
  };

  console.log('Copying files and directories...\n');

  for (const file of files) {
    const srcPath = path.join(sourceRoot, file);
    const destPath = path.join(destDir, file);

    if (!fsSync.existsSync(srcPath)) {
      console.warn(`  Warning: ${srcPath} not found, skipping...`);
      continue;
    }

    const destDirPath = path.dirname(destPath);
    await fs.mkdir(destDirPath, { recursive: true });

    if (await shouldCopy(srcPath, destPath, stats)) {
      await fs.copyFile(srcPath, destPath);
      stats.copied++;
      console.log(`  ✓ ${file}`);
    } else {
      stats.skipped++;
    }
  }

  for (const dir of directories) {
    const srcPath = path.join(sourceRoot, dir);
    const destPath = path.join(destDir, dir);

    if (!fsSync.existsSync(srcPath)) {
      console.warn(`  Warning: ${srcPath} not found, skipping...`);
      continue;
    }

    console.log(`  ${dir}/...`);
    const dirStats = await copyDirectory(srcPath, destPath, stats);
    stats.copied += dirStats.copied;
    stats.skipped += dirStats.skipped;
  }

  await saveCache();

  console.log(`\nCopy complete! Copied: ${stats.copied}, Skipped: ${stats.skipped}`);
  const totalChecks = stats.copied + stats.skipped;
  if (totalChecks > 0) {
    const metadataPercent = ((stats.metadataHits / totalChecks) * 100).toFixed(1);
    console.log(`  - Metadata hit rate: ${metadataPercent}%`);
  }
}

export { loadCache, saveCache };
