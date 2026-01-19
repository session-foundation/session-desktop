import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import BUILD_CONFIG from './buildConfig';

const { APP_DIR } = BUILD_CONFIG;
const PROJECT_ROOT = path.join(__dirname, '..');

// This is required to make the unit test run, as for some reason fs.copyFile corrupts the bins
async function copyBinDirectory() {
  const sourceBinPath = path.join(PROJECT_ROOT, 'node_modules', '.bin');
  const destNodeModulesPath = path.join(APP_DIR, 'node_modules');
  const destBinPath = path.join(destNodeModulesPath, '.bin');

  if (!fs.existsSync(sourceBinPath)) {
    console.log('No node_modules/.bin/ directory found, skipping...');
    return;
  }

  console.log('Copying node_modules/.bin/ directory...');

  try {
    if (!fs.existsSync(destNodeModulesPath)) {
      fs.mkdirSync(destNodeModulesPath, { recursive: true });
    }

    if (fs.existsSync(destBinPath)) {
      console.log('Removing existing .bin directory...');
      execSync(`rm -rf "${destBinPath}"`, { stdio: 'inherit' });
    }

    execSync(`cp -a "${sourceBinPath}" "${destBinPath}"`, { stdio: 'inherit' });

    console.log('✓ Successfully copied node_modules/.bin/');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error copying .bin directory:', errorMessage);
    process.exit(1);
  }
}

copyBinDirectory().catch((error: Error) => {
  console.error('Error:', error);
  process.exit(1);
});
