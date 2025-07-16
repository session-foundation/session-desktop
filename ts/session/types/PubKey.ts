import { GroupPubkeyType, PubkeyType } from 'libsession_util_nodejs';
import { fromHexToArray } from '../utils/String';

export enum KeyPrefixType {
  /**
   * Used for keys which have the blinding update and aren't using blinding
   */
  unblinded = '00',
  /**
   * Used for identified users, open groups, etc
   */
  standard = '05',
  /**
   * used for participants in open groups (legacy blinding logic)
   */
  blinded15 = '15',

  /**
   * used for participants in open groups (new blinding logic)
   */
  blinded25 = '25',

  /**
   * used for participants in open groups
   */
  groupV2 = '03',
}

// TODO make that Pubkey class more useful, add fields for what types of pubkey it is (group, legacy group, private)

export class PubKey {
  public static readonly PUBKEY_LEN = 66;
  public static readonly PUBKEY_LEN_NO_PREFIX = PubKey.PUBKEY_LEN - 2;
  public static readonly PUBKEY_BYTE_COUNT = PubKey.PUBKEY_LEN / 2;
  public static readonly PUBKEY_BYTE_COUNT_NO_PREFIX = PubKey.PUBKEY_BYTE_COUNT - 1;
  public static readonly HEX = '[0-9a-fA-F]';

  // This is a temporary fix to allow groupPubkeys created from mobile to be handled correctly
  // They have a different regex to match
  // FIXME move this to a new class which validates group ids and use it in all places where we have group ids (message sending included)

  public static readonly regexForPubkeys = `(([0-1]5)?${PubKey.HEX}{${this.PUBKEY_LEN_NO_PREFIX}})`;
  public static readonly PREFIX_GROUP_TEXTSECURE = '__textsecure_group__!';
  // prettier-ignore
  private static readonly regex: RegExp = new RegExp(
    `^(${PubKey.PREFIX_GROUP_TEXTSECURE})?(${KeyPrefixType.standard}|${KeyPrefixType.blinded15}|${KeyPrefixType.blinded25}|${KeyPrefixType.unblinded}|${KeyPrefixType.groupV2})?(${PubKey.HEX}{64}|${PubKey.HEX}{${PubKey.PUBKEY_BYTE_COUNT_NO_PREFIX}})$`
  );
  /**
   * If you want to update this regex. Be sure that those are matches ;
   *  __textsecure_group__!05010203040506070809a0b0c0d0e0f0ff010203040506070809a0b0c0d0e0f0ff
   *  __textsecure_group__!05010203040506070809a0b0c0d0e0f0ff
   *  05010203040506070809a0b0c0d0e0f0ff010203040506070809a0b0c0d0e0f0ff
   *  03010203040506070809a0b0c0d0e0f0ff010203040506070809a0b0c0d0e0f0ff
   *  05010203040506070809a0b0c0d0e0f0ff
   *  030203040506070809a0b0c0d0e0f0ff
   */

  public readonly key: string;

  /**
   * A PubKey object.
   * If `pubKeyString` is not valid then this will throw an `Error`.
   *
   * @param pubkeyString The public key string.
   */
  constructor(pubkeyString: string) {
    if (!PubKey.validate(pubkeyString)) {
      throw new Error('Invalid pubkey string passed');
    }
    this.key = pubkeyString.toLowerCase();
  }

  /**
   * Cast a `value` to a `PubKey`.
   * If `value` is not valid then this will throw.
   *
   * @param value The value to cast.
   */
  public static cast(value?: string | PubKey): PubKey {
    if (!value) {
      throw new Error(`Invalid pubkey string passed: ${value}`);
    }
    return typeof value === 'string' ? new PubKey(value) : value;
  }

  public static shorten(value: string | PubKey): string {
    const valAny = value as PubKey;
    const pk = value instanceof PubKey ? valAny.key : value;
    if (!pk) {
      throw new Error('PubKey.shorten was given an invalid PubKey to shorten.');
    }

    if (pk.length < 8) {
      return pk;
    }

    return `(${pk.substring(0, 4)}...${pk.substring(pk.length - 4)})`;
  }

  /**
   * Try convert `pubKeyString` to `PubKey`.
   *
   * @param pubkeyString The public key string.
   * @returns `PubKey` if valid otherwise returns `undefined`.
   */
  public static from(pubkeyString: string): PubKey | undefined {
    // Returns a new instance if the pubkey is valid
    if (PubKey.validate(pubkeyString)) {
      return new PubKey(pubkeyString);
    }

    return undefined;
  }

