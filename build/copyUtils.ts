import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import BUILD_CONFIG from './buildConfig';

const { APP_DIR, CACHE_FILE } = BUILD_CONFIG;
const PROJECT_ROOT = path.join(__dirname, '..');

interface FileCache {
  [key: string]: string;
}

export interface CopyStats {
  copied: number;
  skipped: number;
}

let cache: FileCache = {};

async function loadCache(): Promise<void> {
  try {
    const data = await fs.readFile(CACHE_FILE, 'utf-8');
    cache = JSON.parse(data);
  } catch {
    cache = {};
  }
}

async function saveCache(): Promise<void> {
  const dir = path.dirname(CACHE_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
}

async function getFileHash(filepath: string): Promise<string | null> {
  try {
    const content = await fs.readFile(filepath);
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch {
    return null;
  }
}

export async function shouldCopy(sourcePath: string, destPath: string): Promise<boolean> {
  const cacheKey = path.relative(PROJECT_ROOT, sourcePath);
  const currentHash = await getFileHash(sourcePath);

  if (!currentHash) return false;
  if (cache[cacheKey] !== currentHash) {
    cache[cacheKey] = currentHash;
    return true;
  }

  try {
    await fs.access(destPath);
    return false;
  } catch {
    return true;
  }
}

export async function copyDirectory(
  src: string,
  dest: string,
  stats: CopyStats = { copied: 0, skipped: 0 }
): Promise<CopyStats> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath, stats);
    } else {
      if (await shouldCopy(srcPath, destPath)) {
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
): Promise<CopyStats> {
  await loadCache();
  const stats: CopyStats = { copied: 0, skipped: 0 };

  console.log('Copying files and directories...\n');

  // Copy individual files
  for (const file of files) {
    const srcPath = path.join(sourceRoot, file);
    const destPath = path.join(destDir, file);

    if (!fsSync.existsSync(srcPath)) {
      console.warn(`  Warning: ${srcPath} not found, skipping...`);
      continue;
    }

    // Ensure destination directory exists
    const destDirPath = path.dirname(destPath);
    await fs.mkdir(destDirPath, { recursive: true });

    if (await shouldCopy(srcPath, destPath)) {
      await fs.copyFile(srcPath, destPath);
      stats.copied++;
      console.log(`  ✓ ${file}`);
    } else {
      stats.skipped++;
    }
  }

  // Copy directories
  for (const dir of directories) {
    const srcPath = path.join(sourceRoot, dir);
    const destPath = path.join(destDir, dir);

    if (!fsSync.existsSync(srcPath)) {
      console.warn(`  Warning: ${srcPath} not found, skipping...`);
      continue;
    }

    console.log(`  ${dir}/...`);
    const dirStats = await copyDirectory(srcPath, destPath);
    stats.copied += dirStats.copied;
    stats.skipped += dirStats.skipped;
  }

  await saveCache();
  console.log(`\nCopy complete! Copied: ${stats.copied}, Skipped: ${stats.skipped}`);

  return stats;
}

export { loadCache, saveCache };
