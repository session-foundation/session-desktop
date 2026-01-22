import path from 'path';

const PROJECT_ROOT = path.join(__dirname, '..');

export type BuildConfig = {
  APP_DIR: string;
  DIST_DIR: string;
  CACHE_FILE: string;
  filesToCopy: Array<string>;
  directoriesToCopy: Array<string>;
};

// NOTE: a modified version of package.json is also copied into the app dir

const BUILD_CONFIG: BuildConfig = {
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
    'stylesheets/fonts.css',
    'volatile_assets/GeoLite2-Country.mmdb',
    'volatile_assets/service-nodes-cache.json',
  ],
  directoriesToCopy: [
    'images',
    'sound',
    'fonts',
    'config',
    'mnemonic_languages',
    'node_modules',
    'ts/protobuf',
    'assets',
  ],
};

export default BUILD_CONFIG;
