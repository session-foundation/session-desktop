import fsSync from 'fs';
import path from 'path';
import BUILD_CONFIG from './buildConfig';
import { copyDirectory } from './copyUtils';

const { APP_DIR, DIST_DIR } = BUILD_CONFIG;

let totalCopied = 0;
let totalSkipped = 0;

async function copyTests(): Promise<void> {
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

  console.log(`\nComplete! Copied: ${totalCopied}, Skipped: ${totalSkipped}`);
}

copyTests().catch((error: Error) => {
  console.error('Error:', error);
  process.exit(1);
});
