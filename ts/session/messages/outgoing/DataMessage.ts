import { SignalService } from '../../../protobuf';
import { ExpirableMessage } from './ExpirableMessage';

export abstract class DataMessage extends ExpirableMessage {
  public contentProto(): SignalService.Content {
    const content = super.makeDisappearingContentProto();
    content.dataMessage = this.dataProto();
    content.proMessage = this.proMessageProto();

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
