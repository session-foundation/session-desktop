import { Uint8ArrayLen64, WithGroupPubkey } from 'libsession_util_nodejs';
import { getSodiumRenderer } from '../../../crypto';
import { DisappearingMessages } from '../../../disappearing_messages';

import { GroupUpdateMemberChangeMessage } from '../../outgoing/controlMessage/group_v2/to_group/GroupUpdateMemberChangeMessage';
import { ConversationModel } from '../../../../models/conversation';
import {
  WithAddWithHistoryMembers,
  WithAddWithoutHistoryMembers,
  WithFromMemberLeftMessage,
  WithPromotedMembers,
  WithRemoveMembers,
} from '../../../types/with';

/**
 * Return the control messages to be pushed to the group's swarm.
 * Those are not going to change the state, they are just here as a "notification".
 * i.e. "Alice was removed from the group"
 */
async function getRemovedControlMessage({
  convo,
  groupPk,
  removed,
  adminSecretKey,
  createAtNetworkTimestamp,
  fromMemberLeftMessage,
  dbMessageIdentifier,
}: WithFromMemberLeftMessage &
  WithRemoveMembers &
  WithGroupPubkey & {
    convo: ConversationModel;
    adminSecretKey: Uint8ArrayLen64;
    createAtNetworkTimestamp: number;
    dbMessageIdentifier: string;
  }) {
  const sodium = await getSodiumRenderer();

  if (fromMemberLeftMessage || !removed.length) {
    return null;
  }

  return new GroupUpdateMemberChangeMessage({
    dbMessageIdentifier,
    removed,
    groupPk,
    typeOfChange: 'removed',
    createAtNetworkTimestamp,
    secretKey: adminSecretKey,
    sodium,
    ...DisappearingMessages.getExpireDetailsForOutgoingMessage(convo, createAtNetworkTimestamp),
  });
}

async function getWithoutHistoryControlMessage({
  convo,
  withoutHistory,
  groupPk,
  adminSecretKey,
  createAtNetworkTimestamp,
  dbMessageIdentifier,
}: WithAddWithoutHistoryMembers &
  WithGroupPubkey & {
    dbMessageIdentifier: string;
    convo: ConversationModel;
    adminSecretKey: Uint8ArrayLen64;
    createAtNetworkTimestamp: number;
  }) {
  const sodium = await getSodiumRenderer();

  if (!withoutHistory.length) {
    return null;
  }

  return new GroupUpdateMemberChangeMessage({
    dbMessageIdentifier,
    added: withoutHistory,
    groupPk,
    typeOfChange: 'added',
    createAtNetworkTimestamp,
    secretKey: adminSecretKey,
    sodium,
    ...DisappearingMessages.getExpireDetailsForOutgoingMessage(convo, createAtNetworkTimestamp),
  });
}

async function getWithHistoryControlMessage({
  convo,
  withHistory,
  groupPk,
  adminSecretKey,
  createAtNetworkTimestamp,
  dbMessageIdentifier,
}: WithAddWithHistoryMembers &
  WithGroupPubkey & {
    dbMessageIdentifier: string;
    convo: ConversationModel;
    adminSecretKey: Uint8ArrayLen64;
    createAtNetworkTimestamp: number;
  }) {
  const sodium = await getSodiumRenderer();

  if (!withHistory.length) {
    return null;
  }

  return new GroupUpdateMemberChangeMessage({
    dbMessageIdentifier,
    added: withHistory,
    groupPk,
    typeOfChange: 'addedWithHistory',
    createAtNetworkTimestamp,
    secretKey: adminSecretKey,
    sodium,
    ...DisappearingMessages.getExpireDetailsForOutgoingMessage(convo, createAtNetworkTimestamp),
  });
}

async function getPromotedControlMessage({
  convo,
  promoted,
  groupPk,
  adminSecretKey,
  createAtNetworkTimestamp,
  dbMessageIdentifier,
}: WithPromotedMembers &
  WithGroupPubkey & {
    dbMessageIdentifier: string;
    convo: ConversationModel;
    adminSecretKey: Uint8ArrayLen64;
    createAtNetworkTimestamp: number;
  }) {
  const sodium = await getSodiumRenderer();

  if (!promoted.length) {
    return null;
  }

  return new GroupUpdateMemberChangeMessage({
    dbMessageIdentifier,
    promoted,
    groupPk,
    typeOfChange: 'promoted',
    createAtNetworkTimestamp,
    secretKey: adminSecretKey,
    sodium,
    ...DisappearingMessages.getExpireDetailsForOutgoingMessage(convo, createAtNetworkTimestamp),
  });
}

export const GroupUpdateMessageFactory = {
  getRemovedControlMessage,
  getWithoutHistoryControlMessage,
  getWithHistoryControlMessage,
  getPromotedControlMessage,
};
