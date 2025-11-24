import { isEmpty, isEqual, isNil, isString } from 'lodash';
import { to_hex } from 'libsodium-wrappers-sumo';
import type {
  ContactInfoGet,
  ConvoInfoVolatileGet1o1,
  DecodedPro,
  GroupMemberGet,
} from 'libsession_util_nodejs';

import type { ConversationModel } from './conversation';
import type {
  WithAvatarPathAndFallback,
  WithAvatarPointerProfileKey,
} from './conversationAttributes';
import { ed25519Str } from '../session/utils/String';
import { Timestamp } from '../types/timestamp/timestamp';
import { privateSet, privateSetKey } from './modelFriends';
import type { SignalService } from '../protobuf';
import { UserConfigWrapperActions } from '../webworker/workers/browser/libsession_worker_interface';

type SessionProfileArgs = {
  displayName: string;
  profileUpdatedAtSeconds: number;
  convo: ConversationModel;
};

type SetSessionProfileReturn = {
  nameChanged: boolean;
  avatarChanged: boolean;
  avatarNeedsDownload: boolean;
  proDetailsChanged: boolean;
};

type WithConvo = { convo: SessionProfileArgs['convo'] };
type WithProfileUpdatedAtSeconds = {
  profileUpdatedAtSeconds: SessionProfileArgs['profileUpdatedAtSeconds'];
};

type WithOptionalName = {
  displayName: string | undefined | null;
};

type ProDetailsContact = {
  proGenIndexHashB64: string | null;
  proExpiryTsMs: number | null;
  bitsetProFeatures: bigint | string | null;
};

type WithProDetailsContact = { proDetails: ProDetailsContact };

abstract class SessionProfileChanges {
  protected readonly convo: ConversationModel;
  protected readonly displayName: WithOptionalName['displayName'];

  public abstract applyChangesIfNeeded(): Promise<SetSessionProfileReturn>;

  constructor(
    args: WithConvo & {
      displayName: string | undefined | null;
    }
  ) {
    this.convo = args.convo;
    this.displayName = args.displayName;
  }

  public getConvoId() {
    return this.convo.id;
  }

  public getDisplayName() {
    return this.displayName;
  }

  protected assertConvoIsPrivate(identifier: string) {
    if (!this.convo.isPrivate()) {
      throw new Error(`${identifier}: expected a private conversations`);
    }
  }

  protected assertConvoIsGroupV2OrCommunity(identifier: string) {
    if (!this.convo.isClosedGroupV2() && !this.convo.isPublic()) {
      throw new Error(`${identifier}: expected a group v2 conversations or a community`);
    }
  }

  protected assertConvoIsGroupV2(identifier: string) {
    if (!this.convo.isClosedGroupV2()) {
      throw new Error(`${identifier}: expected a group v2 conversations`);
    }
  }

  protected shouldApplyChange(newProfileUpdatedAtSeconds: number | null) {
    if (isNil(newProfileUpdatedAtSeconds)) {
      // `null` is not an option to construct the subclasses of this class.
      // So we use `null` to mean `profileUpdatedAtSeconds` does not apply to the subclass calling this.
      // For instance, groups and communities do not need to check the profileUpdatedAtSeconds.
      return true;
    }
    if (!this.convo.isPrivate()) {
      // for non private shouldApplyChange calls, we do not need to check the profileUpdatedAtSeconds

      return true;
    }
    const currentProfileUpdatedAtSeconds = this.convo.getProfileUpdatedSeconds();
    // For the transition period, we need to allow an incoming profile to be applied when
    // the timestamp is not set (defaults to 0).
    if (newProfileUpdatedAtSeconds === 0 && currentProfileUpdatedAtSeconds === 0) {
      window.log.debug(
        `shouldApplyChange for ${ed25519Str(this.convo.id)} incomingSeconds:0 currentSeconds:0. Allowing overwrite`
      );
      return true;
    }

    const ts = new Timestamp({ value: newProfileUpdatedAtSeconds });
    window.log.debug(
      `shouldApplyChange for ${ed25519Str(this.convo.id)} incomingSeconds:${ts.seconds()} currentSeconds:${currentProfileUpdatedAtSeconds} -> ${currentProfileUpdatedAtSeconds < ts.seconds()}`
    );

    return currentProfileUpdatedAtSeconds < ts.seconds();
  }

