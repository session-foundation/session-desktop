import ByteBuffer from 'bytebuffer';
import { GroupPubkeyType, PubkeyType, WithGroupPubkey } from 'libsession_util_nodejs';
import { from_hex } from 'libsodium-wrappers-sumo';
import { isEmpty, isString } from 'lodash';
import { AwaitedReturn, assertUnreachable } from '../../../types/sqlSharedTypes';
import { concatUInt8Array } from '../../crypto';
import { PubKey } from '../../types';
import { StringUtils, UserUtils } from '../../utils';
import { ed25519Str } from '../../utils/String';
import {
  SnodeNamespace,
  SnodeNamespaces,
  SnodeNamespacesGroup,
  SnodeNamespacesGroupConfig,
  SnodeNamespacesUser,
  SnodeNamespacesUserConfig,
} from './namespaces';
import { GroupDetailsNeededForSignature, SnodeGroupSignature } from './signature/groupSignature';
import { SnodeSignature } from './signature/snodeSignatures';
import {
  WithMessagesHashes,
  ShortenOrExtend,
  WithShortenOrExtend,
  WithCreatedAtNetworkTimestamp,
  WithMaxSize,
  WithMethod,
  WithSecretKey,
  WithSignature,
  WithTimestamp,
  WithGetNow,
} from '../../types/with';
import { isDevProd } from '../../../shared/env_vars';

/**
 * This is the base sub request class that every other type of request has to extend.
 */
abstract class SnodeAPISubRequest<T extends string> {
  public method: T;

  public abstract loggingId(): string;
  public abstract getDestination(): PubkeyType | GroupPubkeyType | '<none>';
  public abstract build(): Promise<Record<string, unknown>>;

  public async toBody() {
    return JSON.stringify(await this.build());
  }

  constructor({ method }: WithMethod<T>) {
    this.method = method;
  }

  /**
   * When batch sending an array of requests, we will sort them by this number (the smallest will be put in front and the largest at the end).
   * This is needed for sending and polling for 03-group keys for instance.
   */

  public requestOrder() {
    return 0;
  }
}

abstract class RetrieveSubRequest extends SnodeAPISubRequest<'retrieve'> {
  public readonly last_hash: string;
  public readonly max_size: number | undefined;

  constructor({ last_hash, max_size }: WithMaxSize & { last_hash: string }) {
    super({ method: 'retrieve' });
    this.last_hash = last_hash;
    this.max_size = max_size;
  }
}

abstract class OxendSubRequest extends SnodeAPISubRequest<'oxend_request'> {
  constructor() {
    super({ method: 'oxend_request' });
  }
}

abstract class DeleteAllSubRequest extends SnodeAPISubRequest<'delete_all'> {
  constructor() {
    super({ method: 'delete_all' });
  }
}

abstract class DeleteSubRequest extends SnodeAPISubRequest<'delete'> {
  constructor() {
    super({ method: 'delete' });
  }
}

abstract class ExpireSubRequest extends SnodeAPISubRequest<'expire'> {
  constructor() {
    super({ method: 'expire' });
  }
}

abstract class StoreSubRequest extends SnodeAPISubRequest<'store'> {
  public readonly getNow: () => number;

  constructor(args: WithGetNow) {
    super({ method: 'store' });
    this.getNow = args.getNow;
  }
}

/**
 * If you are thinking of adding the `limit` field here: don't.
 * We fetch the full list because we will remove from every cached swarms the snodes not found in that fresh list.
 * If a `limit` was set, we would remove a lot of valid snodes from those cached swarms.
 */
type FetchSnodeListParams = {
  active_only: true;
  fields: {
    public_ip: true;
    storage_port: true;
    pubkey_x25519: true;
    pubkey_ed25519: true;
    storage_server_version: true;
  };
};

export type GetServicesNodesFromSeedRequest = {
  method: 'get_n_service_nodes';
  jsonrpc: '2.0';
  /**
   * If you are thinking of adding the `limit` field here: don't.
   * We fetch the full list because we will remove from every cached swarms the snodes not found in that fresh list.
   * If the limit was set, we would remove a lot of valid snodes from the swarms we've already fetched.
   */
  params: FetchSnodeListParams;
};

export class RetrieveUserSubRequest extends RetrieveSubRequest {
  public readonly namespace: SnodeNamespacesUser | SnodeNamespacesUserConfig;

  constructor({
    last_hash,
    max_size,
    namespace,
  }: WithMaxSize & {
    last_hash: string;
    namespace: SnodeNamespacesUser | SnodeNamespacesUserConfig;
  }) {
    super({ last_hash, max_size });
    this.namespace = namespace;
  }

  public async build() {
    const { pubkey, pubkey_ed25519, signature, timestamp } =
      await SnodeSignature.getSnodeSignatureParamsUs({
        method: this.method,
        namespace: this.namespace,
      });

    return {
      method: this.method,
      params: {
        namespace: this.namespace,
        pubkey,
        pubkey_ed25519,
        signature,
        timestamp, // we give a timestamp to force verification of the signature provided
        last_hash: this.last_hash,
        max_size: this.max_size,
      },
    };
  }

  public getDestination() {
    return UserUtils.getOurPubKeyStrFromCache();
  }

