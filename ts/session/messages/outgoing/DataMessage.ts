import { SignalService } from '../../../protobuf';
import { ExpirableMessageNoProfile, ExpirableMessageWithProfile } from './ExpirableMessage';

export abstract class DataMessageNoProfile extends ExpirableMessageNoProfile {
  public override contentProto(): SignalService.Content {
    const content = super.makeDisappearingContentProto();
    content.dataMessage = this.dataProto();

    return content;
  }

  public abstract dataProto(): SignalService.DataMessage;

  protected makeDataProtoNoProfile(): SignalService.DataMessage {
    const dataMessage = new SignalService.DataMessage({});

    return dataMessage;
  }
}

export abstract class DataMessageWithProfile extends ExpirableMessageWithProfile {
  public override contentProto(): SignalService.Content {
    const content = super.makeDisappearingContentProto();
    content.dataMessage = this.dataProto();

    return content;
  }

  public abstract dataProto(): SignalService.DataMessage;

  protected makeDataProtoWithProfile(): SignalService.DataMessage {
    const dataMessage = new SignalService.DataMessage({});
    const { profile, profileKey } = this.lokiProfileProto();

    if (profile && profileKey) {
      dataMessage.profile = profile;
      dataMessage.profileKey = profileKey;
    } else if (profile?.displayName) {
      dataMessage.profile = profile;
    }

    return dataMessage;
  }
}
