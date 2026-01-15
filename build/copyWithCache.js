const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const BUILD_CONFIG = require('./buildConfig');

const { APP_DIR, DIST_DIR, CACHE_FILE, filesToCopy, directoriesToCopy } = BUILD_CONFIG;
const PROJECT_ROOT = path.join(__dirname, '..');

let cache = {};

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

async function getFileHash(filepath) {
  try {
    const content = await fs.readFile(filepath);
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch {
    return null;
  }
}

async function shouldCopy(sourcePath, destPath) {
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

async function copyDirectory(src, dest, stats = { copied: 0, skipped: 0 }) {
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

async function copyWithCache() {
  const force = process.argv.includes('--force');

  if (force) {
    console.log('Force mode: clearing cache');
    cache = {};
  } else {
    await loadCache();
  }

  await fs.mkdir(APP_DIR, { recursive: true });

  let totalCopied = 0;
  let totalSkipped = 0;

  console.log('Copying files...');
  for (const file of filesToCopy) {
    const sourcePath = path.join(PROJECT_ROOT, file);
    const destPath = path.join(APP_DIR, file);

    try {
      if (await shouldCopy(sourcePath, destPath)) {
        const destDir = path.dirname(destPath);
        await fs.mkdir(destDir, { recursive: true });
        await fs.copyFile(sourcePath, destPath);
        totalCopied++;
        console.log(`  Copied: ${file}`);
      } else {
        totalSkipped++;
      }
    } catch (error) {
      console.warn(`  Warning: ${file} not found, skipping...`);
    }
  }

  console.log('Copying directories...');
  for (const dir of directoriesToCopy) {
    const sourcePath = path.join(PROJECT_ROOT, dir);
    const destPath = path.join(APP_DIR, dir);

    if (fsSync.existsSync(sourcePath)) {
      console.log(`  ${dir}/...`);
      const stats = await copyDirectory(sourcePath, destPath);
      totalCopied += stats.copied;
      totalSkipped += stats.skipped;
    } else {
      console.warn(`  Warning: ${dir} not found, skipping...`);
    }
  }

  const testsDir = 'ts/test';
  const testsBuildPath = path.join(DIST_DIR, testsDir);
  const testsAppPath = path.join(APP_DIR, testsDir);
  if (fsSync.existsSync(testsBuildPath)) {
    console.log(`  ${testsBuildPath}/...`);
    const stats = await copyDirectory(testsBuildPath, testsAppPath);
    totalCopied += stats.copied;
    totalSkipped += stats.skipped;
  } else {
    console.warn(`  Warning: ${testsBuildPath} not found, skipping...`);
  }

  const packageJsonPath = path.join(PROJECT_ROOT, 'package.json');
  const destPackageJsonPath = path.join(APP_DIR, 'package.json');

  if (await shouldCopy(packageJsonPath, destPackageJsonPath)) {
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    delete packageJson.build;
    packageJson.scripts.test = packageJson.scripts['test-internal'];
    delete packageJson.scripts['test-internal'];
    await fs.writeFile(destPackageJsonPath, JSON.stringify(packageJson, null, 2));
    totalCopied++;
    console.log('  Copied package.json');
  } else {
    totalSkipped++;
  }

  await saveCache();

  console.log(`\nComplete! Copied: ${totalCopied}, Skipped: ${totalSkipped}`);
}

copyWithCache().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
