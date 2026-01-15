const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const BUILD_CONFIG = require('./buildConfig');

const { APP_DIR, DIST_DIR, CACHE_FILE, filesToCopy, directoriesToCopy } = BUILD_CONFIG;

function isCopiedPath(relativePath) {
  if (filesToCopy.includes(relativePath) || relativePath === 'package.json') {
    return true;
  }

  const firstDir = relativePath.split(path.sep)[0];
  return directoriesToCopy.includes(firstDir);
}

async function removeBuiltFiles(dir, baseDir = dir) {
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
        } catch {}
      } else {
        await fs.unlink(fullPath);
        console.log(`  Removed: ${relativePath}`);
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function clean() {
  const cleanDist = process.argv.includes('--dist');
  const cleanCache = process.argv.includes('--cache');

  console.log('🧹 Cleaning build artifacts...\n');

  // Clean app directory (built files only)
  if (fsSync.existsSync(APP_DIR)) {
    console.log('Cleaning app/ (preserving copied files)...');
    await removeBuiltFiles(APP_DIR);
  }

  // Clean dist directory if requested
  if (cleanDist && fsSync.existsSync(DIST_DIR)) {
    console.log('\nCleaning dist/...');
    await fs.rm(DIST_DIR, { recursive: true, force: true });
    console.log('  Removed dist/');
  }

  // Clean cache if requested
  if (cleanCache && fsSync.existsSync(CACHE_FILE)) {
    console.log('\nCleaning cache...');
    await fs.unlink(CACHE_FILE);
    console.log('  Removed cache');
  }

  console.log('\n✨ Clean complete!');
}

clean().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
