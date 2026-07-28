// The Session Pro wire no longer uses fixed integer enums: account status, per-payment status, plan,
// and payment provider are all opaque string codes that libsession parses and passes through verbatim.
// We keep the canonical slugs as named constants; an unknown/future value passes through as-is (map the
// known ones for display, never hard-fail on a new one). Human-readable NAMES are translation data owned
// by the client (i18n), keyed on these slugs.

export const ProStatus = {
  Never: 'never',
  Active: 'active',
  Expired: 'expired',
} as const;
/** Account-level Pro status slug (canonical values in {@link ProStatus}); may be an unknown slug. */
export type ProStatus = string;

export const ProItemStatus = {
  Unredeemed: 'unredeemed',
  Redeemed: 'redeemed',
  Expired: 'expired',
  Revoked: 'revoked',
} as const;
/** Per-payment status slug (canonical values in {@link ProItemStatus}); may be an unknown slug. */
export type ProItemStatus = string;

export const ProAccessVariant = {
  OneMonth: '1m',
  ThreeMonth: '3m',
  TwelveMonth: '1y',
} as const;
/** Billing-period slug (canonical values in {@link ProAccessVariant}); may be an unknown slug. */
export type ProAccessVariant = string;

export const ProPaymentProvider = {
  GooglePlay: 'google_play',
  AppStore: 'app_store',
  Rangeproof: 'rangeproof',
} as const;
/** Payment-provider slug (canonical values in {@link ProPaymentProvider}); may be an unknown slug. */
export type ProPaymentProvider = string;
