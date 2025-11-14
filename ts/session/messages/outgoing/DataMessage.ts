import { SignalService } from '../../../protobuf';
import { ExpirableMessage } from './ExpirableMessage';

export abstract class DataMessage extends ExpirableMessage {
  public contentProto(): SignalService.Content {
    const content = super.makeDisappearingContentProto();
    content.dataMessage = this.dataProto();
    content.proMessage = this.proMessageProto();

    // if (proMessageDetails?.proFeaturesBitset && !isEmpty(proMessageDetails.proConfig)) {
    //   // Note: we only want to set the proof if any features are used
    //   content.proMessage = new SignalService.ProMessage({
    //     features: bigIntToLong(proMessageDetails.proFeaturesBitset),
    //     proof: {
    //       expireAtMs: proMessageDetails.proConfig?.proProof.expiryMs,
    //       genIndexHash: from_base64(
    //         proMessageDetails.proConfig?.proProof.genIndexHashB64,
    //         base64_variants.ORIGINAL
    //       ),
    //       rotatingPublicKey: from_hex(proMessageDetails.proConfig?.proProof.rotatingPubkeyHex),
    //       version: proMessageDetails.proConfig?.proProof.version,
    //       sig: from_hex(proMessageDetails.proConfig?.proProof.signatureHex),
    //     },
    //   });
    // }

    return content;
  }

  public abstract dataProto(): SignalService.DataMessage;

  protected makeDataProto(): SignalService.DataMessage {
    const dataMessage = new SignalService.DataMessage({});
    const { profile, profileKey } = this.lokiProfileProto();

    if (profile && profileKey) {
      dataMessage.profile = profile;
      dataMessage.profileKey = profileKey;
    }

    return dataMessage;
  }
}
