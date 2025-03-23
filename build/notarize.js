/*
 Pre-requisites: https://github.com/electron/electron-notarize#prerequisites
    1. Generate an app specific password
    2. Export SIGNING_APPLE_ID, SIGNING_APP_PASSWORD, SIGNING_TEAM_ID environment variables
*/

/*
  Notarizing: https://kilianvalkhof.com/2019/electron/notarizing-your-electron-application/
*/

const log = msg => console.log(`\n${msg}`);
const isEmpty = v => !v || v.length === 0;

const { execSync } = require('node:child_process');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') {
    return;
  }
  log('Notarizing mac application');

  const appName = context.packager.appInfo.productFilename;

  const { SIGNING_APPLE_ID, SIGNING_APP_PASSWORD, SIGNING_TEAM_ID } = process.env;

  if (isEmpty(process.env.MAC_CERTIFICATE)) {
    log('MAC_CERTIFICATE not set. \nTerminating notarization.');
    return;
  } else {
    process.env.CSC_LINK = '$MAC_CERTIFICATE';
    log('MAC_CERTIFICATE found, set to CSC_LINK');
  }

  if (isEmpty(process.env.MAC_CERTIFICATE_PASSWORD)) {
    log('MAC_CERTIFICATE_PASSWORD not set. \nTerminating notarization.');
    return;
  } else {
    process.env.CSC_KEY_PASSWORD = '$MAC_CERTIFICATE_PASSWORD';
    log('MAC_CERTIFICATE_PASSWORD found, set to CSC_KEY_PASSWORD.');
  }

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

  const appPath = `${appOutDir}/${appName}.app`;
  const zipPath = `${appOutDir}/${appName}.zip`;
  const appleId = SIGNING_APPLE_ID;
  const appleIdPassword = SIGNING_APP_PASSWORD;
  const teamId = SIGNING_TEAM_ID;

  console.log(
    execSync(`ditto -c -k --keepParent "${appPath}" "${zipPath}"`, {
      encoding: 'utf8',
    })
  );

  console.log(
    execSync(
      `xcrundefaults write com.apple.gke.notary.tool nt-upload-connection-timeout 300`,
      { encoding: 'utf8' }
    )
  );



  console.log(
    execSync(
      `xcrun notarytool submit "${zipPath}" --team-id "${teamId}" --apple-id "${appleId}" --password "${appleIdPassword}" --verbose --wait`,
      { encoding: 'utf8' }
    )
  );

  console.log(execSync(`xcrun stapler staple "${appPath}"`, { encoding: 'utf8' }));
};
