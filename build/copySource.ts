import fs from 'fs/promises';
import path from 'path';
import BUILD_CONFIG from './buildConfig';
import { shouldCopy, copyWithCache } from './copyUtils';

const { APP_DIR, filesToCopy, directoriesToCopy } = BUILD_CONFIG;
const PROJECT_ROOT = path.join(__dirname, '..');

type PackageJson = Record<string, unknown> & {
  build?: unknown;
  scripts: Record<string, string> & {
    test?: string;
    'test-hoisted'?: string;
  };
};

type MocharcJson = Record<string, unknown> & {
  spec: Array<string>;
};

async function copySource(): Promise<void> {
  console.log('📦 Copying source files...\n');

  await copyWithCache(filesToCopy, directoriesToCopy, APP_DIR, PROJECT_ROOT);

  // Handle package.json separately with modifications
  console.log('\nProcessing package.json...');
  const packageJsonPath = path.join(PROJECT_ROOT, 'package.json');
  const destPackageJsonPath = path.join(APP_DIR, 'package.json');

  const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
  const packageJson: PackageJson = JSON.parse(packageJsonContent);

  // NOTE: electron-builder requires the build item to be removed in the app dir
  delete packageJson.build;
  // NOTE: pnpm requres the app dir not have a resolutions item
  delete packageJson.resolutions;

  await fs.writeFile(destPackageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('  ✓ Modified and copied package.json');

  // Handle .mocharc.json separately with modifications
  console.log('\nProcessing .mocharc.json...');
  const mocharcJsonPath = path.join(PROJECT_ROOT, '.mocharc.json');
  const destMocharcJsonPath = path.join(APP_DIR, '.mocharc.json');

  const mocharcJsonContent = await fs.readFile(mocharcJsonPath, 'utf-8');
  const mocharcJson: MocharcJson = JSON.parse(mocharcJsonContent);

  // NOTE: to run tests from the app directory it needs valid spec paths from itself
  mocharcJson.spec = mocharcJson.spec.map(specPath => {
    if (specPath.startsWith('app/')) {
      return specPath.slice(4);
    }
    return specPath;
  });

  await fs.writeFile(destMocharcJsonPath, JSON.stringify(mocharcJson, null, 2));
  console.log('  ✓ Modified and copied .mocharc.json');

  console.log('\n✨ Source copy complete!');
}

copySource().catch((error: Error) => {
  console.error('Error:', error);
  process.exit(1);
});
