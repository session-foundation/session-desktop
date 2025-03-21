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

  if (isEmpty(SIGNING_APPLE_ID) || isEmpty(SIGNING_APP_PASSWORD) || isEmpty(SIGNING_TEAM_ID)) {
    log(
      'SIGNING_APPLE_ID or SIGNING_APP_PASSWORD or SIGNING_TEAM_ID not set.\nTerminating noratization.'
    );
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
      `xcrun notarytool submit "${appPath}" --team-id "${teamId}" --apple-id "${appleId}" --password "${appleIdPassword}" --wait`,
      { encoding: 'utf8' }
    )
  );

  console.log(execSync(`xcrun stapler staple "${appPath}"`, { encoding: 'utf8' }));
};
