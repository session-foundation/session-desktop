import { isString } from 'lodash';
import { tEnglish, tr } from '../localization/localeTools';

/**
 * Adds the accelerator prefix to the label for the menu item
 * @link https://www.electronjs.org/docs/latest/api/menu#static-methods
 *
 * @param label - The label for the menu item
 * @returns The label with the accelerator prefix
 */
const withAcceleratorPrefix = (label: string) => {
  return `&${label}`;
};

export const createTemplate = (options: {
  openReleaseNotes: () => void;
  openSupportPage: () => void;
  platform: string;
  showAbout: () => void;
  saveDebugLog: (_event: any, additionalInfo?: string) => void;
  showWindow: () => void;
}) => {
  if (!isString(options.platform)) {
    throw new TypeError('`options.platform` must be a string');
  }

  const { openReleaseNotes, openSupportPage, platform, showAbout, saveDebugLog, showWindow } =
    options;

  const template = [
    {
      label: withAcceleratorPrefix(tr('file')),
      submenu: [
        {
          type: 'separator',
        },
        {
          role: 'quit',
          label: tr('quit'),
        },
      ],
    },
    {
      label: withAcceleratorPrefix(tr('edit')),
      submenu: [
        {
          role: 'undo',
          label: tr('undo'),
        },
        {
          role: 'redo',
          label: tr('redo'),
        },
        {
          type: 'separator',
        },
        {
          role: 'cut',
          label: tr('cut'),
        },
        {
          role: 'copy',
          label: tr('copy'),
        },
        {
          role: 'paste',
          label: tr('paste'),
        },
        {
          role: 'selectall',
          label: tr('selectAll'),
        },
      ],
    },
    {
      label: withAcceleratorPrefix(tr('view')),
      submenu: [
        {
          role: 'resetzoom',
          label: tr('actualSize'),
        },
        {
          accelerator: platform === 'darwin' ? 'Command+=' : 'Control+Plus',
          role: 'zoomin',
          label: tr('appearanceZoomIn'),
        },
        {
          role: 'zoomout',
          label: tr('appearanceZoomOut'),
        },
        {
          type: 'separator',
        },
        {
          role: 'togglefullscreen',
          label: tr('fullScreenToggle'),
        },
        {
          type: 'separator',
        },
        {
          label: tr('helpReportABugExportLogs'),
          click: () => {
            saveDebugLog('export-logs');
          },
        },
        {
          role: 'toggledevtools',
          label: tr('developerToolsToggle'),
        },
      ],
    },
    {
      label: withAcceleratorPrefix(tr('window')),
      role: 'window',
      submenu: [
        {
          role: 'minimize',
          label: tr('minimize'),
        },
      ],
    },
    {
      label: withAcceleratorPrefix(tr('sessionHelp')),
      role: 'help',
      submenu: [
        {
          label: tr('updateReleaseNotes'),
          click: openReleaseNotes,
        },
        {
          label: tr('supportGoTo'),
          click: openSupportPage,
        },
        {
          type: 'separator',
        },
        {
          label: tr('about'),
          click: showAbout,
        },
      ],
    },
  ];

  if (platform === 'darwin') {
    return updateForMac(template, {
      showAbout,
      showWindow,
    });
  }

  return template;
};

function updateForMac(template: any, options: { showAbout: () => void; showWindow: () => void }) {
  const { showAbout, showWindow } = options;

  // Remove About item and separator from Help menu, since it's on the first menu
  template[4].submenu.pop();
  template[4].submenu.pop();

  // Remove File menu
  template.shift();

  // Add the OSX-specific Session Desktop menu to the far left
  template.unshift({
    label: tEnglish('appName'),
    submenu: [
      {
        label: tr('about'),
        click: showAbout,
      },
      {
        type: 'separator',
      },
      {
        type: 'separator',
      },
      {
        label: tr('hide'),
        role: 'hide',
      },
      {
        label: tr('hideOthers'),
        role: 'hideothers',
      },
      {
        label: tr('showAll'),
        role: 'unhide',
      },
      {
        type: 'separator',
      },
      {
        label: tr('quit'),
        role: 'quit',
      },
    ],
  });

  // Replace Window menu
  const windowMenuTemplateIndex = 3;
  // eslint-disable-next-line no-param-reassign
  template[windowMenuTemplateIndex].submenu = [
    {
      label: tr('closeWindow'),
      accelerator: 'CmdOrCtrl+W',
      role: 'close',
    },
    {
      label: tr('minimize'),
      accelerator: 'CmdOrCtrl+M',
      role: 'minimize',
    },
    {
      label: tr('appearanceZoom'),
      role: 'zoom',
    },
    {
      label: tr('show'),
      click: showWindow,
    },
  ];

  return template;
}
