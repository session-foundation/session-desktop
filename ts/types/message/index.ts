import type { ProfilePicture } from 'libsession_util_nodejs';
import { from_hex, to_hex } from 'libsodium-wrappers-sumo';
import { isEmpty, isNil, isString, isTypedArray } from 'lodash';
import { MessageAttributes } from '../../models/messageType';
import { SignalService } from '../../protobuf';
import { TimestampUtils } from '../timestamp/timestamp';

function extractPicDetailsFromUrl(src: string | null): ProfilePicture {
  if (!src) {
    return { url: null, key: null };
  }
  const urlParts = src.split('#');
  if (urlParts.length !== 2) {
    throw new Error('extractPicDetailsFromUrl url does not contain a profileKey');
  }
  const url = urlParts[0];
  const key = urlParts[1];

  // throwing here, as if src is not empty we expect a key to be set
  if (!isEmpty(key) && !isString(key)) {
    throw new Error('extractPicDetailsFromUrl: profileKey is set but not a string');
  }
  // throwing here, as if src is not empty we expect an url to be set
  if (!isEmpty(url) && !isString(url)) {
    throw new Error('extractPicDetailsFromUrl: avatarPointer is set but not a string');
  }
  if (!url || !key) {
    // this shouldn't happen, but we check it anyway
    return { url: null, key: null };
  }
  return { url, key: from_hex(key) };
}

class OutgoingUserProfile {
  public readonly displayName: string;
  /**
   * The url of the avatar picture, with the profileKey as a url fragment (in hex).
   * Note: if one is missing, this will be null.
   */
  private picUrlWithProfileKey: string | null = null;
  public readonly lastProfileUpdateMs: number | null;

  constructor({
    displayName,
    updatedAtSeconds,
    ...args
  }: {
    displayName: string;
    updatedAtSeconds: number;
  } & (
    | { picUrlWithProfileKey: string | null }
    | { profileKey: Uint8Array | string | null; avatarPointer: string | null }
  )) {
    if (!isString(displayName)) {
      throw new Error('displayName is not a string');
    }
    this.displayName = displayName;

    const ts = new TimestampUtils.Timestamp({
      value: updatedAtSeconds,
      expectedUnit: 'seconds',
    });
    // Note: we get the timestamp of last update in seconds, but need to send it in ms
    // hence the `ms()` call.
    this.lastProfileUpdateMs = ts.ms();
    if ('picUrlWithProfileKey' in args) {
      this.initFromPicWithUrl(args.picUrlWithProfileKey);
    } else {
      this.initFromPicDetails(args);
    }
  }

  private initFromPicWithUrl(picUrlWithProfileKey: string | null) {
    if (!picUrlWithProfileKey) {
      this.picUrlWithProfileKey = null;
      return;
    }
    // this throws if the url is not valid
    // or if the fields cannot be extracted
    extractPicDetailsFromUrl(picUrlWithProfileKey);

    this.picUrlWithProfileKey = picUrlWithProfileKey;
  }

  private initFromPicDetails({
    profileKey: profileKeyIn,
    avatarPointer,
  }: {
    profileKey: Uint8Array | string | null;
    avatarPointer: string | null;
  }) {
    if (!profileKeyIn && !avatarPointer) {
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
      this.picUrlWithProfileKey = `${avatarPointer}#${to_hex(profileKey)}`;
    } else {
      this.picUrlWithProfileKey = avatarPointer;
    }
  }

  public toProfilePicture(): ProfilePicture {
    return extractPicDetailsFromUrl(this.picUrlWithProfileKey);
  }

  public isEmpty(): boolean {
    return !this.displayName && !isNil(this.lastProfileUpdateMs) && !this.picUrlWithProfileKey;
  }

  private emptyProtobufDetails() {
    // Note: profileKey: undefined is not allowed by protobuf
    return { profile: undefined };
  }

  public toProtobufDetails(): Partial<Pick<SignalService.DataMessage, 'profile' | 'profileKey'>> {
    if (this.isEmpty()) {
      return this.emptyProtobufDetails();
    }

    const profile = new SignalService.DataMessage.LokiProfile();
    // don't set display name if it's empty
    if (this.displayName) {
      profile.displayName = this.displayName;
    }
    if (!isNil(this.lastProfileUpdateMs)) {
      profile.lastProfileUpdateMs = this.lastProfileUpdateMs;
    }
    const picDetails = this.toProfilePicture();
    if (picDetails.url && picDetails.key) {
      profile.profilePicture = picDetails.url;
      return { profile, profileKey: picDetails.key };
    }
    // no profileKey provided here
    return { profile };
  }
}

type MessageResultProps = MessageAttributes & { snippet: string };

export { MessageResultProps, OutgoingUserProfile };
