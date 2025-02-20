const os = require('os');
const path = require('path');
const fs = require('fs');
const util = require('util');

const existsAsync = util.promisify(fs.exists);
const readAsync = util.promisify(fs.readFile);
const renameAsync = util.promisify(fs.rename);
const writeAsync = util.promisify(fs.writeFile);

const builds = [];

exports.default = async function (context) {
  // Update the latest-mac.yml on macOS only.
  if (process.platform !== 'darwin') {
    return;
  }

  const sourceLatestYML = path.join(context.outDir, 'latest-mac.yml');
  // return if there is no latest-mac.yml file
  if (!(await existsAsync(sourceLatestYML))) {
    return;
  }

  console.log(`afterAllArtifactBuild hook triggered on ${os.arch()}`);

  const targetHostYML = path.join(context.outDir, `latest-${os.arch()}-mac.yml`);
  // rename latest-mac.yml to latest-{arm64 or x64}-mac.yml
  await renameAsync(sourceLatestYML, targetHostYML);
  console.log(`Renamed ${sourceLatestYML} to ${targetHostYML}`);
  builds.push(targetHostYML);

  if (builds.length === 2) {
    console.log('Both builds are complete');
    // we want to combine the files from both latest-arm64-mac.yml and latest-x64-mac.yml into latest-mac.yml
    const targetLatestYML = path.join(context.outDir, 'latest-mac.yml');
    const arm64YML = builds.find(file => file.includes('arm64'));
    const x64YML = builds.find(file => file.includes('x64'));
    const arm64YMLContent = await readAsync(arm64YML, 'utf8');
    const x64YMLContent = await readAsync(x64YML, 'utf8');
    // read the files key from the x64 file and add it to the arm64 file in the files key
    const x64FilesKey = x64YMLContent.match(/files:\n([\s\S]*?)\n\n/)[1];
    console.log('x64FilesKey', x64FilesKey);
    const arm64YMLContentWithX64Files = arm64YMLContent.replace('files:', `files:\n${x64FilesKey}`);
    await writeAsync(targetLatestYML, arm64YMLContentWithX64Files);
    console.log(`Combined ${arm64YML} and ${x64YML} into ${targetLatestYML}`);
  }

  // you can return additional files to publish
  return [targetHostYML];
};