  /**
   * Returns the pubkey as a string if it's valid, or undefined
   */
  public static normalize(pubkeyString: string): string | undefined {
    // Returns a new instance if the pubkey is valid
    if (PubKey.validate(pubkeyString)) {
      return pubkeyString;
    }

    return undefined;
  }

  public static validate(pubkeyString: string): boolean {
    return this.regex.test(pubkeyString);
  }

  /**
   * Returns a localized string of the error, or undefined if the given pubkey is valid.
   *
   * Note: this should be used when starting a conversation and we do not support starting conversation from scratch with a blinded sessionId.
   * So if the given pubkey has a blinded prefix, this call will fail with a localized `accountIdErrorInvalid` error
   */
  public static validateWithErrorNoBlinding(pubkey: string): string | undefined {
    // Check if it's hex
    const isHex = pubkey.replace(/[\s]*/g, '').match(/^[0-9a-fA-F]+$/);
    if (!isHex) {
      return window.i18n('accountIdErrorInvalid');
    }

    // Check if the pubkey length is 33 and leading with 05 or of length 32
    const len = pubkey.length;

    // we do not support blinded prefix, see Note above
    const isProdOrDevValid = len === PubKey.PUBKEY_LEN && /^05/.test(pubkey); // prod pubkey can have only 66 chars and the 05 only.

    // dev pubkey on testnet are now 66 chars too with the prefix, so every sessionID needs 66 chars and the prefix to be valid
    if (!isProdOrDevValid) {
      return window.i18n('accountIdErrorInvalid');
    }
    return undefined;
  }

  /**
   * @param keyWithOrWithoutPrefix Key with or without prefix
   * @returns If key is the correct length and has a supported prefix 05, 15, 25
   */
  public static isValidPrefixAndLength(keyWithOrWithoutPrefix: string): boolean {
    return (
      keyWithOrWithoutPrefix.length === 66 &&
      (keyWithOrWithoutPrefix.startsWith(KeyPrefixType.blinded15) ||
        keyWithOrWithoutPrefix.startsWith(KeyPrefixType.blinded25) ||
        keyWithOrWithoutPrefix.startsWith(KeyPrefixType.standard))
    );
  }

  /**
   * This removes the 05, 15 or 25 prefix from a Pubkey which have it and have a length of 66
   * @param keyWithOrWithoutPrefix the key with or without the prefix
   */
  public static removePrefixIfNeeded(keyWithOrWithoutPrefix: string): string {
    if (this.isValidPrefixAndLength(keyWithOrWithoutPrefix)) {
      const keyWithoutPrefix = keyWithOrWithoutPrefix.substring(2);
      return keyWithoutPrefix;
    }
    return keyWithOrWithoutPrefix;
  }

  /**
   *
   * @param key Key with the prefix included.
   * @returns The prefix
   */
  public static getPrefix(key: string): KeyPrefixType | null {
    if (this.isValidPrefixAndLength(key)) {
      return key.substring(0, 2) as KeyPrefixType;
    }
    return null;
  }

  public static isEqual(comparator1: PubKey | string, comparator2: PubKey | string) {
    return PubKey.cast(comparator1).isEqual(comparator2);
  }

  public isEqual(comparator: PubKey | string) {
    return comparator instanceof PubKey
      ? this.key === comparator.key
      : this.key === comparator.toLowerCase();
  }

  public withoutPrefix(): string {
    return PubKey.removePrefixIfNeeded(this.key);
  }

  public toArray(): Uint8Array {
    return fromHexToArray(this.key);
  }

  public static isBlinded(key: string) {
    return (
      key && (key.startsWith(KeyPrefixType.blinded15) || key.startsWith(KeyPrefixType.blinded25))
    );
  }

  // TODO we should probably move those to a libsession exported ts file
  public static is03Pubkey(key: string): key is GroupPubkeyType {
    const regex = new RegExp(`^${KeyPrefixType.groupV2}${PubKey.HEX}{64}$`);
    return regex.test(key);
  }

  public static is05Pubkey(key: string): key is PubkeyType {
    const regex = new RegExp(`^${KeyPrefixType.standard}${PubKey.HEX}{64}$`);
    return regex.test(key);
  }
}
