import { app } from 'electron';
import { appendFileSync } from 'fs-extra';
import path from 'node:path';

/**
 * Logs a crash of the renderer/main process to the userData directory, file `crash-log.txt`.
 * Also, see the crashReporter for dumps of the crash itself
 */
export function logCrash(type: string, details: any) {
  const crashLogPath = path.join(app.getPath('userData'), 'crash-log.txt');
  const logLine = `[${new Date().toISOString()}] ${type} crash: ${JSON.stringify(details)}\n`;
  appendFileSync(crashLogPath, logLine, 'utf8');
}
