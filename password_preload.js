/* global window */
/* eslint-disable @typescript-eslint/no-var-requires */

const { ipcRenderer } = require('electron');
const url = require('url');
const { setupI18n } = require('./ts/util/i18n/i18n');

const config = url.parse(window.location.toString(), true).query;
const { crowdinLocale } = ipcRenderer.sendSync('locale-data');

// If the app is locked we can't access the database to check the theme.
window.theme = 'classic-dark';
window.primaryColor = 'green';

// Note: we have to call initializeRendererProcessLogger before setupI18n
const { initializeRendererProcessLogger } = require('./ts/util/logger/renderer_process_logging.js');

initializeRendererProcessLogger();

window.i18n = setupI18n({
  crowdinLocale,
});

window.getEnvironment = () => config.environment;
window.getVersion = () => config.version;
window.getAppInstance = () => config.appInstance;

window.clearLocalData = async () => {
  window.log.info('reset database');
  ipcRenderer.send('resetDatabase');
};

window.onLogin = passPhrase =>
  new Promise((resolve, reject) => {
    ipcRenderer.once('password-window-login-response', (event, error) => {
      if (error) {
        return reject(error);
      }
      return resolve();
    });
    ipcRenderer.send('password-window-login', passPhrase);
  });

require('./ts/util/logging');
