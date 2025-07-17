import * as crypto from 'crypto';
import { isString } from 'lodash';
import { PASSWORD_LENGTH } from '../session/constants';
import { tr } from '../localization/localeTools';

const sha512 = (text: string) => {
  const hash = crypto.createHash('sha512');
  hash.update(text.trim());
  return hash.digest('hex');
};

export const generateHash = (phrase: string) => phrase && sha512(phrase);
export const matchesHash = (phrase: string | null, hash: string) =>
  phrase && sha512(phrase) === hash;

export const validatePassword = (phrase: string) => {
  if (!isString(phrase)) {
    return tr('passwordError');
  }

  if (phrase.length === 0) {
    return tr('passwordErrorLength');
  }

  if (
    phrase.length < PASSWORD_LENGTH.MIN_PASSWORD_LEN ||
    phrase.length > PASSWORD_LENGTH.MAX_PASSWORD_LEN
  ) {
    return tr('passwordErrorLength');
  }

  // Restrict characters to letters, numbers and symbols
  const characterRegex = /^[a-zA-Z0-9-!?/\\()._`~@#$%^&*+=[\]{}|<>,;: ]+$/;
  if (!characterRegex.test(phrase)) {
    return tr('passwordError');
  }

  return null;
};
