import { base64_variants, from_base64, from_hex } from 'libsodium-wrappers-sumo';
import type { ProConfig } from 'libsession_util_nodejs';
import { SignalService } from '../../protobuf';
import { bigIntToLong } from '../Bigint';

export class OutgoingProMessageDetails {
  public readonly proConfig?: ProConfig;
  public readonly proFeaturesBitset?: bigint;

  constructor(args: { proConfig?: ProConfig; proFeaturesBitset?: bigint }) {
    this.proConfig = args.proConfig;
    this.proFeaturesBitset = args.proFeaturesBitset;
  }

  public toProtobufDetails(): SignalService.ProMessage | null {
    if (!this.proFeaturesBitset || !this.proConfig || !this.proConfig.proProof) {
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
