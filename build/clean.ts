import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import BUILD_CONFIG from './buildConfig';

const { APP_DIR, DIST_DIR, CACHE_FILE, filesToCopy, directoriesToCopy } = BUILD_CONFIG;

function isCopiedPath(relativePath: string): boolean {
  if (filesToCopy.includes(relativePath) || relativePath === 'package.json') {
    return true;
  }

  const firstDir = relativePath.split(path.sep)[0];
  return directoriesToCopy.includes(firstDir);
}

async function removeBuiltFiles(dir: string, baseDir: string = dir): Promise<void> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);

      if (isCopiedPath(relativePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        await removeBuiltFiles(fullPath, baseDir);

        try {
          const remaining = await fs.readdir(fullPath);
          if (remaining.length === 0) {
            await fs.rmdir(fullPath);
            console.log(`  Removed empty dir: ${relativePath}`);
          }
        } catch {
          // Directory might have been removed or is not empty
        }
      } else {
        await fs.unlink(fullPath);
        console.log(`  Removed: ${relativePath}`);
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

async function clean(): Promise<void> {
  const cleanDist = process.argv.includes('--dist');
  const cleanCache = process.argv.includes('--cache');

  console.log('🧹 Cleaning build artifacts...\n');

  if (fsSync.existsSync(APP_DIR)) {
    console.log('Cleaning app/ (preserving copied files)...');
    await removeBuiltFiles(APP_DIR);
  }

  if (cleanDist && fsSync.existsSync(DIST_DIR)) {
    console.log('\nCleaning dist/...');
    await fs.rm(DIST_DIR, { recursive: true, force: true });
    console.log('  Removed dist/');
  }

  if (cleanCache && fsSync.existsSync(CACHE_FILE)) {
    console.log('\nCleaning cache...');
    await fs.unlink(CACHE_FILE);
    console.log('  Removed cache');
  }

  console.log('\n✨ Clean complete!');
}

clean().catch((error: Error) => {
  console.error('Error:', error);
  process.exit(1);
});
