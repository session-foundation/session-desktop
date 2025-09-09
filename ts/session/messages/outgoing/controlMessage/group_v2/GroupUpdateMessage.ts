import { GroupPubkeyType } from 'libsession_util_nodejs';
import { LibSodiumWrappers } from '../../../../crypto';
import { DataMessage } from '../../DataMessage';
import { ExpirableMessageParams } from '../../ExpirableMessage';
import type { WithOutgoingUserProfile } from '../../Message';

export type AdminSigDetails = {
  secretKey: Uint8Array;
  sodium: LibSodiumWrappers;
};

export type GroupUpdateMessageParams = ExpirableMessageParams &
  WithOutgoingUserProfile & {
    groupPk: GroupPubkeyType;
  };

export abstract class GroupUpdateMessage extends DataMessage {
  public readonly destination: GroupUpdateMessageParams['groupPk'];
  public readonly userProfile: GroupUpdateMessageParams['userProfile'];

  constructor(params: GroupUpdateMessageParams) {
    super(params);

    this.destination = params.groupPk;
    this.userProfile = params.userProfile;
    if (!this.destination || this.destination.length === 0) {
      throw new Error('destination must be set to the groupPubkey');
    }
  }

  // do not override the dataProto here, we want it to be defined in the child classes
  // public abstract dataProto(): SignalService.DataMessage;

  public abstract isFor1o1Swarm(): boolean;
  public abstract isForGroupSwarm(): boolean;
}