  protected applyNameChange(newProfileUpdatedAtSeconds: number | null) {
    let nameChanged = false;
    if (!this.shouldApplyChange(newProfileUpdatedAtSeconds)) {
      return { nameChanged };
    }
    const existingSessionName = this.convo.getRealSessionUsername();

    if (this.displayName && this.displayName !== existingSessionName) {
      this.convo[privateSet]({
        displayNameInProfile: this.displayName,
      });

      nameChanged = true;
    }
    return { nameChanged };
  }

  protected applyUpdateAtChanges(newProfileUpdatedAtSeconds: number | null) {
    let updatedAtChanged = false;
    if (!this.shouldApplyChange(newProfileUpdatedAtSeconds)) {
      return { updatedAtChanged };
    }

    this.convo[privateSet]({
      profileUpdatedSeconds: newProfileUpdatedAtSeconds ?? undefined,
    });
    updatedAtChanged = true;

    return { updatedAtChanged };
  }

  protected applyResetAvatarChanges(newProfileUpdatedAtSeconds: number | null) {
    let avatarChanged = false;
    if (!this.shouldApplyChange(newProfileUpdatedAtSeconds)) {
      return { avatarChanged };
    }
    if (
      this.convo.getAvatarInProfilePath() ||
      this.convo.getFallbackAvatarInProfilePath() ||
      this.convo.getAvatarPointer() ||
      this.convo.getProfileKeyHex()
    ) {
      this.convo[privateSet]({
        avatarInProfile: undefined,
        avatarPointer: undefined,
        profileKey: undefined,
        fallbackAvatarInProfile: undefined,
      });
    }

    avatarChanged = true;

    return { avatarChanged };
  }

  protected applyProDetailsChange(
    { bitsetProFeatures, proExpiryTsMs, proGenIndexHashB64 }: ProDetailsContact,
    newProfileUpdatedAtSeconds: number | null
  ) {
    let proDetailsChanged = false;
    if (!this.shouldApplyChange(newProfileUpdatedAtSeconds)) {
      return { proDetailsChanged };
    }

    if (this.convo.isMe()) {
      // We don't want to set the pro details of ourself,
      // as we can just use the ones provided from libsession directly.
      return {
        proDetailsChanged: false,
      };
    }
    if (
      !isNil(bitsetProFeatures) &&
      this.convo.get('bitsetProFeatures') !== bitsetProFeatures.toString()
    ) {
      this.convo[privateSetKey]('bitsetProFeatures', bitsetProFeatures.toString());
      proDetailsChanged = true;
    }
    if (!isNil(proGenIndexHashB64) && this.convo.get('proGenIndexHashB64') !== proGenIndexHashB64) {
      this.convo[privateSetKey]('proGenIndexHashB64', proGenIndexHashB64);
      proDetailsChanged = true;
    }
    if (!isNil(proExpiryTsMs) && this.convo.get('proExpiryTsMs') !== proExpiryTsMs) {
      this.convo[privateSetKey]('proExpiryTsMs', proExpiryTsMs);
      proDetailsChanged = true;
    }

    proDetailsChanged = true;

    return { proDetailsChanged };
  }

