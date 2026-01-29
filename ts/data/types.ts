import type {
  WithRoomId,
  WithServerPubkey,
  WithServerUrl,
} from '../session/apis/open_group_api/sogsv3/sogsWith';

export type GuardNode = {
  ed25519PubKey: string;
};

export interface Snode {
  ip: string;
  port: number;
  pubkey_x25519: string;
  pubkey_ed25519: string;
}

export type SwarmNode = Snode & {
  address: string;
};

export type OpenGroupV2Room = WithRoomId &
  WithServerPubkey &
  WithServerUrl & {
    /** a user displayed name */
    roomName?: string;

    /** the fileId of the group room's image */
    imageID?: string;

    /** the linked ConversationModel.id */
    conversationId?: string;
    maxMessageFetchedSeqNo?: number;
    lastInboxIdFetched?: number;
    lastOutboxIdFetched?: number;

    /**
     * This value is set with the current timestamp whenever we get new messages.
     */
    lastFetchTimestamp?: number;

    /**
     * This is shared across all rooms in a server.
     */
    capabilities?: Array<string>;
  };

export type OpenGroupRequestCommonType = WithRoomId & WithServerUrl;