  public loggingId(): string {
    return `${this.method}-${SnodeNamespace.toRole(this.namespace)}`;
  }
}

/**
 * Build and sign a request with either the admin key if we have it, or with our sub account details
 */
export class RetrieveGroupSubRequest extends RetrieveSubRequest {
  public readonly namespace: SnodeNamespacesGroup;
  public readonly groupDetailsNeededForSignature: GroupDetailsNeededForSignature;

  constructor({
    last_hash,
    max_size,
    namespace,
    groupDetailsNeededForSignature,
  }: WithMaxSize & {
    last_hash: string;
    namespace: SnodeNamespacesGroup;
    groupDetailsNeededForSignature: GroupDetailsNeededForSignature | null;
  }) {
    super({ last_hash, max_size });
    this.namespace = namespace;
    if (isEmpty(groupDetailsNeededForSignature)) {
      throw new Error('groupDetailsNeededForSignature is required');
    }
    this.groupDetailsNeededForSignature = groupDetailsNeededForSignature;
  }

  public async build() {
    /**
     * This will return the signature details we can use with the admin secretKey if we have it,
     * or with the sub account details if we don't.
     * If there is no valid groupDetails, this throws
     */
    const sigResult = await SnodeGroupSignature.getSnodeGroupSignature({
      method: this.method,
      namespace: this.namespace,
      group: this.groupDetailsNeededForSignature,
    });

    return {
      method: this.method,
      params: {
        namespace: this.namespace,
        ...sigResult,
        last_hash: this.last_hash,
        max_size: this.max_size,
      },
    };
  }

  public getDestination() {
    return this.groupDetailsNeededForSignature.pubkeyHex;
  }

  public loggingId(): string {
    return `${this.method}-${SnodeNamespace.toRole(this.namespace)}`;
  }

  public override requestOrder() {
    if (this.namespace === SnodeNamespaces.ClosedGroupKeys) {
      // we want to retrieve the groups keys last
      return 10;
    }

    return super.requestOrder();
  }
}

export class OnsResolveSubRequest extends OxendSubRequest {
  public readonly base64EncodedNameHash: string;

  constructor(base64EncodedNameHash: string) {
    super();
    this.base64EncodedNameHash = base64EncodedNameHash;
  }

  public async build() {
    return {
      method: this.method,
      params: {
        endpoint: 'ons_resolve',
        params: {
          type: 0,
          name_hash: this.base64EncodedNameHash,
        },
      },
    };
  }

  public loggingId(): string {
    return `${this.method}`;
  }

  public getDestination() {
    return '<none>' as const;
  }
}

export class GetServiceNodesSubRequest extends OxendSubRequest {
  public async build() {
    return {
      method: this.method,
      params: {
        /**
         * If you are thinking of adding the `limit` field here: don't.
         * We fetch the full list because we will remove from every cached swarms the snodes not found in that fresh list.
         * If the limit was set, we would remove a lot of valid snodes from the swarms we've already fetched.
         */
        endpoint: 'get_service_nodes' as const,
        params: {
          active_only: true,
          fields: {
            public_ip: true,
            storage_port: true,
            pubkey_x25519: true,
            pubkey_ed25519: true,
          },
        },
      },
    };
  }

  public loggingId(): string {
    return `${this.method}`;
  }

  public getDestination() {
    return '<none>' as const;
  }
}

export class SwarmForSubRequest extends SnodeAPISubRequest<'get_swarm'> {
  public readonly destination;

  constructor(pubkey: PubkeyType | GroupPubkeyType) {
    super({ method: 'get_swarm' });
    this.destination = pubkey;
  }

  public async build() {
    return {
      method: this.method,
      params: {
        pubkey: this.destination,
        params: {
          active_only: true,
          fields: {
            public_ip: true,
            storage_port: true,
            pubkey_x25519: true,
            pubkey_ed25519: true,
          },
        },
      },
    } as const;
  }

  public loggingId(): string {
    return `${this.method}`;
  }

  public getDestination() {
    return this.destination;
  }
}

export class NetworkTimeSubRequest extends SnodeAPISubRequest<'info'> {
  constructor() {
    super({ method: 'info' });
  }

  public async build() {
    return {
      method: this.method,
      params: {},
    } as const;
  }

  public loggingId(): string {
    return `${this.method}`;
  }

  public getDestination() {
    return '<none>' as const;
  }
}

abstract class AbstractRevokeSubRequest<
  T extends 'revoke_subaccount' | 'unrevoke_subaccount',
> extends SnodeAPISubRequest<T> {
  public readonly destination: GroupPubkeyType;
  public readonly timestamp: number;
  public readonly tokensHex: Array<string>;
  protected readonly adminSecretKey: Uint8Array;

  constructor({
    groupPk,
    timestamp,
    tokensHex,
    secretKey,
    method,
  }: WithGroupPubkey & WithTimestamp & WithSecretKey & { tokensHex: Array<string>; method: T }) {
    super({ method });
    this.destination = groupPk;
    this.timestamp = timestamp;
    this.tokensHex = tokensHex;
    this.adminSecretKey = secretKey;
    if (this.tokensHex.length === 0) {
      throw new Error('AbstractRevokeSubRequest needs at least one token to do a change');
    }
  }

  public async signWithAdminSecretKey() {
    if (!this.adminSecretKey) {
      throw new Error('we need an admin secretKey');
    }
    const tokensBytes = from_hex(this.tokensHex.join(''));

    const prefix = new Uint8Array(StringUtils.encode(`${this.method}${this.timestamp}`, 'utf8'));
    const sigResult = await SnodeGroupSignature.signDataWithAdminSecret(
      concatUInt8Array(prefix, tokensBytes),
      { secretKey: this.adminSecretKey }
    );

    return sigResult.signature;
  }

  public loggingId(): string {
    return `${this.method}-${ed25519Str(this.destination)}`;
  }

  public getDestination() {
    return this.destination;
  }
}

