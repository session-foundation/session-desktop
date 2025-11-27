/* eslint-disable no-bitwise */
import { isEmpty } from 'lodash';
import { base64_variants, from_base64, from_hex } from 'libsodium-wrappers-sumo';
import type { ProConfig } from 'libsession_util_nodejs';
import { SignalService } from '../../protobuf';
import { bigIntToLong } from '../Bigint';
import { getDataFeatureFlag } from '../../state/ducks/types/releasedFeaturesReduxTypes';
import { ProFeatures, ProMessageFeature } from '../../models/proMessageFeature';

export class OutgoingProMessageDetails {
  public readonly proConfig?: ProConfig;
  public readonly proProfileBitset: bigint;
  public readonly proMessageBitset: bigint;

  constructor(args: {
    proConfig?: ProConfig;
    proProfileBitset?: bigint;
    proMessageBitset?: bigint;
  }) {
    this.proConfig = args.proConfig;

    this.proProfileBitset = args.proProfileBitset || 0n;
    this.proMessageBitset = args.proMessageBitset || 0n;

    const mockMessageProFeatures = getDataFeatureFlag('mockMessageProFeatures');
    if (mockMessageProFeatures?.length) {
      if (mockMessageProFeatures.includes(ProMessageFeature.PRO_INCREASED_MESSAGE_LENGTH)) {
        this.proMessageBitset = ProFeatures.addProFeature(
          this.proMessageBitset,
          ProMessageFeature.PRO_INCREASED_MESSAGE_LENGTH,
          'proMessage'
        );
      }
      if (mockMessageProFeatures.includes(ProMessageFeature.PRO_BADGE)) {
        this.proProfileBitset = ProFeatures.addProFeature(
          this.proProfileBitset,
          ProMessageFeature.PRO_BADGE,
          'proProfile'
        );
      }
      if (mockMessageProFeatures.includes(ProMessageFeature.PRO_ANIMATED_DISPLAY_PICTURE)) {
        this.proProfileBitset = ProFeatures.addProFeature(
          this.proProfileBitset,
          ProMessageFeature.PRO_ANIMATED_DISPLAY_PICTURE,
          'proProfile'
        );
      }
    }
  }

  public toProtobufDetails(): SignalService.ProMessage | null {
    const hasOneBitsetSet = !!(this.proProfileBitset || this.proMessageBitset);
    if (!hasOneBitsetSet || !this.proConfig || !this.proConfig.proProof) {
      if (!hasOneBitsetSet && !isEmpty(this.proConfig?.proProof)) {
        window.log.debug(
          'OutgoingProMessageDetails: proof is not empty but bitsets are so not including pro proof.'
        );
      }
      return null;
    }
    const { expiryMs, genIndexHashB64, rotatingPubkeyHex, signatureHex, version } =
      this.proConfig.proProof;

    return new SignalService.ProMessage({
      profileBitset: bigIntToLong(this.proProfileBitset),
      messageBitset: bigIntToLong(this.proMessageBitset),
      proof: {
        expireAtMs: expiryMs,
        genIndexHash: from_base64(genIndexHashB64, base64_variants.ORIGINAL),
        rotatingPublicKey: from_hex(rotatingPubkeyHex),
        version,
        sig: from_hex(signatureHex),
      },
    });
  }
}

export type WithOutgoingProMessageDetails = {
  outgoingProMessageDetails: OutgoingProMessageDetails | null;
};
