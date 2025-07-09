import { EmptyDisplayNameError } from '../../../session/utils/errors';
import { trimWhitespace } from '../../../session/utils/String';

export function sanitizeDisplayNameOrToast(displayName: string) {
  const sanitizedName = trimWhitespace(displayName);

  if (!sanitizedName) {
    throw new EmptyDisplayNameError();
  }

  return sanitizedName;
}
