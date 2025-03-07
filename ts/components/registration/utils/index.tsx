import { EmptyDisplayNameError } from '../../../session/utils/errors';
import { sanitizeSessionUsername, trimWhitespace } from '../../../session/utils/String';

export function sanitizeDisplayNameOrToast(displayName: string) {
  const sanitizedName = trimWhitespace(sanitizeSessionUsername(displayName));

  if (!sanitizedName) {
    throw new EmptyDisplayNameError();
  }

  return sanitizedName;
}
