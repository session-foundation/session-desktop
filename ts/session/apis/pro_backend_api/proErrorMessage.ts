import { isSimpleTokenNoArgs, tr } from '../../../localization/localeTools';

/**
 * Resolve a failed Pro backend request to a user-facing message: prefer the localized
 * `pro_error_<slug>` string for the backend's `errorCode` (a new slug needs only a translation, no
 * code change), else the backend's diagnostic `error`, else a generic message.
 */
export function proErrorMessage(
  errorCode: string | null | undefined,
  backendError: string | null | undefined
): string {
  if (errorCode) {
    const key = `pro_error_${errorCode}`;
    // pro_error_* strings take no args, so this is just an existence check — "does a translation
    // exist for this slug" — against the base-English strings; tr() then resolves the locale.
    if (isSimpleTokenNoArgs(key)) {
      return tr(key);
    }
  }
  return backendError ?? tr('errorGeneric');
}
