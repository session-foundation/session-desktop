/**
 * An enum of the pro features that a message can have.
 */
export enum ProMessageFeature {
  PRO_BADGE = 'pro-badge',
  PRO_INCREASED_MESSAGE_LENGTH = 'pro-increased-message-length',
  PRO_ANIMATED_DISPLAY_PICTURE = 'pro-animated-display-picture',
}

const proFeatureValues = Object.values(ProMessageFeature);

export function isProMessageFeature(feature: string): feature is ProMessageFeature {
  return proFeatureValues.includes(feature as ProMessageFeature);
}
