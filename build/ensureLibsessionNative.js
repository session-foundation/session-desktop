'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const logPrefix = '[ensure-libsession]';
const projectRoot = path.resolve(__dirname, '..');
const moduleDir = path.join(projectRoot, 'node_modules', 'libsession_util_nodejs');
const binaryPath = path.join(moduleDir, 'build', 'Release', 'libsession_util_nodejs.node');

function log(message) {
  console.log(`${logPrefix} ${message}`);
}

function fail(message, code = 1) {
  console.error(`${logPrefix} ${message}`);
  process.exit(code);
}

if (!fs.existsSync(moduleDir)) {
  fail('libsession_util_nodejs is not installed. Run `yarn install` first.');
}

if (fs.existsSync(binaryPath)) {
  log('Native binary already present, skipping rebuild.');
  process.exit(0);
}

log('Native binary missing, running libsession_util_nodejs install script.');

const yarnCommand = process.platform === 'win32' ? 'yarn.cmd' : 'yarn';
const result = spawnSync(yarnCommand, ['run', 'install'], {
  cwd: moduleDir,
  stdio: 'inherit',
});

if (result.error) {
  fail(`Failed to start yarn: ${result.error.message}`);
}

if (result.status !== 0) {
  fail('libsession_util_nodejs build failed; ensure native build prerequisites are installed.');
}

if (!fs.existsSync(binaryPath)) {
  fail('Build completed but native binary is still missing.');
}

log(`Native binary ready at ${binaryPath}`);
