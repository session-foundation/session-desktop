import { ipcRenderer } from 'electron';
import pTimeout from 'p-timeout';

import { beforeRestart } from '../util/logger/renderer_process_logging';
import { DURATION } from '../session/constants';

export function deleteAllLogs(): Promise<void> {
  // Restart logging again when the file stream close
  beforeRestart();
  return pTimeout(ipcRenderer.invoke('delete-all-logs', false), 5 * DURATION.SECONDS);
}
