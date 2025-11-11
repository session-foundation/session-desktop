/* eslint-disable no-bitwise */

import { numberToBigInt } from '../types/Bigint';

/**
 * An enum of the pro features that a message can have.
 */
export enum ProMessageFeature {
  PRO_INCREASED_MESSAGE_LENGTH = 'pro-increased-message-length',
  PRO_BADGE = 'pro-badge',
  PRO_ANIMATED_DISPLAY_PICTURE = 'pro-animated-display-picture',
}

function hasProFeature(bitMask: bigint, feature: ProMessageFeature) {
  return bitMask & numberToBigInt(1 << proFeatureValues.indexOf(feature));
}

function addProFeature(bitMask: bigint, feature: ProMessageFeature) {
  return bitMask | numberToBigInt(1 << proFeatureValues.indexOf(feature));
}

function bigintToProFeatures(bitMask: bigint) {
  // Note: this needs to be the same mapping as the one in the libsession SESSION_PROTOCOL_PRO_FEATURES

  const features = [];
  if (hasProFeature(bitMask, ProMessageFeature.PRO_INCREASED_MESSAGE_LENGTH)) {
    features.push(ProMessageFeature.PRO_INCREASED_MESSAGE_LENGTH);
  }
  if (hasProFeature(bitMask, ProMessageFeature.PRO_BADGE)) {
    features.push(ProMessageFeature.PRO_BADGE);
  }
  if (hasProFeature(bitMask, ProMessageFeature.PRO_ANIMATED_DISPLAY_PICTURE)) {
    features.push(ProMessageFeature.PRO_ANIMATED_DISPLAY_PICTURE);
  }
  return features;
}

function bigIntStrToProFeatures(bitMaskAsAstr: string) {
  const asBigInt = BigInt(bitMaskAsAstr);

  return bigintToProFeatures(asBigInt);
}

const proFeatureValues = Object.values(ProMessageFeature);

function isProMessageFeature(feature: string): feature is ProMessageFeature {
  return proFeatureValues.includes(feature as ProMessageFeature);
}

export const ProFeatures = {
  isProMessageFeature,
  bigintToProFeatures,
  bigIntStrToProFeatures,
  hasProFeature,
  /**
   * Adds a feature to the bit mask, should only be used for testing.
   */
  addProFeature,
};
