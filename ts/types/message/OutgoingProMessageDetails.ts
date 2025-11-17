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
  public readonly proFeaturesBitset?: bigint;

  constructor(args: { proConfig?: ProConfig; proFeaturesBitset?: bigint }) {
    this.proConfig = args.proConfig;

    this.proFeaturesBitset = args.proFeaturesBitset || 0n;
    const mockMessageProFeatures = getDataFeatureFlag('mockMessageProFeatures');
    if (mockMessageProFeatures?.length) {
      if (mockMessageProFeatures.includes(ProMessageFeature.PRO_INCREASED_MESSAGE_LENGTH)) {
        this.proFeaturesBitset = ProFeatures.addProFeature(
          this.proFeaturesBitset,
          ProMessageFeature.PRO_INCREASED_MESSAGE_LENGTH
        );
      }
      if (mockMessageProFeatures.includes(ProMessageFeature.PRO_BADGE)) {
        this.proFeaturesBitset = ProFeatures.addProFeature(
          this.proFeaturesBitset,
          ProMessageFeature.PRO_BADGE
        );
      }
      if (mockMessageProFeatures.includes(ProMessageFeature.PRO_ANIMATED_DISPLAY_PICTURE)) {
        this.proFeaturesBitset = ProFeatures.addProFeature(
          this.proFeaturesBitset,
          ProMessageFeature.PRO_ANIMATED_DISPLAY_PICTURE
        );
      }
    }
  }

  public toProtobufDetails(): SignalService.ProMessage | null {
    if (!this.proFeaturesBitset || !this.proConfig || !this.proConfig.proProof) {
      if (!this.proFeaturesBitset && !isEmpty(this.proConfig?.proProof)) {
        window.log.debug(
          'OutgoingProMessageDetails: proof is not empty but features are so not including pro proof.'
        );
      }
      return null;
    }
    const { expiryMs, genIndexHashB64, rotatingPubkeyHex, signatureHex, version } =
      this.proConfig.proProof;

    return new SignalService.ProMessage({
      features: bigIntToLong(this.proFeaturesBitset),
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
