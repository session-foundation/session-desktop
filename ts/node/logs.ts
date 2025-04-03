import { ipcRenderer } from 'electron';
import pTimeout from 'p-timeout';

import { DURATION } from '../session/constants';

export function deleteAllLogs(): Promise<void> {
  return pTimeout(ipcRenderer.invoke('delete-all-logs', false), 5 * DURATION.SECONDS);
}
