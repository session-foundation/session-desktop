/* eslint-disable no-bitwise */

import { numberToBigInt } from '../types/Bigint';
import { assertUnreachable } from '../types/sqlSharedTypes';

/**
 * An enum of the pro features that a message can have.
 * Note: this doesn't match libsession indexes, so we have to do the mapping manually (see the functions ).
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

type ProFeaturesContext = 'proMessage' | 'proProfile';

/**
 * Note: those returned values
 */
function getBitMaskForFeature(feature: ProMessageFeature, context: ProFeaturesContext) {
  if (context === 'proMessage') {
    switch (feature) {
      case ProMessageFeature.PRO_INCREASED_MESSAGE_LENGTH:
        // this has to match SESSION_PROTOCOL_PRO_MESSAGE_FEATURES in libsession
        return numberToBigInt(1);

      case ProMessageFeature.PRO_BADGE:
      case ProMessageFeature.PRO_ANIMATED_DISPLAY_PICTURE:
        throw new Error(
          'PRO_BADGE or PRO_ANIMATED_DISPLAY_PICTURE is not supported for proMessage'
        );

      default:
        assertUnreachable(feature, 'getLeftOperationCountForFeature: unknown case');
        throw new Error('unreachable');
    }
  }
  // context can only be proProfile here
  switch (feature) {
    case ProMessageFeature.PRO_INCREASED_MESSAGE_LENGTH:
      throw new Error('PRO_INCREASED_MESSAGE_LENGTH is not supported for proProfile');
    case ProMessageFeature.PRO_BADGE:
      // this has to match SESSION_PROTOCOL_PRO_PROFILE_FEATURES in libsession
      return numberToBigInt(1);
    case ProMessageFeature.PRO_ANIMATED_DISPLAY_PICTURE:
      // this has to match SESSION_PROTOCOL_PRO_PROFILE_FEATURES in libsession
      return numberToBigInt(2);
    default:
      assertUnreachable(feature, 'getLeftOperationCountForFeature: unknown case');
      throw new Error('unreachable');
  }
}

function hasProFeature(
  value: bigint | string,
  feature: ProMessageFeature,
  context: ProFeaturesContext
) {
  const parsed = typeof value === 'string' ? BigInt(value) : value;
  return !!(parsed & getBitMaskForFeature(feature, context));
}

function addProFeature(bitset: bigint, feature: ProMessageFeature, context: ProFeaturesContext) {
  return bitset | getBitMaskForFeature(feature, context);
}

function bigintToProFeatures({
  proProfileBitset,
  proMessageBitset,
}: {
  proProfileBitset: bigint;
  proMessageBitset: bigint;
}) {
  // Note: this needs to be the same mapping as the one in the libsession SESSION_PROTOCOL_PRO_FEATURES

  const features = [];
  if (
    hasProFeature(proMessageBitset, ProMessageFeature.PRO_INCREASED_MESSAGE_LENGTH, 'proMessage')
  ) {
    features.push(ProMessageFeature.PRO_INCREASED_MESSAGE_LENGTH);
  }
  if (hasProFeature(proProfileBitset, ProMessageFeature.PRO_BADGE, 'proProfile')) {
    features.push(ProMessageFeature.PRO_BADGE);
  }
  if (
    hasProFeature(proProfileBitset, ProMessageFeature.PRO_ANIMATED_DISPLAY_PICTURE, 'proProfile')
  ) {
    features.push(ProMessageFeature.PRO_ANIMATED_DISPLAY_PICTURE);
  }
  return features;
}

function proBitsetsToProFeatures({
  proProfileBitset,
  proMessageBitset,
}: {
  proProfileBitset?: string | null;
  proMessageBitset?: string | null;
}) {
  return bigintToProFeatures({
    proProfileBitset: proProfileBitset ? BigInt(proProfileBitset) : 0n,
    proMessageBitset: proMessageBitset ? BigInt(proMessageBitset) : 0n,
  });
}

export const ProFeatures = {
  proBitsetsToProFeatures,
  hasProFeature,
  /**
   * Adds a feature to the bitset, should only be used for testing.
   */
  addProFeature,
};