  protected applySetAvatarBeforeDownloadChanges(
    args: WithAvatarPointerProfileKey,
    newProfileUpdatedAtSeconds: number | null
  ): Pick<SetSessionProfileReturn, 'avatarNeedsDownload' | 'avatarChanged'> {
    if (!this.shouldApplyChange(newProfileUpdatedAtSeconds)) {
      return { avatarNeedsDownload: false, avatarChanged: false };
    }
    const newProfileKeyHex = isString(args.profileKey) ? args.profileKey : to_hex(args.profileKey);

    const existingAvatarPointer = this.convo.getAvatarPointer();
    const existingProfileKeyHex = this.convo.getProfileKeyHex();
    const hasAvatarInNewProfile = !!args.avatarPointer || !!newProfileKeyHex;
    // if no changes are needed, return early
    if (
      isEqual(existingAvatarPointer, args.avatarPointer) &&
      isEqual(existingProfileKeyHex, newProfileKeyHex)
    ) {
      return { avatarNeedsDownload: false, avatarChanged: false };
    }
    this.convo[privateSet]({ avatarPointer: args.avatarPointer, profileKey: newProfileKeyHex });

    return { avatarNeedsDownload: hasAvatarInNewProfile, avatarChanged: true };
  }

  protected applySetAvatarDownloadedChanges(
    args: WithAvatarPointerProfileKey & WithAvatarPathAndFallback
  ): Pick<SetSessionProfileReturn, 'avatarChanged'> {
    // Note: this function does not need the `profileUpdatedAtSeconds` logic for any types of convo
    const newProfileKeyHex = isString(args.profileKey) ? args.profileKey : to_hex(args.profileKey);

    const existingAvatarPointer = this.convo.getAvatarPointer();
    const existingProfileKeyHex = this.convo.getProfileKeyHex();
    const originalAvatar = this.convo.getAvatarInProfilePath();
    const originalFallbackAvatar = this.convo.getFallbackAvatarInProfilePath();

    // if no changes are needed, return early
    if (
      isEqual(originalAvatar, args.avatarPath) &&
      isEqual(originalFallbackAvatar, args.fallbackAvatarPath) &&
      isEqual(existingAvatarPointer, args.avatarPointer) &&
      isEqual(existingProfileKeyHex, newProfileKeyHex)
    ) {
      return { avatarChanged: false };
    }
    // Avatar has changed, but we are only dealing with the downloaded part of it here.
    // Hence why we do not deal with the profileUpdatedAtSeconds here.

    this.convo[privateSet]({
      avatarPointer: args.avatarPointer,
      avatarInProfile: args.avatarPath,
      fallbackAvatarInProfile: args.fallbackAvatarPath,
      profileKey: newProfileKeyHex,
    });
    return { avatarChanged: true };
  }
}

/**
 * Set the display name of a private conversation.
 */
export class SessionDisplayNameOnlyPrivate extends SessionProfileChanges {
  private readonly profileUpdatedAtSeconds: WithProfileUpdatedAtSeconds['profileUpdatedAtSeconds'];

  constructor(
    args: WithConvo &
      WithProfileUpdatedAtSeconds & {
        /**
         * As part of `SessionDisplayNameOnlyPrivate`, we do require the name to be set,
         * so we cannot reuse `WithOptionalName` as is here
         */
        displayName: NonNullable<WithOptionalName['displayName']>;
      }
  ) {
    super(args);
    this.assertConvoIsPrivate('SessionDisplayNameOnlyPrivate');

    this.profileUpdatedAtSeconds = args.profileUpdatedAtSeconds;
  }

  async applyChangesIfNeeded(): Promise<SetSessionProfileReturn> {
    const { nameChanged } = this.applyNameChange(this.profileUpdatedAtSeconds);
    if (nameChanged) {
      this.applyUpdateAtChanges(this.profileUpdatedAtSeconds);
      await this.convo.commit();
    }

    return {
      nameChanged,
      avatarNeedsDownload: false,
      avatarChanged: false,
      // Note: SessionDisplayNameOnlyPrivate is currently only used for our NTS convo and we don't keep
      // the pro details here in that case.
      proDetailsChanged: false,
    };
  }
}

/**
 * Reset the avatar of a private conversation.
 * This is the only reset case where we need the `profileUpdatedAtSeconds`.
 */
