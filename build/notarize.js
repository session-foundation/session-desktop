/*
 Pre-requisites: https://github.com/electron/electron-notarize#prerequisites
    1. Generate an app specific password
    2. Export SIGNING_APPLE_ID, SIGNING_APP_PASSWORD, SIGNING_TEAM_ID environment variables
*/

/*
  Notarizing: https://kilianvalkhof.com/2019/electron/notarizing-your-electron-application/
  This script is heavily inspired by https://github.com/electron/notarize/issues/193#issuecomment-2466569367
  For up to date official mac information, see https://developer.apple.com/documentation/security/customizing-the-notarization-workflow
*/

const log = msg => console.log(`\n${msg}`);
const isEmpty = v => !v || v.length === 0;

const { execSync } = require('node:child_process');

function runCommandWithExitCode(command) {
  try {
    const output = execSync(command, { stdio: 'pipe' });
    return { success: true, output: output.toString().trim() };
  } catch (error) {
    return { success: false, code: error.status, message: error.stderr.toString().trim() };
  }
}

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;

  const appPath = `${appOutDir}/${appName}.app`;
  const zipPath = `${appOutDir}/${appName}.zip`;

  const verifyCheck = runCommandWithExitCode(`codesign --verify --deep --strict "${appPath}"`);
  if (!verifyCheck.success) {
    if (verifyCheck.code === 1) {
      console.error(`Signature is invalid for app "${appPath}".`);
    } else if (verifyCheck.code === 2) {
      console.error(`"${appPath}" is not signed.`);
    } else {
      console.error(`Error (${verifyCheck.code}): ${verifyCheck.message} for app: "${appPath}"`);
    }
    console.warn('skipping notarization step');
    return;
  }

  log(`"${appPath}" signature is valid.`);
  log('Notarizing mac application');

  const { SIGNING_APPLE_ID, SIGNING_APP_PASSWORD, SIGNING_TEAM_ID } = process.env;

  if (isEmpty(SIGNING_APPLE_ID)) {
    log('SIGNING_APPLE_ID not set.\nTerminating notarization.');
    return;
  }

  if (isEmpty(SIGNING_APP_PASSWORD)) {
    log('SIGNING_APP_PASSWORD not set.\nTerminating notarization.');
    return;
  }

  if (isEmpty(SIGNING_TEAM_ID)) {
    log(' SIGNING_TEAM_ID not set.\nTerminating notarization.');
    return;
  }

  console.log(
    execSync(`ditto -c -k  --sequesterRsrc --keepParent "${appPath}" "${zipPath}"`, {
      encoding: 'utf8',
    })
  );

  console.log(
    execSync(
      `xcrun notarytool submit "${zipPath}" --team-id "${SIGNING_TEAM_ID}" --apple-id "${SIGNING_APPLE_ID}" --password "${SIGNING_APP_PASSWORD}" --verbose --wait`,
      { encoding: 'utf8' }
    )
  );

  console.log(execSync(`xcrun stapler staple "${appPath}"`, { encoding: 'utf8' }));
};
