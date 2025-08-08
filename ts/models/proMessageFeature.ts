/* eslint-disable no-bitwise */
/**
 * An enum of the pro features that a message can have.
 */
export enum ProMessageFeature {
  PRO_INCREASED_MESSAGE_LENGTH = 'pro-increased-message-length',
  PRO_BADGE = 'pro-badge',
  PRO_ANIMATED_DISPLAY_PICTURE = 'pro-animated-display-picture',
}

function numberToProFeatures(bitMask: number) {
  // Note: this needs to be the same mapping as the one in the libsession

  const features = [];
  if (bitMask & (1 << 0)) {
    features.push(ProMessageFeature.PRO_INCREASED_MESSAGE_LENGTH);
  }
  if (bitMask & (1 << 1)) {
    features.push(ProMessageFeature.PRO_BADGE);
  }
  if (bitMask & (1 << 2)) {
    features.push(ProMessageFeature.PRO_ANIMATED_DISPLAY_PICTURE);
  }
  return features;
}

const proFeatureValues = Object.values(ProMessageFeature);

function isProMessageFeature(feature: string): feature is ProMessageFeature {
  return proFeatureValues.includes(feature as ProMessageFeature);
}

export const ProFeatures = {
  isProMessageFeature,
  numberToProFeatures,
};
