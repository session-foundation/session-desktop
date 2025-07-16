/** NOTE: Because of docstring limitations changes MUST be manually synced between {@link setupI18n.getMessage } and {@link window.i18n } */

import type { SetupI18nReturnType } from '../../../types/localizer';
import {
  formatMessageWithArgs,
  getRawMessage,
  inEnglish,
  stripped,
  getMessageDefault,
  strippedWithObj,
} from '../../../localization/localeTools';

const getMessageDefaultCopy: any = getMessageDefault;

getMessageDefaultCopy.inEnglish = inEnglish;
getMessageDefaultCopy.stripped = stripped;
getMessageDefaultCopy.strippedWithObj = strippedWithObj;
getMessageDefaultCopy.getRawMessage = getRawMessage;
getMessageDefaultCopy.formatMessageWithArgs = formatMessageWithArgs;

export const getMessage: SetupI18nReturnType = getMessageDefaultCopy as SetupI18nReturnType;
