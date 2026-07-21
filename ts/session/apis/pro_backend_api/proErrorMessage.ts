import { isSimpleTokenNoArgs, tr } from '../../../localization/localeTools';

/**
 * Resolve a failed Pro backend request to a user-facing message.
 *
 * The backend sends an open-ended `errorCode` slug (wire spec §5.1) plus an English diagnostic
 * `error`. We prefer a localized `pro_error_<slug>` string when one exists (so a brand-new slug needs
 * only a translation entry — no code change), and fall back to the backend diagnostic, then a generic
 * message.
 *
 * Unlike android/iOS, no brand-token ({pro}/{app_pro}/…) handling is needed here: the shared-scripts
 * generator bakes brand constants into the desktop strings at build time, so a `pro_error_*` string is
 * already fully substituted by the time it reaches us.
 */
export function proErrorMessage(
  errorCode: string | null | undefined,
  backendError: string | null | undefined
): string {
  if (errorCode) {
    const key = `pro_error_${errorCode}`;
    // Base-English existence check; tr() then resolves the current locale, falling back to English.
    if (isSimpleTokenNoArgs(key)) {
      return tr(key);
    }
  }
  return backendError ?? tr('errorGeneric');
}
