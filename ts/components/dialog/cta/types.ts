export enum CTAVariant {
  // NOTE: -- Pro CTAs --
  PRO_GENERIC = 1,

  // Pro Features - has expired sub variants
  PRO_MESSAGE_CHARACTER_LIMIT = 2,
  PRO_ANIMATED_DISPLAY_PICTURE = 3,
  PRO_ANIMATED_DISPLAY_PICTURE_ACTIVATED = 4,
  PRO_PINNED_CONVERSATION_LIMIT = 5,
  PRO_PINNED_CONVERSATION_LIMIT_GRANDFATHERED = 6,

  // Pro Groups
  PRO_GROUP_NON_ADMIN = 30,
  PRO_GROUP_ADMIN = 31,
  PRO_GROUP_ACTIVATED = 32,

  // Pro Triggered
  PRO_EXPIRING_SOON = 40,
  PRO_EXPIRED = 41,

  // -- NOTE: -- Other CTAs --
  DONATE_GENERIC = 100,
}

const proCTAVariants = [
  CTAVariant.PRO_GENERIC,
  CTAVariant.PRO_MESSAGE_CHARACTER_LIMIT,
  CTAVariant.PRO_ANIMATED_DISPLAY_PICTURE,
  CTAVariant.PRO_ANIMATED_DISPLAY_PICTURE_ACTIVATED,
  CTAVariant.PRO_PINNED_CONVERSATION_LIMIT,
  CTAVariant.PRO_PINNED_CONVERSATION_LIMIT_GRANDFATHERED,
  CTAVariant.PRO_GROUP_NON_ADMIN,
  CTAVariant.PRO_GROUP_ADMIN,
  CTAVariant.PRO_GROUP_ACTIVATED,
  CTAVariant.PRO_EXPIRING_SOON,
  CTAVariant.PRO_EXPIRED,
] as const;

export type ProCTAVariant = (typeof proCTAVariants)[number];

export const isProCTAVariant = (v: CTAVariant): v is ProCTAVariant =>
  proCTAVariants.includes(v as number);

export type CTAVariantExcludingProCTAs = Exclude<CTAVariant, ProCTAVariant>;

// These CTAS have "Upgrade to" and "Renew" titles.
const variantsForNonGroupFeatures = [
  CTAVariant.PRO_MESSAGE_CHARACTER_LIMIT,
  CTAVariant.PRO_ANIMATED_DISPLAY_PICTURE,
  CTAVariant.PRO_PINNED_CONVERSATION_LIMIT,
  CTAVariant.PRO_PINNED_CONVERSATION_LIMIT_GRANDFATHERED,
  CTAVariant.PRO_GENERIC,
] as const;

type VariantForNonGroupFeature = (typeof variantsForNonGroupFeatures)[number];

export function isProCTAFeatureVariant(variant: CTAVariant): variant is VariantForNonGroupFeature {
  return variantsForNonGroupFeatures.includes(variant as number);
}