export class SubaccountRevokeSubRequest extends AbstractRevokeSubRequest<'revoke_subaccount'> {
  constructor(args: Omit<ConstructorParameters<typeof AbstractRevokeSubRequest>[0], 'method'>) {
    super({ method: 'revoke_subaccount', ...args });
  }

  public async build() {
    const signature = await this.signWithAdminSecretKey();
    return {
      method: this.method,
      params: {
        pubkey: this.destination,
        signature,
        revoke: this.tokensHex,
        timestamp: this.timestamp,
      },
    };
  }
}

export class SubaccountUnrevokeSubRequest extends AbstractRevokeSubRequest<'unrevoke_subaccount'> {
  constructor(args: Omit<ConstructorParameters<typeof AbstractRevokeSubRequest>[0], 'method'>) {
    super({ method: 'unrevoke_subaccount', ...args });
  }
  /**
   * For Revoke/unrevoke, this needs an admin signature
   */
  public async build() {
    const signature = await this.signWithAdminSecretKey();

    return {
      method: this.method,
      params: {
        pubkey: this.destination,
        signature,
        unrevoke: this.tokensHex,
        timestamp: this.timestamp,
      },
    };
  }

  public getDestination() {
    return this.destination;
  }
}

/**
 * The getExpiries request can currently only be used for our own pubkey as we use it to fetch
 * the expiries updated by another of our devices.
 */
export class GetExpiriesFromNodeSubRequest extends SnodeAPISubRequest<'get_expiries'> {
  public readonly messageHashes: Array<string>;
  public readonly getNow: () => number;

  constructor(args: WithMessagesHashes & WithGetNow) {
    super({ method: 'get_expiries' });
    this.getNow = args.getNow;

    this.messageHashes = args.messagesHashes;
    if (this.messageHashes.length === 0) {
      window.log.warn(`GetExpiriesFromNodeSubRequest given empty list of messageHashes`);
      throw new Error('GetExpiriesFromNodeSubRequest given empty list of messageHashes');
    }
  }
  /**
   * For Revoke/unrevoke, this needs an admin signature
   */
  public async build() {
    const timestamp = this.getNow();

    const ourPubKey = UserUtils.getOurPubKeyStrFromCache();
    if (!ourPubKey) {
      throw new Error('[GetExpiriesFromNodeSubRequest] No pubkey found');
    }
    const signResult = await SnodeSignature.generateGetExpiriesOurSignature({
      timestamp,
      messageHashes: this.messageHashes,
    });

    if (!signResult) {
      throw new Error(
        `[GetExpiriesFromNodeSubRequest] SnodeSignature.generateUpdateExpirySignature returned an empty result ${this.messageHashes}`
      );
    }

    return {
      method: this.method,
      params: {
        pubkey: ourPubKey,
        pubkey_ed25519: signResult.pubkey_ed25519.toUpperCase(),
        signature: signResult.signature,
        messages: this.messageHashes,
        timestamp,
      },
    };
  }

  public loggingId(): string {
    return `${this.method}-us`;
  }

  public getDestination() {
    return UserUtils.getOurPubKeyStrFromCache();
  }
}

// TODO to use where delete_all is currently manually called
export class DeleteAllFromUserNodeSubRequest extends DeleteAllSubRequest {
  public readonly namespace = 'all'; // we can only delete_all for all namespaces currently, but the backend allows more

  public async build() {
    const signResult = await SnodeSignature.getSnodeSignatureParamsUs({
      method: this.method,
      namespace: this.namespace,
    });

    if (!signResult) {
      throw new Error(
        `[DeleteAllFromUserNodeSubRequest] SnodeSignature.getSnodeSignatureParamsUs returned an empty result`
      );
    }

    return {
      method: this.method,
      params: {
        pubkey: signResult.pubkey,
        pubkey_ed25519: signResult.pubkey_ed25519.toUpperCase(),
        signature: signResult.signature,
        timestamp: signResult.timestamp,
        namespace: this.namespace,
      },
    };
  }

  public loggingId(): string {
    return `${this.method}-${this.namespace}`;
  }

  public getDestination() {
    return UserUtils.getOurPubKeyStrFromCache();
  }
}

/**
 * Delete all the messages and not the config messages for that group 03.
 */
export class DeleteAllFromGroupMsgNodeSubRequest extends DeleteAllSubRequest {
  public readonly namespace = SnodeNamespaces.ClosedGroupMessages;
  public readonly adminSecretKey: Uint8Array;
  public readonly destination: GroupPubkeyType;

