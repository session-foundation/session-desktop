import type { DecodedPro } from 'libsession_util_nodejs';
import { isNil } from 'lodash';
import { ProRevocationCache } from '../session/revocation_list/pro_revocation_list';

type DecodedProConstructorArgs = {
  id: string;
  source: string;
  senderIdentity: string;
  contentDecrypted: Uint8Array;
  receivedAtMs: number;
  sentAtMs: number;
  decodedPro: DecodedPro | null;
  messageHash: string;
  messageExpirationFromRetrieve: number | null;
};

export abstract class BaseDecodedEnvelope {
  /**
   * A generated id for this envelope (usually a v4 uuid)
   */
  public readonly id: string;

  /**
   * The server id of the message. Only valid for sogs messages
   */
  public readonly serverId: number | null = null;

  /**
   * The source of the message. For 1o1 messages, this is the sender's pubkey. For groups, this is the group's pubkey.
   */
  public readonly source: string;

  /**
   * Sender's pubkey after it's been decrypted (for groups only)
   */
  public readonly senderIdentity: string;

  /**
   * Timestamp of when this message was received (milliseconds since epoch)
   */
  public readonly receivedAtMs: number;

  /**
   * Timestamp of when this message was sent (milliseconds since epoch)
   */
  public readonly sentAtMs: number;

  public readonly contentDecrypted: Uint8Array;

  public readonly validPro: DecodedPro | null;

  /**
   * Sogs messages have no messageHash, but we still need to set it to '' for the receiving pipeline to play nice
   */
  public readonly messageHash: string;

  /**
   * The message expiration from the retrieve request itself (milliseconds since epoch)
   */
  public readonly messageExpirationFromRetrieve: number | null;

  constructor(args: DecodedProConstructorArgs) {
    this.id = args.id;
    this.source = args.source;
    this.senderIdentity = args.senderIdentity;
    this.contentDecrypted = args.contentDecrypted;
    this.receivedAtMs = args.receivedAtMs;
    this.sentAtMs = args.sentAtMs;
    this.messageHash = args.messageHash;
    this.messageExpirationFromRetrieve = args.messageExpirationFromRetrieve;

    // we only want to set this if the pro proof has been confirmed valid
    // Note: this does not validate the expiry of the proof (or revoked), it only validates that the signature is valid.
    // Use this isProProof... methods for that
    this.validPro = args.decodedPro?.proStatus === 'ValidOrExpired' ? args.decodedPro : null;
  }

  public getAuthor() {
    return this.senderIdentity || this.source;
  }

  /**
   * Return true if the pro proof is set and is valid or expired at the given timestamp.
   * Warning: this does not check for a revoked proof as we do not always want to ignore a revoked change.
   */
  public isProProofValidOrExpired() {
    if (!this.validPro) {
      return false;
    }

    return this.validPro.proStatus === 'ValidOrExpired';
  }

  /**
   * Return true if the pro proof is set and is valid or expired at the given timestamp.
   * Note: you should use the NetworkTime as timestampMs here (unless you check against a message timestamp)
   * Warning: this does not check for a revoked proof as we do not always want to ignore a revoked change.
   */
  public isProProofExpiredAtMs(timestampMs: number) {
    if (!this.validPro) {
      return false;
    }
    return this.validPro.proProof.expiryMs < timestampMs;
  }

  /**
   * Returns true if there is a pro proof that is marked as revoked.
   * Note: this does not check for pro proof validity/expiry. Use `isProProofValidAtMs` for that.
   */
  public isProProofRevoked() {
    if (!this.validPro) {
      return false;
    }
    const alreadyRevoked = ProRevocationCache.isB64HashRevoked(
      this.validPro.proProof.genIndexHashB64
    );

    return alreadyRevoked;
  }
}

export class SwarmDecodedEnvelope extends BaseDecodedEnvelope {}

export class SogsDecodedEnvelope extends BaseDecodedEnvelope {
  /**
   * The server id of the message. Only valid for sogs messages
   */
  public readonly serverId: number;

  constructor(
    args: DecodedProConstructorArgs & {
      serverId: number;
    }
  ) {
    super(args);

    if (isNil(args.serverId)) {
      throw new Error('serverId cannot be null for sogs messages');
    }
    this.serverId = args.serverId;
  }
}
