import pino, { type StreamEntry } from 'pino';
import { createRotatingPinoDest } from './rotatingPinoDest';

export function buildPinoLogger(logFile: string, onStreamClosed: () => void) {
  const hasDebugLoggingEnabled = !!process.env.SESSION_DEBUG;
  const rotatingStream = createRotatingPinoDest({
    logFile,
  });

  rotatingStream.on('close', onStreamClosed);
  rotatingStream.on('error', onStreamClosed);

  const streams = new Array<StreamEntry>();

  const levelToLog: pino.Level = hasDebugLoggingEnabled ? 'debug' : 'info';

  streams.push({ level: levelToLog, stream: rotatingStream });
  streams.push({
    level: levelToLog,
    stream: process.stdout,
  });

  return pino(
    {
      formatters: {
        // No point in saving pid or hostname
        bindings: () => ({}),
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      level: levelToLog,
    },
    pino.multistream(streams)
  );
}