  constructor(args: WithGroupPubkey & WithSecretKey) {
    super();
    this.destination = args.groupPk;
    this.adminSecretKey = args.secretKey;
    if (isEmpty(this.adminSecretKey)) {
      throw new Error('DeleteAllFromGroupMsgNodeSubRequest needs an adminSecretKey');
    }
  }

  public async build() {
    const signDetails = await SnodeGroupSignature.getSnodeGroupSignature({
      method: this.method,
      namespace: this.namespace,
      group: { authData: null, pubkeyHex: this.destination, secretKey: this.adminSecretKey },
    });

    if (!signDetails) {
      throw new Error(
        `[DeleteAllFromGroupMsgNodeSubRequest] SnodeSignature.getSnodeSignatureParamsUs returned an empty result`
      );
    }
    return {
      method: this.method,
      params: {
        ...signDetails,
        namespace: this.namespace,
      },
    };
  }

  public loggingId(): string {
    return `${this.method}-${ed25519Str(this.destination)}-${this.namespace}`;
  }

  public getDestination() {
    return this.destination;
  }
}

/**
 * Delete all the normal and config messages from a group swarm.
 * Note: only used for debugging purposes
 */
export class DeleteAllFromGroupNodeSubRequest extends DeleteAllSubRequest {
  public readonly namespace = 'all';
  public readonly adminSecretKey: Uint8Array;
  public readonly destination: GroupPubkeyType;

  constructor(args: WithGroupPubkey & WithSecretKey) {
    super();
    this.destination = args.groupPk;
    this.adminSecretKey = args.secretKey;
    if (isEmpty(this.adminSecretKey)) {
      throw new Error('DeleteAllFromGroupMsgNodeSubRequest needs an adminSecretKey');
    }
    if (!isDevProd()) {
      throw new Error('DeleteAllFromGroupNodeSubRequest can only be used on non-production build');
    }
  }

  public async build() {
    const signDetails = await SnodeGroupSignature.getSnodeGroupSignature({
      method: this.method,
      namespace: this.namespace,
      group: { authData: null, pubkeyHex: this.destination, secretKey: this.adminSecretKey },
    });

    if (!signDetails) {
      throw new Error(
        `[DeleteAllFromGroupMsgNodeSubRequest] SnodeSignature.getSnodeSignatureParamsUs returned an empty result`
      );
    }
    return {
      method: this.method,
      params: {
        ...signDetails,
        namespace: this.namespace,
      },
    };
  }

  public loggingId(): string {
    return `${this.method}-${ed25519Str(this.destination)}-${this.namespace}`;
  }

  public getDestination() {
    return this.destination;
  }
}

export class DeleteHashesFromUserNodeSubRequest extends DeleteSubRequest {
  public readonly messageHashes: Array<string>;
  public readonly destination: PubkeyType;

  constructor(args: WithMessagesHashes) {
    super();
    this.messageHashes = args.messagesHashes;
    this.destination = UserUtils.getOurPubKeyStrFromCache();

    if (this.messageHashes.length === 0) {
      window.log.warn(`DeleteHashesFromUserNodeSubRequest given empty list of messageHashes`);
      throw new Error('DeleteHashesFromUserNodeSubRequest given empty list of messageHashes');
    }
  }

  public async build() {
    const signResult = await SnodeSignature.getSnodeSignatureByHashesParams({
      method: this.method,
      messagesHashes: this.messageHashes,
      pubkey: this.destination,
    });

    if (!signResult) {
      throw new Error(
        `[DeleteHashesFromUserNodeSubRequest] SnodeSignature.getSnodeSignatureParamsUs returned an empty result`
      );
    }

    return {
      method: this.method,
      params: {
        pubkey: signResult.pubkey,
        pubkey_ed25519: signResult.pubkey_ed25519,
        signature: signResult.signature,
        messages: signResult.messages,
        // timestamp is not needed for this one as the hashes can be deleted only once
      },
    };
  }

  public loggingId(): string {
    return `${this.method}-us`;
  }

  public getDestination() {
    return this.destination;
  }
}

export class DeleteHashesFromGroupNodeSubRequest extends DeleteSubRequest {
  public readonly messageHashes: Array<string>;
  public readonly destination: GroupPubkeyType;
  public readonly secretKey: Uint8Array;

  constructor(args: WithMessagesHashes & WithGroupPubkey & WithSecretKey) {
    super();
    this.messageHashes = args.messagesHashes;
    this.destination = args.groupPk;
    this.secretKey = args.secretKey;
    if (!this.secretKey || isEmpty(this.secretKey)) {
      throw new Error('DeleteHashesFromGroupNodeSubRequest needs a secretKey');
    }

    if (this.messageHashes.length === 0) {
      window.log.warn(
        `DeleteHashesFromGroupNodeSubRequest given empty list of messageHashes for ${ed25519Str(this.destination)}`
      );

      throw new Error('DeleteHashesFromGroupNodeSubRequest given empty list of messageHashes');
    }
  }

