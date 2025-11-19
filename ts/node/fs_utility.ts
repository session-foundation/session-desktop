import fs from 'fs';

export function getFileCreationTimestampMs(filePath: string): number | null {
  if (!filePath || typeof filePath !== 'string') {
    console.warn('Invalid file path provided');
    return null;
  }

  try {
    const stats = fs.statSync(filePath);

    if (
      typeof stats.birthtimeMs !== 'number' ||
      !Number.isFinite(stats.birthtimeMs) ||
      stats.birthtimeMs <= 0
    ) {
      console.warn(`Birth time is not a valid number for file: ${filePath}`);
      return null;
    }

    return stats.birthtimeMs;
  } catch (error) {
    console.error(`Failed to get creation time for file ${filePath}`, error);
    return null;
  }
}