export class SessionProfileResetAvatarPrivate extends SessionProfileChanges {
  private readonly profileUpdatedAtSeconds: WithProfileUpdatedAtSeconds['profileUpdatedAtSeconds'];
  private readonly proDetails: ProDetailsContact;

  constructor(
    args: WithConvo & WithProfileUpdatedAtSeconds & WithOptionalName & WithProDetailsContact
  ) {
    super(args);
    this.assertConvoIsPrivate('SessionProfileResetAvatarPrivate');

    this.profileUpdatedAtSeconds = args.profileUpdatedAtSeconds;
    this.proDetails = args.proDetails;
  }

  async applyChangesIfNeeded(): Promise<SetSessionProfileReturn> {
    const { nameChanged } = this.applyNameChange(this.profileUpdatedAtSeconds);
    const { avatarChanged } = this.applyResetAvatarChanges(this.profileUpdatedAtSeconds);
    const { proDetailsChanged } = this.applyProDetailsChange(
      this.proDetails,
      this.profileUpdatedAtSeconds
    );
    if (avatarChanged || nameChanged || proDetailsChanged) {
      this.applyUpdateAtChanges(this.profileUpdatedAtSeconds);
      await this.convo.commit();
    }

    return {
      nameChanged,
      avatarNeedsDownload: false,
      avatarChanged,
      proDetailsChanged,
    };
  }
}

/**
 * Reset the avatar of a group or community conversation.
 * We do not need the `profileUpdatedAtSeconds` here.
 */
export class SessionProfileResetAvatarGroupCommunity extends SessionProfileChanges {
  constructor(args: WithConvo & WithOptionalName) {
    super(args);
    this.assertConvoIsGroupV2OrCommunity('SessionProfileResetAvatarGroupCommunity');
  }

  async applyChangesIfNeeded(): Promise<SetSessionProfileReturn> {
    const { nameChanged } = this.applyNameChange(null);

    const { avatarChanged } = this.applyResetAvatarChanges(null);
    if (avatarChanged || nameChanged) {
      this.applyUpdateAtChanges(null);
      await this.convo.commit();
    }

    return {
      nameChanged,
      avatarChanged,
      avatarNeedsDownload: false,
      proDetailsChanged: false,
    };
  }
}

/**
 * Set the avatar of a private conversation before downloading it.
 * Note: for communities, we set & download the avatar as a single step
 */
export class SessionProfileSetAvatarBeforeDownloadPrivate extends SessionProfileChanges {
  private readonly profileUpdatedAtSeconds: WithProfileUpdatedAtSeconds['profileUpdatedAtSeconds'];
  private readonly extraArgs: WithAvatarPointerProfileKey & WithProDetailsContact;

  constructor(
    args: WithConvo &
      WithOptionalName &
      WithProfileUpdatedAtSeconds &
      WithAvatarPointerProfileKey &
      WithProDetailsContact
  ) {
    super(args);

    this.assertConvoIsPrivate('SessionProfileSetAvatarBeforeDownloadPrivate');
    this.profileUpdatedAtSeconds = args.profileUpdatedAtSeconds;
    this.extraArgs = args;
  }

  async applyChangesIfNeeded(): Promise<SetSessionProfileReturn> {
    const { nameChanged } = this.applyNameChange(this.profileUpdatedAtSeconds);

    const { avatarNeedsDownload, avatarChanged } = this.applySetAvatarBeforeDownloadChanges(
      this.extraArgs,
      this.profileUpdatedAtSeconds
    );
    const { proDetailsChanged } = this.applyProDetailsChange(
      this.extraArgs.proDetails,
      this.profileUpdatedAtSeconds
    );
    if (avatarNeedsDownload || avatarChanged || nameChanged || proDetailsChanged) {
      this.applyUpdateAtChanges(this.profileUpdatedAtSeconds);
      await this.convo.commit();
    }

    return {
      nameChanged,
      avatarNeedsDownload,
      avatarChanged,
      proDetailsChanged,
    };
  }
}

/**
 * Set the avatar of a group conversation before downloading it.
 * This one doesn't need the profileUpdatedAtSeconds.
 */