  /**
   * This request can only be made by an admin and will be denied otherwise, so we make the secretKey mandatory in the constructor.
   */
  public async build() {
    const signResult = await SnodeGroupSignature.getGroupSignatureByHashesParams({
      method: this.method,
      messagesHashes: this.messageHashes,
      groupPk: this.destination,
      group: { authData: null, pubkeyHex: this.destination, secretKey: this.secretKey },
    });

    return {
      method: this.method,
      params: {
        ...signResult,
        // pubkey_ed25519 is forbidden when doing the request for a group
        // timestamp is not needed for this one as the hashes can be deleted only once
      },
    };
  }

  public loggingId(): string {
    return `${this.method}-${ed25519Str(this.destination)}`;
  }

  public getDestination() {
    return this.destination;
  }
}

export class UpdateExpiryOnNodeUserSubRequest extends ExpireSubRequest {
  public readonly messageHashes: Array<string>;
  public readonly expiryMs: number;
  public readonly shortenOrExtend: ShortenOrExtend;

  constructor(args: WithMessagesHashes & WithShortenOrExtend & { expiryMs: number }) {
    super();
    this.messageHashes = args.messagesHashes;
    this.expiryMs = args.expiryMs;
    this.shortenOrExtend = args.shortenOrExtend;

    if (this.messageHashes.length === 0) {
      window.log.warn(`UpdateExpiryOnNodeUserSubRequest given empty list of messageHashes`);
      throw new Error('UpdateExpiryOnNodeUserSubRequest given empty list of messageHashes');
    }
  }

  public async build() {
    const signResult = await SnodeSignature.generateUpdateExpiryOurSignature({
      shortenOrExtend: this.shortenOrExtend,
      messagesHashes: this.messageHashes,
      timestamp: this.expiryMs,
    });

    if (!signResult) {
      throw new Error(
        `[UpdateExpiryOnNodeUserSubRequest] SnodeSignature.getSnodeSignatureParamsUs returned an empty result`
      );
    }

    const shortenOrExtend =
      this.shortenOrExtend === 'extend'
        ? { extend: true }
        : this.shortenOrExtend === 'shorten'
          ? { shorten: true }
          : {};

    return {
      method: this.method,
      params: {
        pubkey: UserUtils.getOurPubKeyStrFromCache(),
        pubkey_ed25519: signResult.pubkey,
        signature: signResult.signature,
        messages: this.messageHashes,
        expiry: this.expiryMs,
        ...shortenOrExtend,
      },
    };
  }

  public loggingId(): string {
    return `${this.method}-us`;
  }

  public getDestination() {
    return UserUtils.getOurPubKeyStrFromCache();
  }
}

export class UpdateExpiryOnNodeGroupSubRequest extends ExpireSubRequest {
  public readonly messageHashes: Array<string>;
  public readonly expiryMs: number;
  public readonly shortenOrExtend: ShortenOrExtend;
  public readonly groupDetailsNeededForSignature: GroupDetailsNeededForSignature;

  constructor(
    args: WithMessagesHashes &
      WithShortenOrExtend & {
        expiryMs: number;
        groupDetailsNeededForSignature: GroupDetailsNeededForSignature;
      }
  ) {
    super();
    this.messageHashes = args.messagesHashes;
    this.expiryMs = args.expiryMs;
    this.shortenOrExtend = args.shortenOrExtend;
    this.groupDetailsNeededForSignature = args.groupDetailsNeededForSignature;

    if (this.messageHashes.length === 0) {
      window.log.warn(
        `UpdateExpiryOnNodeGroupSubRequest given empty list of messageHashes for ${ed25519Str(this.groupDetailsNeededForSignature.pubkeyHex)}`
      );

      throw new Error('UpdateExpiryOnNodeGroupSubRequest given empty list of messageHashes');
    }
  }

  public async build() {
    const signResult = await SnodeGroupSignature.generateUpdateExpiryGroupSignature({
      shortenOrExtend: this.shortenOrExtend,
      messagesHashes: this.messageHashes,
      expiryMs: this.expiryMs,
      group: this.groupDetailsNeededForSignature,
    });

    if (!signResult) {
      throw new Error(
        `[UpdateExpiryOnNodeUserSubRequest] SnodeSignature.getSnodeSignatureParamsUs returned an empty result`
      );
    }

    const shortenOrExtend =
      this.shortenOrExtend === 'extend'
        ? { extends: true }
        : this.shortenOrExtend === 'shorten'
          ? { shorten: true }
          : {};

    return {
      method: this.method,
      params: {
        messages: this.messageHashes,
        ...shortenOrExtend,
        ...signResult,

        // pubkey_ed25519 is forbidden for the group one
      },
    };
  }

  public loggingId(): string {
    return `${this.method}-${ed25519Str(this.groupDetailsNeededForSignature.pubkeyHex)}`;
  }

  public getDestination() {
    return this.groupDetailsNeededForSignature.pubkeyHex;
  }
}

export class StoreGroupMessageSubRequest extends StoreSubRequest {
  public readonly namespace = SnodeNamespaces.ClosedGroupMessages;
  public readonly destination: GroupPubkeyType;
  public readonly ttlMs: number;
  public readonly encryptedData: Uint8Array;
  public readonly dbMessageIdentifier: string | null;
  public readonly secretKey: Uint8Array | null;
  public readonly authData: Uint8Array | null;
  public readonly createdAtNetworkTimestamp: number;

