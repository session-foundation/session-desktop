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
    'test-internal'?: string;
  };
};

async function copySource(): Promise<void> {
  console.log('📦 Copying source files...\n');

  await copyWithCache(filesToCopy, directoriesToCopy, APP_DIR, PROJECT_ROOT);

  // Handle package.json separately with modifications
  console.log('\nProcessing package.json...');
  const packageJsonPath = path.join(PROJECT_ROOT, 'package.json');
  const destPackageJsonPath = path.join(APP_DIR, 'package.json');

  if (await shouldCopy(packageJsonPath, destPackageJsonPath)) {
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson: PackageJson = JSON.parse(packageJsonContent);

    // NOTE: electron-builder requires the build item to be removed in the app dir
    delete packageJson.build;
    // NOTE: we swap the test scripts so we can run "yarn test" from the root dir
    if (packageJson.scripts['test-internal']) {
      packageJson.scripts.test = packageJson.scripts['test-internal'];
      delete packageJson.scripts['test-internal'];
    }

    await fs.writeFile(destPackageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log('  ✓ Modified and copied package.json');
  }

  console.log('\n✨ Source copy complete!');
}

copySource().catch((error: Error) => {
  console.error('Error:', error);
  process.exit(1);
});
