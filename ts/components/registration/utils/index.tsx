import { EmptyDisplayNameError } from '../../../session/utils/errors';
import { sanitizeSessionUsername } from '../../../session/utils/String';

export function sanitizeDisplayNameOrToast(displayName: string) {
  const sanitizedName = sanitizeSessionUsername(displayName).trim();

  if (!sanitizedName) {
    throw new EmptyDisplayNameError();
  }

  return sanitizedName;
}