  constructor(
    args: WithGroupPubkey &
      WithGetNow &
      WithCreatedAtNetworkTimestamp & {
        ttlMs: number;
        encryptedData: Uint8Array;
        dbMessageIdentifier: string | null;
        authData: Uint8Array | null;
        secretKey: Uint8Array | null;
      }
  ) {
    super(args);
    this.destination = args.groupPk;
    this.ttlMs = args.ttlMs;
    this.encryptedData = args.encryptedData;
    this.dbMessageIdentifier = args.dbMessageIdentifier;
    this.authData = args.authData;
    this.secretKey = args.secretKey;
    this.createdAtNetworkTimestamp = args.createdAtNetworkTimestamp;

    if (isEmpty(this.encryptedData)) {
      throw new Error('this.encryptedData cannot be empty');
    }
    if (!PubKey.is03Pubkey(this.destination)) {
      throw new Error('StoreGroupMessageSubRequest: group config namespace required a 03 pubkey');
    }
    if (isEmpty(this.secretKey) && isEmpty(this.authData)) {
      throw new Error('StoreGroupMessageSubRequest needs either authData or secretKey to be set');
    }
    if (SnodeNamespace.isGroupConfigNamespace(this.namespace) && isEmpty(this.secretKey)) {
      throw new Error(
        `StoreGroupMessageSubRequest: group config namespace [${this.namespace}] requires an adminSecretKey`
      );
    }
  }

  public async build(): Promise<{
    method: 'store';
    params: StoreOnNodeNormalParams;
  }> {
    const encryptedDataBase64 = ByteBuffer.wrap(this.encryptedData).toString('base64');

    // this will either sign with our admin key or with the sub account key if the admin one isn't there
    const signDetails = await SnodeGroupSignature.getSnodeGroupSignature({
      method: this.method,
      namespace: this.namespace,
      group: { authData: this.authData, pubkeyHex: this.destination, secretKey: this.secretKey },
    });

    if (!signDetails) {
      throw new Error(`[${this.loggingId()}] sign details is empty result`);
    }

    return {
      method: this.method,
      params: {
        namespace: this.namespace,
        ttl: this.ttlMs,
        data: encryptedDataBase64,
        ...signDetails,
      },
    };
  }

  public loggingId(): string {
    return `${this.method}-${ed25519Str(this.destination)}-${SnodeNamespace.toRole(
      this.namespace
    )}`;
  }

  public getDestination() {
    return this.destination;
  }
}

abstract class StoreGroupConfigSubRequest<
  T extends SnodeNamespacesGroupConfig | SnodeNamespaces.ClosedGroupRevokedRetrievableMessages,
> extends StoreSubRequest {
  public readonly namespace: T;
  public readonly destination: GroupPubkeyType;
  public readonly ttlMs: number;
  public readonly encryptedData: Uint8Array;
  // this is mandatory for a group config store, if it is null, we throw
  public readonly secretKey: Uint8Array | null;

  constructor(
    args: WithGroupPubkey &
      WithGetNow & {
        namespace: T;
        encryptedData: Uint8Array;
        secretKey: Uint8Array | null;
        ttlMs: number;
      }
  ) {
    super(args);
    this.namespace = args.namespace;
    this.destination = args.groupPk;
    this.ttlMs = args.ttlMs;
    this.encryptedData = args.encryptedData;
    this.secretKey = args.secretKey;

    if (isEmpty(this.encryptedData)) {
      throw new Error('this.encryptedData cannot be empty');
    }
    if (!PubKey.is03Pubkey(this.destination)) {
      throw new Error('StoreGroupConfigSubRequest: group config namespace required a 03 pubkey');
    }
    if (isEmpty(this.secretKey)) {
      throw new Error('StoreGroupConfigSubRequest needs secretKey to be set');
    }
  }

  public async build(): Promise<{
    method: 'store';
    params: StoreOnNodeNormalParams;
  }> {
    const encryptedDataBase64 = ByteBuffer.wrap(this.encryptedData).toString('base64');

    // this will either sign with our admin key or with the sub account key if the admin one isn't there
    const signDetails = await SnodeGroupSignature.getSnodeGroupSignature({
      method: this.method,
      namespace: this.namespace,
      group: { authData: null, pubkeyHex: this.destination, secretKey: this.secretKey },
    });

    if (!signDetails) {
      throw new Error(`[${this.loggingId()}] sign details is empty result`);
    }

    return {
      method: this.method,
      params: {
        namespace: this.namespace,
        ttl: this.ttlMs,
        data: encryptedDataBase64,
        ...signDetails,
      },
    };
  }

  public getDestination() {
    return this.destination;
  }

  public loggingId(): string {
    return `${this.method}-${ed25519Str(this.destination)}-${SnodeNamespace.toRole(
      this.namespace
    )}`;
  }

  public requestOrder(): number {
    if (this.namespace === SnodeNamespaces.ClosedGroupKeys) {
      // -10 means that we need this request to be sent before something with an order of 0 for instance
      return -10;
    }
    return super.requestOrder();
  }
}

