import path from 'path';

import { app } from 'electron';

import { z } from 'zod';
import { start } from './base_config';
import { SettingsDefault, SettingsKey } from '../../data/settings-key';

const userDataPath = app.getPath('userData');
const targetPath = path.join(userDataPath, 'ephemeral.json');

const ephemeralConfig = start('ephemeral', targetPath, {
  allowMalformedOnStartup: true,
});

const hideMenuBarDefault = SettingsDefault[SettingsKey.settingsHideMenuBar];

const defaultWindowConfig = {
  maximized: false,
  fullscreen: undefined,
  width: null,
  height: null,
  x: undefined,
  y: undefined,
  hideMenuBar: hideMenuBarDefault,
};
export const windowConfigSchema = z.object({
  // BrowserWindow options
  maximized: z.boolean().default(defaultWindowConfig.maximized),
  // Only include fullscreen if true, because when explicitly set to
  // false the fullscreen button will be disabled on osx
  fullscreen: z.boolean().optional(),
  width: z.number().nullable().default(defaultWindowConfig.width),
  height: z.number().nullable().default(defaultWindowConfig.height),
  x: z.number().optional(),
  y: z.number().optional(),
  // Custom options
  hideMenuBar: z.boolean().default(hideMenuBarDefault),
});

export function getEphemeralWindowConfig() {
  const windowConfig = ephemeralConfig.get('window');
  const parseResult = windowConfigSchema.safeParse(windowConfig);
  if (parseResult.error) {
    console.error(parseResult.error);
  }
  return parseResult.data ?? defaultWindowConfig;
}

export function setEphemeralWindowConfig(config: z.infer<typeof windowConfigSchema>) {
  const parseResult = windowConfigSchema.safeParse(config);
  if (parseResult.error) {
    console.error(parseResult.error);
  }
  ephemeralConfig.set('window', config);
}

export function removeEphemeralConfig() {
  ephemeralConfig.remove();
}