export class SessionProfileSetAvatarBeforeDownloadGroup extends SessionProfileChanges {
  private readonly extraArgs: WithAvatarPointerProfileKey;

  constructor(args: WithConvo & WithOptionalName & WithAvatarPointerProfileKey) {
    super(args);
    this.assertConvoIsGroupV2('SessionProfileSetAvatarBeforeDownloadGroup');
    this.extraArgs = args;
  }

  async applyChangesIfNeeded(): Promise<SetSessionProfileReturn> {
    const { nameChanged } = this.applyNameChange(null);

    const { avatarNeedsDownload, avatarChanged } = this.applySetAvatarBeforeDownloadChanges(
      this.extraArgs,
      null // group have no updatedAtSeconds logic
    );
    if (avatarNeedsDownload || avatarChanged || nameChanged) {
      this.applyUpdateAtChanges(null);
      await this.convo.commit();
    }

    return {
      nameChanged,
      avatarNeedsDownload,
      avatarChanged,
      proDetailsChanged: false,
    };
  }
}

/**
 * Set the avatar of a group conversation before downloading it.
 * This one doesn't need the profileUpdatedAtSeconds.
 */
export class SessionProfileSetAvatarDownloadedAny extends SessionProfileChanges {
  private readonly extraArgs: WithAvatarPointerProfileKey & WithAvatarPathAndFallback;

  constructor(
    args: WithConvo & WithAvatarPointerProfileKey & WithAvatarPathAndFallback & WithOptionalName
  ) {
    super(args);
    // No validate of the convo type here, as we support this change for any type of convo.
    this.extraArgs = args;
  }

  async applyChangesIfNeeded(): Promise<SetSessionProfileReturn> {
    const { nameChanged } = this.applyNameChange(null);

    const { avatarChanged } = this.applySetAvatarDownloadedChanges(this.extraArgs);
    if (avatarChanged || nameChanged) {
      this.applyUpdateAtChanges(null);
      await this.convo.commit();
    }

    return {
      nameChanged,
      avatarNeedsDownload: false,
      avatarChanged,
      proDetailsChanged: false,
    };
  }
}

/**
 * Build a private profile change from a message request response & pro details.
 */
export function buildPrivateProfileChangeFromMsgRequestResponse({
  convo,
  messageRequestResponse,
  decodedPro,
}: WithConvo & {
  messageRequestResponse: SignalService.MessageRequestResponse;
  decodedPro: DecodedPro | null;
}) {
  if (isEmpty(messageRequestResponse.profile)) {
    return null;
  }
  const shared = {
    convo,
    displayName: messageRequestResponse.profile.displayName,
    profileUpdatedAtSeconds: new Timestamp({
      value: messageRequestResponse.profile.lastProfileUpdateSeconds ?? 0,
    }).seconds(),
    proDetails: {
      bitsetProFeatures: decodedPro?.proFeaturesBitset ?? null,
      proExpiryTsMs: decodedPro?.proProof.expiryMs ?? null,
      proGenIndexHashB64: decodedPro?.proProof.genIndexHashB64 ?? null,
    },
  };
  if (messageRequestResponse.profileKey && messageRequestResponse.profile.profilePicture) {
    return new SessionProfileSetAvatarBeforeDownloadPrivate({
      profileKey: messageRequestResponse.profileKey,
      avatarPointer: messageRequestResponse.profile.profilePicture,
      ...shared,
    });
  }
  return new SessionProfileResetAvatarPrivate(shared);
}