export class StoreGroupInfoSubRequest extends StoreGroupConfigSubRequest<SnodeNamespaces.ClosedGroupInfo> {
  constructor(
    args: Omit<ConstructorParameters<typeof StoreGroupConfigSubRequest>[0], 'namespace'>
  ) {
    super({ ...args, namespace: SnodeNamespaces.ClosedGroupInfo });
  }
}
export class StoreGroupMembersSubRequest extends StoreGroupConfigSubRequest<SnodeNamespaces.ClosedGroupMembers> {
  constructor(
    args: Omit<ConstructorParameters<typeof StoreGroupConfigSubRequest>[0], 'namespace'>
  ) {
    super({ ...args, namespace: SnodeNamespaces.ClosedGroupMembers });
  }
}
export class StoreGroupKeysSubRequest extends StoreGroupConfigSubRequest<SnodeNamespaces.ClosedGroupKeys> {
  constructor(
    args: Omit<ConstructorParameters<typeof StoreGroupConfigSubRequest>[0], 'namespace'>
  ) {
    super({ ...args, namespace: SnodeNamespaces.ClosedGroupKeys });
  }
}

export class StoreGroupRevokedRetrievableSubRequest extends StoreGroupConfigSubRequest<SnodeNamespaces.ClosedGroupRevokedRetrievableMessages> {
  constructor(
    args: Omit<ConstructorParameters<typeof StoreGroupConfigSubRequest>[0], 'namespace'>
  ) {
    super({ ...args, namespace: SnodeNamespaces.ClosedGroupRevokedRetrievableMessages });
  }
}

export class StoreUserConfigSubRequest extends StoreSubRequest {
  public readonly namespace: SnodeNamespacesUserConfig;
  public readonly ttlMs: number;
  public readonly encryptedData: Uint8Array;
  public readonly destination: PubkeyType;

  constructor(
    args: WithGetNow & {
      namespace: SnodeNamespacesUserConfig;
      ttlMs: number;
      encryptedData: Uint8Array;
    }
  ) {
    super(args);
    this.namespace = args.namespace;
    this.ttlMs = args.ttlMs;
    this.encryptedData = args.encryptedData;
    this.destination = UserUtils.getOurPubKeyStrFromCache();

    if (isEmpty(this.encryptedData)) {
      throw new Error('this.encryptedData cannot be empty');
    }

    if (isEmpty(this.destination)) {
      throw new Error('this.destination cannot be empty');
    }
  }

  public async build(): Promise<{
    method: 'store';
    params: StoreOnNodeNormalParams;
  }> {
    const encryptedDataBase64 = ByteBuffer.wrap(this.encryptedData).toString('base64');
    const ourPrivKey = (await UserUtils.getUserED25519KeyPairBytes())?.privKeyBytes;
    if (!ourPrivKey) {
      throw new Error('getUserED25519KeyPairBytes is empty');
    }

    const signDetails = await SnodeSignature.getSnodeSignatureParamsUs({
      method: this.method,
      namespace: this.namespace,
    });

    if (!signDetails) {
      throw new Error(`[StoreUserConfigSubRequest] signing returned an empty result`);
    }

    return {
      method: this.method,
      params: {
        namespace: this.namespace,
        ttl: this.ttlMs,
        data: encryptedDataBase64,
        ...signDetails,
      },
    };
  }

  public loggingId(): string {
    return `${this.method}-${ed25519Str(this.destination)}-${SnodeNamespace.toRole(
      this.namespace
    )}`;
  }

  public getDestination() {
    return this.destination;
  }
}

/**
 * A request to send a message to the default namespace of another user (namespace 0 is not authenticated)
 */
export class StoreUserMessageSubRequest extends StoreSubRequest {
  public readonly ttlMs: number;
  public readonly encryptedData: Uint8Array;
  public readonly namespace = SnodeNamespaces.Default;
  public readonly destination: PubkeyType;
  public readonly dbMessageIdentifier: string | null;
  public readonly createdAtNetworkTimestamp: number;

  public readonly plainTextBuffer: Uint8Array | null;

  constructor(
    args: WithCreatedAtNetworkTimestamp &
      WithGetNow & {
        ttlMs: number;
        encryptedData: Uint8Array;
        destination: PubkeyType;
        dbMessageIdentifier: string | null;
        /**
         * When we send a message to a 1o1 recipient, we then need to send the same message to our own swarm as a synced message.
         * To forward that message, we need the original message data, which is the plainTextBuffer field here.
         */
        plainTextBuffer: Uint8Array | null;
      }
  ) {
    super(args);
    this.ttlMs = args.ttlMs;
    this.destination = args.destination;
    this.encryptedData = args.encryptedData;
    this.plainTextBuffer = args.plainTextBuffer;
    this.dbMessageIdentifier = args.dbMessageIdentifier;
    this.createdAtNetworkTimestamp = args.createdAtNetworkTimestamp;

    if (isEmpty(this.encryptedData)) {
      throw new Error('this.encryptedData cannot be empty');
    }
    if (this.plainTextBuffer && !this.plainTextBuffer.length) {
      throw new Error('this.plainTextBuffer can be either null or non-empty');
    }
  }

  public async build(): Promise<{
    method: 'store';
    params: StoreOnNodeNormalParams;
  }> {
    const encryptedDataBase64 = ByteBuffer.wrap(this.encryptedData).toString('base64');

    return {
      method: this.method,
      params: {
        pubkey: this.destination,
        timestamp: this.getNow(),
        namespace: this.namespace,
        ttl: this.ttlMs,
        data: encryptedDataBase64,
      },
    };
  }

