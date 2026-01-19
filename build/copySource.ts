import fs from 'fs/promises';
import path from 'path';
import BUILD_CONFIG from './buildConfig';
import { shouldCopy, copyWithCache } from './copyUtils';

const { APP_DIR, filesToCopy, directoriesToCopy } = BUILD_CONFIG;
const PROJECT_ROOT = path.join(__dirname, '..');

interface PackageJson {
  build?: unknown;
  scripts: {
    test?: string;
    'test-internal'?: string;
    [key: string]: string | undefined;
  };
  [key: string]: unknown;
}

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

    delete packageJson.build;
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
