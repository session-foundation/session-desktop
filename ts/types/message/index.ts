import Long from 'long';
import type { ProfilePicture } from 'libsession_util_nodejs';
import { from_hex, to_hex } from 'libsodium-wrappers-sumo';
import { isEmpty, isString, isTypedArray } from 'lodash';
import { MessageAttributes } from '../../models/messageType';
import { SignalService } from '../../protobuf';
import { Timestamp } from '../timestamp/timestamp';
import { addProfileKeyToUrl, extractDetailsFromUrlFragment } from '../../session/url';

// Note: this removes the profile key from the url on purpose,
// as we do not want to share this design with the other platforms
// (and we do not want to send it as part of the URL).
function extractPicDetailsFromUrl(src: string | null): ProfilePicture {
  if (!src || !URL.canParse(src)) {
    return { url: null, key: null };
  }
  const { profileKey: key, urlWithoutProfileKey } = extractDetailsFromUrlFragment(new URL(src));
  // throwing here, as if src is not empty we expect a key to be set
  if (!isEmpty(key) && !isString(key)) {
    throw new Error('extractPicDetailsFromUrl: profileKey is set but not a string');
  }
  // throwing here, as if src is not empty we expect an url to be set
  if (!isEmpty(urlWithoutProfileKey) && !isString(urlWithoutProfileKey)) {
    throw new Error('extractPicDetailsFromUrl: avatarPointer is set but not a string');
  }
  if (!urlWithoutProfileKey || !key) {
    // this shouldn't happen, but we check it anyway
    return { url: null, key: null };
  }
  return { url: urlWithoutProfileKey, key: from_hex(key) };
}

class OutgoingUserProfile {
  public readonly displayName: string;
  /**
   * The url of the avatar picture, with the profileKey as a url fragment (in hex).
   * Note: if one is missing, this will be null.
   */
  private picUrlWithProfileKey: string | null = null;
  private readonly lastProfileUpdateTs: Timestamp;

  constructor({
    displayName,
    updatedAtSeconds,
    ...args
  }: {
    displayName: string;
    updatedAtSeconds: number;
    profilePic: ProfilePicture | null;
  }) {
    if (!isString(displayName)) {
      throw new Error('displayName is not a string');
    }
    this.displayName = displayName;

    this.lastProfileUpdateTs = new Timestamp({
      value: updatedAtSeconds,
      expectedUnit: 'seconds',
    });
    this.initFromPicDetails(args.profilePic);
  }

  private initFromPicDetails(args: ProfilePicture | null) {
    if (!args) {
      this.picUrlWithProfileKey = null;
      return;
    }
    const { key: profileKeyIn, url: avatarPointer } = args;
    if (!profileKeyIn || !avatarPointer) {
      this.picUrlWithProfileKey = null;
      return;
    }
    if (profileKeyIn && !isString(profileKeyIn) && !isTypedArray(profileKeyIn)) {
      throw new Error('profileKey must be a string or a Uint8Array if set');
    }
    // check if the profileKey is a string, and if so, convert it to a Uint8Array
    const profileKey = isString(profileKeyIn) ? from_hex(profileKeyIn) : profileKeyIn;
    if (
      !profileKey ||
      isEmpty(profileKey) ||
      !isTypedArray(profileKey) ||
      !avatarPointer ||
      isEmpty(avatarPointer) ||
      !isString(avatarPointer)
    ) {
      this.picUrlWithProfileKey = null;
      return;
    }

    if (profileKey) {
      const withProfileKey = addProfileKeyToUrl(new URL(avatarPointer), to_hex(profileKey));
      this.picUrlWithProfileKey = withProfileKey.toString();
    } else {
      this.picUrlWithProfileKey = avatarPointer;
    }
  }

  /**
   * @returns the profile picture with the key in a Uint8Array format.
   * Note: this removes the profile key from the url on purpose,
   * as we do not want to share this design with the other platforms.
   */
  public toProfilePicture(): ProfilePicture {
    return extractPicDetailsFromUrl(this.picUrlWithProfileKey);
  }

  /**
   * This function is used to get the profile picture with the key in hex format.
   * Note: this removes the profile key from the url on purpose,
   * as we do not want to share this design with the other platforms.
   */
  public toHexProfilePicture() {
    const details = this.toProfilePicture();
    return { url: details.url, key: details.key ? to_hex(details.key) : null };
  }

  /**
   * This function is used to get the protobuf details that needs to be added to an outgoing message.
   * The URL of the profile picture will be stripped of the profile key if it was set on purpose, see `toProfilePicture()`.
   * The URL of the profile picture will also be stripped of the serverPk, if the fileServer used is the default one.
   */
  public toProtobufDetails(): Partial<Pick<SignalService.DataMessage, 'profile' | 'profileKey'>> {
    if (this.isEmpty()) {
      return this.emptyProtobufDetails();
    }

    const profile = new SignalService.DataMessage.LokiProfile();
    // don't set display name if it's empty
    if (this.displayName) {
      profile.displayName = this.displayName;
    }
    profile.lastProfileUpdateSeconds = this.lastProfileUpdateTs.seconds();

    const picDetails = this.toProfilePicture();
    if (picDetails.url && picDetails.key) {
      profile.profilePicture = picDetails.url;
      return { profile, profileKey: picDetails.key };
    }
    // no profileKey provided here
    return { profile };
  }

  public isEmpty(): boolean {
    return !this.displayName && !this.picUrlWithProfileKey;
  }

  private emptyProtobufDetails() {
    // Note: profileKey: undefined is not allowed by protobuf
    return { profile: undefined };
  }

  public getUpdatedAtSeconds(): number {
    return this.lastProfileUpdateTs.seconds();
  }

  public getUpdatedAtMs(): number {
    return this.lastProfileUpdateTs.ms();
  }
}

export function longOrNumberToNumber(value: number | Long): number {
  const asLong = Long.fromValue(value);
  if (asLong.greaterThan(Number.MAX_SAFE_INTEGER)) {
    throw new Error('longOrNumberToNumber: value is too big');
  }
  return asLong.toNumber();
}

type MessageResultProps = MessageAttributes & { snippet: string };

export { MessageResultProps, OutgoingUserProfile };