  public loggingId(): string {
    return `${this.method}-${ed25519Str(this.destination)}-${SnodeNamespace.toRole(
      this.namespace
    )}`;
  }

  public getDestination() {
    return this.destination;
  }
}

/**
 * When sending group libsession push(), we can also include extra messages to store (update messages, supplemental keys, etc)
 */
export type StoreGroupExtraData = {
  networkTimestamp: number;
  data: Uint8Array;
  ttl: number;
  pubkey: GroupPubkeyType;
  dbMessageIdentifier: string | null;
} & { namespace: SnodeNamespacesGroupConfig | SnodeNamespaces.ClosedGroupMessages };

/**
 * STORE SUB REQUESTS
 */
type StoreOnNodeNormalParams = {
  pubkey: string;
  ttl: number;
  timestamp: number;
  data: string;
  namespace: number;
  signature?: string;
  pubkey_ed25519?: string;
};

type StoreOnNodeSubAccountParams = Pick<
  StoreOnNodeNormalParams,
  'data' | 'namespace' | 'ttl' | 'timestamp'
> &
  WithSignature & {
    pubkey: GroupPubkeyType;
    subaccount: string;
    subaccount_sig: string;
    namespace: SnodeNamespaces.ClosedGroupMessages; // this can only be this one, sub accounts holder can not post to something else atm
    // signature is mandatory for sub account
  };

type StoreOnNodeParams = StoreOnNodeNormalParams | StoreOnNodeSubAccountParams;

export type MethodBatchType = 'batch' | 'sequence';
export type WithMethodBatchType = { method: MethodBatchType };

export type RawSnodeSubRequests =
  | RetrieveUserSubRequest
  | RetrieveGroupSubRequest
  | StoreGroupInfoSubRequest
  | StoreGroupMembersSubRequest
  | StoreGroupKeysSubRequest
  | StoreGroupMessageSubRequest
  | StoreGroupRevokedRetrievableSubRequest
  | StoreUserConfigSubRequest
  | SwarmForSubRequest
  | OnsResolveSubRequest
  | GetServiceNodesSubRequest
  | StoreUserMessageSubRequest
  | NetworkTimeSubRequest
  | DeleteHashesFromGroupNodeSubRequest
  | DeleteHashesFromUserNodeSubRequest
  | DeleteAllFromUserNodeSubRequest
  | UpdateExpiryOnNodeUserSubRequest
  | UpdateExpiryOnNodeGroupSubRequest
  | SubaccountRevokeSubRequest
  | SubaccountUnrevokeSubRequest
  | GetExpiriesFromNodeSubRequest
  | DeleteAllFromGroupMsgNodeSubRequest
  | DeleteAllFromGroupNodeSubRequest;

export type BuiltSnodeSubRequests = AwaitedReturn<RawSnodeSubRequests['build']>;

export function builtRequestToLoggingId(request: BuiltSnodeSubRequests): string {
  const { method, params } = request;
  switch (method) {
    case 'info':
    case 'oxend_request':
      return `${method}`;
    case 'delete':
    case 'expire':
    case 'get_expiries':
    case 'get_swarm':
    case 'revoke_subaccount':
    case 'unrevoke_subaccount': {
      const isUs = UserUtils.isUsFromCache(params.pubkey);
      return `${method}-${isUs ? 'us' : ed25519Str(params.pubkey)}`;
    }
    case 'delete_all': {
      const isUs = UserUtils.isUsFromCache(params.pubkey);
      return `${method}-${isUs ? 'us' : ed25519Str(params.pubkey)}-${
        isString(params.namespace) ? params.namespace : SnodeNamespace.toRole(params.namespace)
      }}`;
    }
    case 'retrieve':
    case 'store': {
      const isUs = UserUtils.isUsFromCache(params.pubkey);
      return `${method}-${isUs ? 'us' : ed25519Str(params.pubkey)}-${SnodeNamespace.toRole(
        params.namespace
      )}`;
    }
    default:
      assertUnreachable(method, 'should be unreachable case');
      throw new Error('should be unreachable case');
  }
}

export const MAX_SUBREQUESTS_COUNT = 20;

export type BatchStoreWithExtraParams =
  | StoreOnNodeParams
  | DeleteHashesFromGroupNodeSubRequest
  | DeleteHashesFromUserNodeSubRequest
  | SubaccountRevokeSubRequest
  | SubaccountUnrevokeSubRequest;

/**
 * A `StoreUserInitiatedSubRequest` is a request that the user made and that (potentially) has
 * a corresponding message in the database.
 * Those messages are the messages that display a failed/sent status, so we need to update them when the request is done, to reflect the
 * success/failure of the sending step.
 */
export type StoreUserInitiatedSubRequest = StoreGroupMessageSubRequest | StoreUserMessageSubRequest;

export function isStoreUserInitiatedSubRequest(
  request: SnodeAPISubRequest<string>
): request is StoreUserInitiatedSubRequest {
  return (
    request instanceof StoreGroupMessageSubRequest || request instanceof StoreUserMessageSubRequest
  );
}
