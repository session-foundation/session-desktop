import { spawnSync } from 'child_process';
import fsSync from 'fs';
import path from 'path';
import BUILD_CONFIG from './buildConfig';

const { APP_DIR } = BUILD_CONFIG;

// NOTE: with app/package.json present, install-app-deps runs `pnpm install` in app/, which pnpm resolves
// to the root workspace, rerunning this postinstall without end. Release builds handle app/ themselves.
if (fsSync.existsSync(path.join(APP_DIR, 'package.json'))) {
  console.log(
    'Skipping electron-builder install-app-deps: app/package.json exists (run `pnpm clean` first)'
  );
  process.exit(0);
}

const result = spawnSync('pnpm', ['electron-builder', 'install-app-deps'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);
