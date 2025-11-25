export function logDebugWithCat(
  cat: `[${string}]`,
  message: string,
  enable: boolean,
  ...args: Array<unknown>
) {
  if (!enable) {
    return;
  }
  window?.log?.debug(`${cat} ${message}`, ...args);
}
