if (process.platform === 'linux') {
  const { execSync } = require('child_process');
  const sharpPath = require('path').join(__dirname, '../node_modules/sharp');

  try {
    process.chdir(sharpPath);
    execSync('yarn install --build-from-source --force', {
      stdio: 'inherit',
      env: {
        ...process.env,
        SHARP_FORCE_GLOBAL_LIBVIPS: '1',
        npm_config_build_from_source: 'true',
      },
    });
  } catch (err) {
    console.warn('Sharp rebuild failed:', err.message);
  }
}
