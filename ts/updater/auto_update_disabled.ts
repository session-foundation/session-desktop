export const DISABLE_UPDATE_PROMPT_ARG = '--disable-update-prompt';

export function autoUpdateDisabled(
  userSetting: unknown,
  argv: ReadonlyArray<string> = process.argv,
  isMacAppStore = process.mas
): boolean {
  const autoUpdate = typeof userSetting !== 'boolean' || userSetting;

  return isMacAppStore || argv.includes(DISABLE_UPDATE_PROMPT_ARG) || !autoUpdate;
}
