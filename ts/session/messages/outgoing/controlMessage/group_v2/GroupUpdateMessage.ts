import { GroupPubkeyType } from 'libsession_util_nodejs';
import { LibSodiumWrappers } from '../../../../crypto';
import { DataMessageNoProfile, DataMessageWithProfile } from '../../DataMessage';
import { ExpirableMessageParams } from '../../ExpirableMessage';
import type { WithProMessageDetailsOrProto } from '../../visibleMessage/VisibleMessage';
import type { WithOutgoingUserProfile } from '../../Message';

export type AdminSigDetails = {
  secretKey: Uint8Array;
  sodium: LibSodiumWrappers;
};

export type GroupUpdateMessageParams = ExpirableMessageParams & {
  groupPk: GroupPubkeyType;
};

export abstract class GroupUpdateMessageNoProfile extends DataMessageNoProfile {
  public readonly destination: GroupUpdateMessageParams['groupPk'];

  constructor(params: GroupUpdateMessageParams) {
    super(params);

    this.destination = params.groupPk;
    if (!this.destination || this.destination.length === 0) {
      throw new Error('destination must be set to the groupPubkey');
    }
  }
}

export abstract class GroupUpdateMessageWithProfile extends DataMessageWithProfile {
  public readonly destination: GroupUpdateMessageParams['groupPk'];

  constructor(
    params: GroupUpdateMessageParams & WithOutgoingUserProfile & WithProMessageDetailsOrProto
  ) {
    super(params);

    this.destination = params.groupPk;
    if (!this.destination || this.destination.length === 0) {
      throw new Error('destination must be set to the groupPubkey');
    }
  }
}