export function buildPrivateProfileChangeFromMetaGroupMember({
  convo,
  member,
}: WithConvo & {
  member: GroupMemberGet;
}) {
  const shared = {
    convo,
    displayName: member.name,
    profileUpdatedAtSeconds: member.profileUpdatedSeconds,
    proDetails: {
      // Pass null to the fields so we don't overwrite them.
      bitsetProFeatures: null, // The member object has no pro details.
      proExpiryTsMs: null, // The member object has no pro details.
      proGenIndexHashB64: null, // The member object has no pro details.
    },
  };
  if (member.profilePicture?.url && member.profilePicture?.key) {
    return new SessionProfileSetAvatarBeforeDownloadPrivate({
      avatarPointer: member.profilePicture.url,
      profileKey: member.profilePicture.key,
      ...shared,
    });
  }

  return new SessionProfileResetAvatarPrivate(shared);
}

export function buildPrivateProfileChangeFromContactUpdate({
  contact,
  convo,
  convoVolatileDetails,
}: WithConvo & {
  contact: ContactInfoGet;
  convoVolatileDetails: ConvoInfoVolatileGet1o1 | null;
}) {
  const shared = {
    convo,
    displayName: contact.name,
    profileUpdatedAtSeconds: contact.profileUpdatedSeconds,
    proDetails: {
      bitsetProFeatures: contact?.profileProFeatures ?? null,
      proExpiryTsMs: convoVolatileDetails?.proExpiryTsMs ?? null,
      proGenIndexHashB64: convoVolatileDetails?.genIndexHashB64 ?? null,
    },
  };
  if (contact.profilePicture?.url && contact.profilePicture?.key) {
    return new SessionProfileSetAvatarBeforeDownloadPrivate({
      profileKey: contact.profilePicture?.key,
      avatarPointer: contact.profilePicture?.url,
      ...shared,
    });
  }
  return new SessionProfileResetAvatarPrivate(shared);
}

export function buildPrivateProfileChangeFromSwarmDataMessage({
  dataMessage,
  decodedPro,
  convo,
}: WithConvo & {
  dataMessage: SignalService.DataMessage;
  decodedPro: DecodedPro | null;
}) {
  if (!dataMessage.profile || isEmpty(dataMessage.profile)) {
    return null;
  }
  const shared = {
    convo,
    displayName: dataMessage.profile.displayName,
    profileUpdatedAtSeconds: new Timestamp({
      value: dataMessage.profile.lastProfileUpdateSeconds ?? 0,
    }).seconds(),
    proDetails: {
      bitsetProFeatures: decodedPro?.proFeaturesBitset ?? null,
      proExpiryTsMs: decodedPro?.proProof.expiryMs ?? null,
      proGenIndexHashB64: decodedPro?.proProof.genIndexHashB64 ?? null,
    },
  };

  return dataMessage.profileKey && dataMessage.profile.profilePicture
    ? new SessionProfileSetAvatarBeforeDownloadPrivate({
        profileKey: dataMessage.profileKey,
        avatarPointer: dataMessage.profile.profilePicture,
        ...shared,
      })
    : new SessionProfileResetAvatarPrivate({
        ...shared,
      });
}

export async function buildPrivateProfileChangeFromUserProfileUpdate(ourConvo: ConversationModel) {
  const profilePic = await UserConfigWrapperActions.getProfilePic();
  const displayName = await UserConfigWrapperActions.getName();
  const profileUpdatedAtSeconds = await UserConfigWrapperActions.getProfileUpdatedSeconds();

  const shared = {
    convo: ourConvo,
    displayName,
    profileUpdatedAtSeconds,
    proDetails: {
      bitsetProFeatures: null, // NTS case, we don't care about those
      proExpiryTsMs: null, // NTS case, we don't care about those
      proGenIndexHashB64: null, // NTS case, we don't care about those
    },
  };
  return profilePic.url && profilePic.key
    ? new SessionProfileSetAvatarBeforeDownloadPrivate({
        profileKey: profilePic.key,
        avatarPointer: profilePic.url,
        ...shared,
      })
    : new SessionProfileResetAvatarPrivate(shared);
}

export type SessionProfilePrivateChange =
  | SessionDisplayNameOnlyPrivate
  | SessionProfileSetAvatarBeforeDownloadPrivate
  | SessionProfileResetAvatarPrivate
  | SessionProfileSetAvatarDownloadedAny;
