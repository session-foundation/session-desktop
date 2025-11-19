/* eslint-disable no-bitwise */

import { numberToBigInt } from '../types/Bigint';

/**
 * An enum of the pro features that a message can have.
 * This has to be a perfect match of libsession indexes.
 */
export enum ProMessageFeature {
  /**
   * bitset value of 1 (1 << 0)
   */
  PRO_INCREASED_MESSAGE_LENGTH = 'pro-increased-message-length',
  /**
   * bitset value of 2 (1 << 1)
   */
  PRO_BADGE = 'pro-badge',
  /**
   * bitset value of 4 (1 << 2)
   */
  PRO_ANIMATED_DISPLAY_PICTURE = 'pro-animated-display-picture',
}

function hasProFeature(bitset: bigint, feature: ProMessageFeature) {
  return !!(bitset & numberToBigInt(1 << proFeatureValues.indexOf(feature)));
}

function addProFeature(bitset: bigint, feature: ProMessageFeature) {
  return bitset | numberToBigInt(1 << proFeatureValues.indexOf(feature));
}

function bigintToProFeatures(bitset: bigint) {
  // Note: this needs to be the same mapping as the one in the libsession SESSION_PROTOCOL_PRO_FEATURES

  const features = [];
  if (hasProFeature(bitset, ProMessageFeature.PRO_INCREASED_MESSAGE_LENGTH)) {
    features.push(ProMessageFeature.PRO_INCREASED_MESSAGE_LENGTH);
  }
  if (hasProFeature(bitset, ProMessageFeature.PRO_BADGE)) {
    features.push(ProMessageFeature.PRO_BADGE);
  }
  if (hasProFeature(bitset, ProMessageFeature.PRO_ANIMATED_DISPLAY_PICTURE)) {
    features.push(ProMessageFeature.PRO_ANIMATED_DISPLAY_PICTURE);
  }
  return features;
}

function bigIntStrToProFeatures(bitsetAsAstr: string) {
  const asBigInt = BigInt(bitsetAsAstr);

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
   * Adds a feature to the bitset, should only be used for testing.
   */
  addProFeature,
};
