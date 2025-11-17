export interface Quote {
  id: number; // this is in fact a uint64 so we will have an issue
  author: string;
  attachments: Array<any> | null;
  text: string | null;
  referencedMessageNotFound: boolean;
}

export class DecodedEnvelope {
  /**
   * A generated id for this envelope (usually a v4 uuid)
   */
  public readonly id: string;

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

  /**
   * The message hash as stored on the snode.
   * Communities do not have a message hash, so this is set to ''.
   */
  public readonly messageHash: string;

  /**
   * The message expiration from the retrieve request itself (milliseconds since epoch)
   */
  public readonly messageExpirationFromRetrieve: number | null;

  constructor(args: {
    id: string;
    senderIdentity: string;
    source: string;
    contentDecrypted: Uint8Array;
    receivedAtMs: number;
    sentAtMs: number;
    messageHash: string;
    messageExpirationFromRetrieve: number | null;
  }) {
    this.id = args.id;
    this.source = args.source;
    this.senderIdentity = args.senderIdentity;
    this.contentDecrypted = args.contentDecrypted;
    this.receivedAtMs = args.receivedAtMs;
    this.sentAtMs = args.sentAtMs;
    this.messageHash = args.messageHash;
    this.messageExpirationFromRetrieve = args.messageExpirationFromRetrieve;
  }

  public getAuthor() {
    return this.senderIdentity || this.source;
  }
}
