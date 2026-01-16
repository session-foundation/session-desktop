const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');

const BUILD_CONFIG = {
  APP_DIR: path.join(PROJECT_ROOT, 'app'),
  DIST_DIR: path.join(PROJECT_ROOT, 'dist'),
  CACHE_FILE: path.join(PROJECT_ROOT, '.build-cache', 'file-cache.json'),
  filesToCopy: [
    'about.html',
    'about_preload.js',
    'background.html',
    'password.html',
    'password_preload.js',
    'preload.js',
    'yarn.lock',
    'mmdb/GeoLite2-Country.mmdb',
    'stylesheets/fonts.css'
  ],
  directoriesToCopy: [
    'images',
    'fonts',
    'config',
    'mnemonic_languages',
    'node_modules',
    'ts/protobuf',
  ],
};

module.exports = BUILD_CONFIG;
