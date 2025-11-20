import { isEqual, isNil, isString } from 'lodash';
import { to_hex } from 'libsodium-wrappers-sumo';

import type { ConversationModel } from './conversation';
import type {
  WithAvatarPathAndFallback,
  WithAvatarPointerProfileKey,
} from './conversationAttributes';
import { ed25519Str } from '../session/utils/String';
import { Timestamp } from '../types/timestamp/timestamp';
import { privateSet } from './modelFriends';

type SessionProfileArgs = {
  displayName: string;
  profileUpdatedAtSeconds: number;
  convo: ConversationModel;
};

type SetSessionProfileReturn = {
  nameChanged: boolean;
  avatarChanged: boolean;
  avatarNeedsDownload: boolean;
};

type WithConvo = { convo: SessionProfileArgs['convo'] };
type WithProfileUpdatedAtSeconds = {
  profileUpdatedAtSeconds: SessionProfileArgs['profileUpdatedAtSeconds'];
};

type WithOptionalName = {
  displayName: string | undefined | null;
};

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
      this.convo.getProfileKey()
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

  protected applySetAvatarBeforeDownloadChanges(
    args: WithAvatarPointerProfileKey,
    newProfileUpdatedAtSeconds: number | null
  ): Pick<SetSessionProfileReturn, 'avatarNeedsDownload' | 'avatarChanged'> {
    if (!this.shouldApplyChange(newProfileUpdatedAtSeconds)) {
      return { avatarNeedsDownload: false, avatarChanged: false };
    }
    const newProfileKeyHex = isString(args.profileKey) ? args.profileKey : to_hex(args.profileKey);

    const existingAvatarPointer = this.convo.getAvatarPointer();
    const existingProfileKeyHex = this.convo.getProfileKey();
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
    const existingProfileKeyHex = this.convo.getProfileKey();
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
    };
  }
}

/**
 * Reset the avatar of a private conversation.
 * This is the only reset case where we need the `profileUpdatedAtSeconds`.
 */
export class SessionProfileResetAvatarPrivate extends SessionProfileChanges {
  private readonly profileUpdatedAtSeconds: WithProfileUpdatedAtSeconds['profileUpdatedAtSeconds'];

  constructor(args: WithConvo & WithProfileUpdatedAtSeconds & WithOptionalName) {
    super(args);
    this.assertConvoIsPrivate('SessionProfileResetAvatarPrivate');

    this.profileUpdatedAtSeconds = args.profileUpdatedAtSeconds;
  }

  async applyChangesIfNeeded(): Promise<SetSessionProfileReturn> {
    const { nameChanged } = this.applyNameChange(this.profileUpdatedAtSeconds);
    const { avatarChanged } = this.applyResetAvatarChanges(this.profileUpdatedAtSeconds);
    if (avatarChanged || nameChanged) {
      this.applyUpdateAtChanges(this.profileUpdatedAtSeconds);
      await this.convo.commit();
    }
    return {
      nameChanged,
      avatarNeedsDownload: false,
      avatarChanged,
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
      avatarNeedsDownload: false,
      avatarChanged,
    };
  }
}

/**
 * Set the avatar of a private conversation before downloading it.
 * Note: for communities, we set & download the avatar as a single step
 */
export class SessionProfileSetAvatarBeforeDownloadPrivate extends SessionProfileChanges {
  private readonly profileUpdatedAtSeconds: WithProfileUpdatedAtSeconds['profileUpdatedAtSeconds'];
  private readonly extraArgs: WithAvatarPointerProfileKey;

  constructor(
    args: WithConvo & WithOptionalName & WithProfileUpdatedAtSeconds & WithAvatarPointerProfileKey
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
    if (avatarNeedsDownload || avatarChanged || nameChanged) {
      this.applyUpdateAtChanges(this.profileUpdatedAtSeconds);
      await this.convo.commit();
    }

    return {
      nameChanged,
      avatarNeedsDownload,
      avatarChanged,
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
    // No validate of the convo type here, as we support to change for any type of convo.
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
    };
  }
}
