/* eslint-disable @typescript-eslint/no-var-requires */
/* global window */

const { ipcRenderer } = require('electron');
const url = require('url');
const os = require('os');
const { setupI18n } = require('./ts/util/i18n/i18n');

const config = url.parse(window.location.toString(), true).query;
const { crowdinLocale } = ipcRenderer.sendSync('locale-data');

window.theme = config.theme;

// Note: we have to call initializeRendererProcessLogger before setupI18n
const { initializeRendererProcessLogger } = require('./ts/util/logger/renderer_process_logging.js');

initializeRendererProcessLogger();

window.i18n = setupI18n({
  crowdinLocale,
});

window.getOSRelease = () =>
  `${os.type()} ${os.release()}, Node.js ${config.node_version} ${os.platform()} ${os.arch()}`;
window.getEnvironment = () => config.environment;
window.getVersion = () => config.version;
window.getCommitHash = () => config.commitHash;
window.getAppInstance = () => config.appInstance;

require('./ts/util/logging');
