import { GroupPubkeyType, PubkeyType, WithGroupPubkey } from 'libsession_util_nodejs';
import { isEmpty, isFinite, isNumber } from 'lodash';
import { Data } from '../../data/data';
import { deleteAllMessagesByConvoIdNoConfirmation } from '../../interactions/conversationInteractions';
import { deleteMessagesFromSwarmOnly } from '../../interactions/conversations/unsendingInteractions';
import { CONVERSATION_PRIORITIES, ConversationTypeEnum } from '../../models/types';
import { HexString } from '../../node/hexStrings';
import { SignalService } from '../../protobuf';
import { getSwarmPollingInstance } from '../../session/apis/snode_api';
import { ConvoHub } from '../../session/conversations';
import { getSodiumRenderer } from '../../session/crypto';
import { WithDisappearingMessageUpdate } from '../../session/disappearing_messages/types';
import { ClosedGroup } from '../../session/group/closed-group';
import { PubKey } from '../../session/types';
import { WithMessageHash, type WithMessageHashOrNull } from '../../session/types/with';
import { UserUtils } from '../../session/utils';
import { sleepFor } from '../../session/utils/Promise';
import { ed25519Str, stringToUint8Array } from '../../session/utils/String';
import { PreConditionFailed } from '../../session/utils/errors';
import { LibSessionUtil } from '../../session/utils/libsession/libsession_utils';
import { SessionUtilConvoInfoVolatile } from '../../session/utils/libsession/libsession_utils_convo_info_volatile';
import { groupInfoActions } from '../../state/ducks/metaGroups';
import { stringify, toFixedUint8ArrayOfLength } from '../../types/sqlSharedTypes';
import { BlockedNumberController } from '../../util';
import {
  MetaGroupWrapperActions,
  UserGroupsWrapperActions,
} from '../../webworker/workers/browser/libsession_worker_interface';
import { sendInviteResponseToGroup } from '../../session/sending/group/GroupInviteResponse';

type WithSignatureTimestamp = { signatureTimestamp: number };
type WithAuthor = { author: PubkeyType };

type WithUncheckedSource = { source: string };
type WithUncheckedSenderIdentity = { senderIdentity: string };

type GroupInviteDetails = {
  inviteMessage: SignalService.GroupUpdateInviteMessage;
} & WithSignatureTimestamp &
  WithAuthor;

type GroupUpdateGeneric<T> = {
  change: Omit<T, 'toJSON'>;
} & WithSignatureTimestamp &
  WithGroupPubkey &
  WithAuthor &
  WithDisappearingMessageUpdate &
  WithMessageHashOrNull;

type GroupUpdateDetails = {
  updateMessage: SignalService.GroupUpdateMessage;
} & WithSignatureTimestamp;

async function getInitializedGroupObject({
  groupPk,
  groupName,
  inviterIsApproved,
  groupSecretKey,
}: {
  groupPk: GroupPubkeyType;
  groupName: string;
  inviterIsApproved: boolean;
  groupSecretKey: Uint8Array | null;
}) {
  let found = await UserGroupsWrapperActions.getGroup(groupPk);
  const wasKicked = found?.kicked || false;

  if (!found) {
    found = {
      authData: null,
      joinedAtSeconds: Math.floor(Date.now() / 1000),
      name: groupName,
      priority: CONVERSATION_PRIORITIES.default,
      pubkeyHex: groupPk,
      secretKey: null,
      kicked: false,
      invitePending: true,
      destroyed: false,
    };
  }

  found.name = groupName;
  if (groupSecretKey && !isEmpty(groupSecretKey)) {
    found.secretKey = groupSecretKey;
  }

  if (inviterIsApproved) {
    // pre approve invite to groups when we've already approved the person who invited us
    found.invitePending = false;
  } else if (wasKicked) {
    // when we were kicked and reinvited by someone we do not trust, this conversation should go in the message request.
    found.invitePending = true;
  }

  if (found.invitePending) {
    // we also need to update the DB model, because we like duplicating things
    await ConvoHub.use().get(groupPk)?.setIsApproved(false, true);
  }

  return { found, wasKicked };
}

async function handleGroupUpdateInviteMessage({
  inviteMessage,
  author,
  signatureTimestamp,
}: GroupInviteDetails) {
  const groupPk = inviteMessage.groupSessionId;
  if (!PubKey.is03Pubkey(groupPk)) {
    return;
  }

  if (BlockedNumberController.isBlocked(author)) {
    window.log.info(
      `received invite to group ${ed25519Str(groupPk)} by blocked user:${ed25519Str(
        author
      )}... dropping it`
    );
    return;
  }

  const authorIsApproved = ConvoHub.use().get(author)?.isApproved() || false;
  window.log.info(
    `handleGroupInviteMessage for ${ed25519Str(groupPk)}, authorIsApproved:${authorIsApproved}`
  );

  const sigValid = await verifySig({
    pubKey: HexString.fromHexStringNoPrefix(groupPk),
    signature: inviteMessage.adminSignature,
    data: stringToUint8Array(`INVITE${UserUtils.getOurPubKeyStrFromCache()}${signatureTimestamp}`),
  });

  if (!sigValid) {
    window.log.warn(
      `received group invite ${ed25519Str(groupPk)} with invalid signature. dropping`
    );
    return;
  }

  window.log.debug(`received invite to group ${ed25519Str(groupPk)} by user:${ed25519Str(author)}`);

  const convo = await ConvoHub.use().getOrCreateAndWait(groupPk, ConversationTypeEnum.GROUPV2);
  convo.set({
    active_at: signatureTimestamp,
    didApproveMe: true,
    conversationIdOrigin: author,
  });

  if (inviteMessage.name && isEmpty(convo.getRealSessionUsername())) {
    convo.set({
      displayNameInProfile: inviteMessage.name,
    });
  }
  const userEd25519Secretkey = (await UserUtils.getUserED25519KeyPairBytes()).privKeyBytes;

  const { found, wasKicked } = await getInitializedGroupObject({
    groupPk,
    groupName: inviteMessage.name,
    groupSecretKey: null,
    inviterIsApproved: authorIsApproved,
  });

  // not sure if we should drop it, or set it again? They should be the same anyway
  found.authData = inviteMessage.memberAuthData;

  await UserGroupsWrapperActions.setGroup(found);
  await UserGroupsWrapperActions.markGroupInvited(groupPk);
  // force markedAsUnread to be true so it shows the unread banner (we only show the banner if there are unread messages on at least one msg/group request)
  await convo.markAsUnread(true, false);
  await convo.commit();

  await SessionUtilConvoInfoVolatile.insertConvoFromDBIntoWrapperAndRefresh(convo.id);

  if (wasKicked && !found.kicked) {
    // we have been reinvited to a group which we had been kicked from.
    // Let's empty the conversation again to remove any "you were removed from the group" control message
    await deleteAllMessagesByConvoIdNoConfirmation(groupPk);
  }

  await MetaGroupWrapperActions.init(groupPk, {
    metaDumped: null,
    groupEd25519Secretkey: null,
    userEd25519Secretkey: toFixedUint8ArrayOfLength(userEd25519Secretkey, 64).buffer,
    groupEd25519Pubkey: toFixedUint8ArrayOfLength(HexString.fromHexStringNoPrefix(groupPk), 32)
      .buffer,
  });
  try {
    const verified = await MetaGroupWrapperActions.swarmVerifySubAccount(
      groupPk,
      inviteMessage.memberAuthData
    );
    if (!verified) {
      throw new Error('subaccount failed to verify');
    }
  } catch (e) {
    window.log.warn(`swarmVerifySubAccount failed with: ${e.message}`);
  }

  await LibSessionUtil.saveDumpsToDb(UserUtils.getOurPubKeyStrFromCache());
  if (!found.invitePending) {
    // if this group should already be polling based on if that author is pre-approved or we've already approved that group from another device.
    getSwarmPollingInstance().addGroupId(groupPk, async () => {
      // we need to do a first poll to fetch the keys etc before we can send our invite response
      // this is pretty hacky, but also an admin seeing a message from that user in the group will mark it as not pending anymore
      await sleepFor(2000);
      await sendInviteResponseToGroup({ groupPk });
    });
  }
}

async function verifySig({
  data,
  pubKey,
  signature,
}: {
  data: Uint8Array;
  signature: Uint8Array;
  pubKey: Uint8Array;
}) {
  const sodium = await getSodiumRenderer();
  return sodium.crypto_sign_verify_detached(signature, data, pubKey);
}

async function handleGroupInfoChangeMessage({
  change,
  groupPk,
  signatureTimestamp,
  author,
  expireUpdate,
  messageHash,
}: GroupUpdateGeneric<SignalService.GroupUpdateInfoChangeMessage>) {
  const sigValid = await verifySig({
    pubKey: HexString.fromHexStringNoPrefix(groupPk),
    signature: change.adminSignature,
    data: stringToUint8Array(`INFO_CHANGE${change.type}${signatureTimestamp}`),
  });
  window.log.info(`handleGroupInfoChangeMessage for ${ed25519Str(groupPk)}`);

  if (!sigValid) {
    window.log.warn('received group info change with invalid signature. dropping');
    return;
  }
  const convo = ConvoHub.use().get(groupPk);
  if (!convo) {
    return;
  }

  switch (change.type) {
    case SignalService.GroupUpdateInfoChangeMessage.Type.NAME: {
      await ClosedGroup.addUpdateMessage({
        convo,
        diff: { type: 'name', newName: change.updatedName },
        sender: author,
        sentAt: signatureTimestamp,
        expireUpdate,
        markAlreadySent: true,
        messageHash,
      });

      break;
    }
    case SignalService.GroupUpdateInfoChangeMessage.Type.AVATAR: {
      await ClosedGroup.addUpdateMessage({
        convo,
        diff: { type: 'avatarChange' },
        sender: author,
        sentAt: signatureTimestamp,
        expireUpdate,
        markAlreadySent: true,
        messageHash,
      });
      break;
    }
    case SignalService.GroupUpdateInfoChangeMessage.Type.DISAPPEARING_MESSAGES: {
      const newTimerSeconds = change.updatedExpiration;
      if (isNumber(newTimerSeconds) && isFinite(newTimerSeconds) && newTimerSeconds >= 0) {
        await convo.updateExpireTimer({
          providedExpireTimer: newTimerSeconds,
          providedSource: author,
          providedDisappearingMode: newTimerSeconds > 0 ? 'deleteAfterSend' : 'off',
          sentAt: signatureTimestamp,
          fromCurrentDevice: false,
          fromSync: false,
          fromConfigMessage: false,
          messageHash,
        });
      }
      break;
    }
    default:
      return;
  }

  convo.set({
    active_at: signatureTimestamp,
  });
  await convo.commit();
}

async function handleGroupMemberChangeMessage({
  change,
  groupPk,
  signatureTimestamp,
  author,
  expireUpdate,
  messageHash,
}: GroupUpdateGeneric<SignalService.GroupUpdateMemberChangeMessage>) {
  const convo = ConvoHub.use().get(groupPk);
  if (!convo) {
    return;
  }
  window.log.info(`handleGroupMemberChangeMessage for ${ed25519Str(groupPk)}`);

  const sigValid = await verifySig({
    pubKey: HexString.fromHexStringNoPrefix(groupPk),
    signature: change.adminSignature,
    data: stringToUint8Array(`MEMBER_CHANGE${change.type}${signatureTimestamp}`),
  });
  if (!sigValid) {
    window.log.warn('received group member change with invalid signature. dropping');
    return;
  }
  const filteredMemberChange = change.memberSessionIds.filter(PubKey.is05Pubkey);

  if (!filteredMemberChange) {
    window.log.info('returning groupUpdate of member change without associated members...');

    return;
  }
  const sharedDetails = {
    convo,
    sender: author,
    sentAt: signatureTimestamp,
    expireUpdate,
    markAlreadySent: true,
    messageHash,
  };

  switch (change.type) {
    case SignalService.GroupUpdateMemberChangeMessage.Type.ADDED: {
      await ClosedGroup.addUpdateMessage({
        diff: { type: 'add', added: filteredMemberChange, withHistory: change.historyShared },
        ...sharedDetails,
      });

      break;
    }
    case SignalService.GroupUpdateMemberChangeMessage.Type.REMOVED: {
      await ClosedGroup.addUpdateMessage({
        diff: { type: 'kicked', kicked: filteredMemberChange },
        ...sharedDetails,
      });
      break;
    }
    case SignalService.GroupUpdateMemberChangeMessage.Type.PROMOTED: {
      await ClosedGroup.addUpdateMessage({
        diff: { type: 'promoted', promoted: filteredMemberChange },
        ...sharedDetails,
      });
      break;
    }
    default:
      return;
  }

  convo.set({
    active_at: signatureTimestamp,
  });
}

async function handleGroupMemberLeftMessage({
  groupPk,
  author,
}: GroupUpdateGeneric<SignalService.GroupUpdateMemberLeftMessage>) {
  // No need to verify sig, the author is already verified with the libsession.decrypt()
  const convo = ConvoHub.use().get(groupPk);
  if (!convo || !PubKey.is05Pubkey(author)) {
    return;
  }
  window.log.info(`handleGroupMemberLeftMessage for ${ed25519Str(groupPk)}`);

  // this does nothing if we are not an admin
  window.inboxStore?.dispatch(
    groupInfoActions.handleMemberLeftMessage({
      groupPk,
      memberLeft: author,
    }) as any
  );
}

async function handleGroupUpdateMemberLeftNotificationMessage({
  groupPk,
  signatureTimestamp,
  author,
  expireUpdate,
  messageHash,
}: GroupUpdateGeneric<SignalService.GroupUpdateMemberLeftNotificationMessage>) {
  // No need to verify sig, the author is already verified with the libsession.decrypt()
  const convo = ConvoHub.use().get(groupPk);
  if (!convo || !PubKey.is05Pubkey(author)) {
    return;
  }
  window.log.info(`handleGroupUpdateMemberLeftNotificationMessage for ${ed25519Str(groupPk)}`);

  await ClosedGroup.addUpdateMessage({
    convo,
    diff: { type: 'left', left: [author] },
    sender: author,
    sentAt: signatureTimestamp,
    expireUpdate,
    markAlreadySent: true,
    messageHash,
  });

  convo.set({
    active_at: signatureTimestamp,
  });
}

async function handleGroupUpdateDeleteMemberContentMessage({
  groupPk,
  signatureTimestamp,
  change,
  author,
}: GroupUpdateGeneric<SignalService.GroupUpdateDeleteMemberContentMessage>) {
  const convo = ConvoHub.use().get(groupPk);
  if (!convo) {
    return;
  }
  window.log.info(`handleGroupUpdateDeleteMemberContentMessage for ${ed25519Str(groupPk)}`);

  /**
   * When handling a GroupUpdateDeleteMemberContentMessage we need to do a few things.
   * When `adminSignature` is empty,
   *   1. we only delete the messageHashes which are in the change.messageHashes AND sent by that same author.
   * When `adminSignature` is not empty and valid,
   *   2. we delete all the messages in the group sent by any of change.memberSessionIds AND
   *   3. we mark as deleted all the messageHashes in the conversation matching the change.messageHashes (even if not from the right sender)
   *
   * Eventually, we will be able to delete those "deleted by kept locally" messages with placeholders.
   */

  // no adminSignature: this was sent by a non-admin user
  if (!change.adminSignature || isEmpty(change.adminSignature)) {
    // this is step 1.
    const messageModels = await Data.findAllMessageHashesInConversationMatchingAuthor({
      author,
      groupPk,
      messageHashes: change.messageHashes,
      signatureTimestamp,
    });

    // we don't want to hang for too long here
    // processing the handleGroupUpdateDeleteMemberContentMessage itself
    // (we are running on the receiving pipeline here)
    // so network calls are not allowed.
    for (let index = 0; index < messageModels.length; index++) {
      const messageModel = messageModels[index];
      try {
        // eslint-disable-next-line no-await-in-loop
        await messageModel.markAsDeleted();
      } catch (e) {
        window.log.warn(
          `handleGroupUpdateDeleteMemberContentMessage markAsDeleted non-admin of ${messageModel.getMessageHash()} failed with`,
          e.message
        );
      }
    }
    convo.updateLastMessage();

    return;
  }

  // else case: we have an admin signature to verify

  const sigValid = await verifySig({
    pubKey: HexString.fromHexStringNoPrefix(groupPk),
    signature: change.adminSignature,
    data: stringToUint8Array(
      `DELETE_CONTENT${signatureTimestamp}${change.memberSessionIds.join('')}${change.messageHashes.join('')}`
    ),
  });

  if (!sigValid) {
    window.log.warn('received group member delete content with invalid signature. dropping');
    return;
  }

  const toRemove = change.memberSessionIds.filter(PubKey.is05Pubkey);

  const modelsBySenders = await Data.findAllMessageFromSendersInConversation({
    groupPk,
    toRemove,
    signatureTimestamp,
  }); // this is step 2.

  const modelsByHashes = await Data.findAllMessageHashesInConversation({
    groupPk,
    messageHashes: change.messageHashes,
    signatureTimestamp,
  }); // this is step 3.

  // we don't want to hang while for too long here
  // processing the handleGroupDeleteMemberContentMessage itself
  // (we are running on the receiving pipeline here)
  // so network calls are not allowed.
  const mergedModels = modelsByHashes.concat(modelsBySenders);
  for (let index = 0; index < mergedModels.length; index++) {
    const messageModel = mergedModels[index];
    try {
      // eslint-disable-next-line no-await-in-loop
      await messageModel.markAsDeleted();
    } catch (e) {
      window.log.warn(
        `handleGroupDeleteMemberContentMessage markAsDeleted non-admin of ${messageModel.getMessageHash()} failed with`,
        e.message
      );
    }
  }
  convo.updateLastMessage();
}

async function handleGroupUpdateInviteResponseMessage({
  groupPk,
  change,
  author,
}: Omit<
  GroupUpdateGeneric<SignalService.GroupUpdateInviteResponseMessage>,
  'signatureTimestamp' | 'expireUpdate'
>) {
  // no sig verify for this type of message
  const convo = ConvoHub.use().get(groupPk);
  if (!convo) {
    return;
  }
  window.log.info(`handleGroupUpdateInviteResponseMessage for ${ed25519Str(groupPk)}`);

  if (!change.isApproved) {
    window.log.info('got inviteResponse but isApproved is false. Dropping');
    return;
  }

  window.inboxStore?.dispatch(
    groupInfoActions.inviteResponseReceived({ groupPk, member: author }) as any
  );
}

async function handleGroupUpdatePromoteMessage({
  change,
  author,
  signatureTimestamp,
}: Omit<GroupUpdateGeneric<SignalService.GroupUpdatePromoteMessage>, 'groupPk'>) {
  const seed = change.groupIdentitySeed;
  const sodium = await getSodiumRenderer();
  const groupKeypair = sodium.crypto_sign_seed_keypair(seed);

  const groupPk = `03${HexString.toHexString(groupKeypair.publicKey)}` as GroupPubkeyType;
  // we can be invited via a GroupUpdatePromoteMessage as an admin right away,
  // so we potentially need to deal with part of the invite process here too.

  if (BlockedNumberController.isBlocked(author)) {
    window.log.info(
      `received promote to group ${ed25519Str(groupPk)} by blocked user:${ed25519Str(
        author
      )}... dropping it`
    );
    return;
  }

  const authorIsApproved = ConvoHub.use().get(author)?.isApproved() || false;
  window.log.info(
    `received promote to group ${ed25519Str(groupPk)} by author:${ed25519Str(author)}. authorIsApproved:${authorIsApproved} `
  );

  const convo = await ConvoHub.use().getOrCreateAndWait(groupPk, ConversationTypeEnum.GROUPV2);
  convo.set({
    active_at: signatureTimestamp,
    didApproveMe: true,
    conversationIdOrigin: author,
  });

  if (change.name && isEmpty(convo.getRealSessionUsername())) {
    convo.set({
      displayNameInProfile: change.name,
    });
  }
  const userEd25519Secretkey = (await UserUtils.getUserED25519KeyPairBytes()).privKeyBytes;

  const { found, wasKicked } = await getInitializedGroupObject({
    groupPk,
    groupName: change.name,
    groupSecretKey: groupKeypair.privateKey,
    inviterIsApproved: authorIsApproved,
  });
  window.log.info(
    `received promote to group ${ed25519Str(groupPk)} group details: ${stringify(found)}`
  );

  await UserGroupsWrapperActions.setGroup(found);
  // force markedAsUnread to be true so it shows the unread banner (we only show the banner if there are unread messages on at least one msg/group request)
  await convo.markAsUnread(true, false);
  await convo.commit();

  await SessionUtilConvoInfoVolatile.insertConvoFromDBIntoWrapperAndRefresh(convo.id);

  if (wasKicked) {
    // we have been reinvited to a group which we had been kicked from.
    // Let's empty the conversation again to remove any "you were removed from the group" control message
    await deleteAllMessagesByConvoIdNoConfirmation(groupPk);
  }
  try {
    let wrapperAlreadyInit = false;
    try {
      await MetaGroupWrapperActions.infoGet(groupPk);
      wrapperAlreadyInit = true;
    } catch (e) {
      // nothing to do
    }
    if (!wrapperAlreadyInit) {
      await MetaGroupWrapperActions.init(groupPk, {
        metaDumped: null,
        groupEd25519Secretkey: groupKeypair.privateKey,
        userEd25519Secretkey: toFixedUint8ArrayOfLength(userEd25519Secretkey, 64).buffer,
        groupEd25519Pubkey: toFixedUint8ArrayOfLength(HexString.fromHexStringNoPrefix(groupPk), 32)
          .buffer,
      });
    }
  } catch (e) {
    window.log.warn(
      `handleGroupUpdatePromoteMessage: init of ${ed25519Str(groupPk)} failed with ${e.message}.`
    );
  }

  try {
    window.log.info(`Trying to just load admin keys for group ${ed25519Str(groupPk)}`);
    await MetaGroupWrapperActions.loadAdminKeys(groupPk, groupKeypair.privateKey);
  } catch (e2) {
    window.log.warn(
      `handleGroupUpdatePromoteMessage: loadAdminKeys of ${ed25519Str(groupPk)} failed with ${e2.message}`
    );
  }

  await LibSessionUtil.saveDumpsToDb(UserUtils.getOurPubKeyStrFromCache());
  if (!found.invitePending) {
    // yes, we really want to refetch the whole history of messages from that group...
    await ConvoHub.use().resetLastHashesForConversation(groupPk);

    // This group should already be polling based on if that author is pre-approved or we've already approved that group from another device.
    // Start polling from it, we will mark ourselves as admin once we get the first merge result, if needed.
    getSwarmPollingInstance().addGroupId(groupPk);
  }
}

async function handle1o1GroupUpdateMessage(
  details: GroupUpdateDetails &
    WithUncheckedSource &
    WithUncheckedSenderIdentity &
    WithDisappearingMessageUpdate &
    WithMessageHash
) {
  // the message types below are received from our own swarm, so source is the sender, and senderIdentity is empty

  if (details.updateMessage.inviteMessage || details.updateMessage.promoteMessage) {
    if (!PubKey.is05Pubkey(details.source)) {
      window.log.warn('received group invite/promote with invalid author');
      throw new PreConditionFailed('received group invite/promote with invalid author');
    }
    if (details.updateMessage.inviteMessage) {
      await handleGroupUpdateInviteMessage({
        inviteMessage: details.updateMessage
          .inviteMessage as SignalService.GroupUpdateInviteMessage,
        ...details,
        author: details.source,
      });
    } else if (details.updateMessage.promoteMessage) {
      await handleGroupUpdatePromoteMessage({
        change: details.updateMessage.promoteMessage as SignalService.GroupUpdatePromoteMessage,
        ...details,
        author: details.source,
      });
    }
    if (details.messageHash && !isEmpty(details.messageHash)) {
      const deleted = await deleteMessagesFromSwarmOnly(
        [details.messageHash],
        UserUtils.getOurPubKeyStrFromCache()
      );
      if (!deleted) {
        window.log.warn(
          `failed to delete invite/promote while processing it in handle1o1GroupUpdateMessage. hash:${details.messageHash}`
        );
      }
    }

    // returns true for all cases where this message was expected to be a 1o1 message, even if not processed
    return true;
  }

  return false;
}

async function handleGroupUpdateMessage(
  details: GroupUpdateDetails &
    WithUncheckedSource &
    WithUncheckedSenderIdentity &
    WithDisappearingMessageUpdate &
    WithMessageHash
) {
  const was1o1Message = await handle1o1GroupUpdateMessage(details);
  if (was1o1Message) {
    return;
  }

  // other messages are received from the groups swarm, so source is the groupPk, and senderIdentity is the author
  const author = details.senderIdentity;
  const groupPk = details.source;
  if (!PubKey.is05Pubkey(author) || !PubKey.is03Pubkey(groupPk)) {
    window.log.warn('received group update message with invalid author or groupPk');
    return;
  }
  const detailsWithContext = { ...details, author, groupPk };

  if (details.updateMessage.memberChangeMessage) {
    await handleGroupMemberChangeMessage({
      change: details.updateMessage
        .memberChangeMessage as SignalService.GroupUpdateMemberChangeMessage,
      ...detailsWithContext,
    });
    return;
  }

  if (details.updateMessage.infoChangeMessage) {
    await handleGroupInfoChangeMessage({
      change: details.updateMessage.infoChangeMessage as SignalService.GroupUpdateInfoChangeMessage,
      ...detailsWithContext,
    });
    return;
  }

  if (details.updateMessage.memberLeftMessage) {
    await handleGroupMemberLeftMessage({
      change: details.updateMessage.memberLeftMessage as SignalService.GroupUpdateMemberLeftMessage,
      ...detailsWithContext,
    });
    return;
  }

  if (details.updateMessage.memberLeftNotificationMessage) {
    await handleGroupUpdateMemberLeftNotificationMessage({
      change: details.updateMessage
        .memberLeftNotificationMessage as SignalService.GroupUpdateMemberLeftNotificationMessage,
      ...detailsWithContext,
    });
    return;
  }
  if (details.updateMessage.deleteMemberContent) {
    await handleGroupUpdateDeleteMemberContentMessage({
      change: details.updateMessage
        .deleteMemberContent as SignalService.GroupUpdateDeleteMemberContentMessage,
      ...detailsWithContext,
    });
    return;
  }

  if (details.updateMessage.inviteResponse) {
    await handleGroupUpdateInviteResponseMessage({
      change: details.updateMessage
        .inviteResponse as SignalService.GroupUpdateInviteResponseMessage,
      ...detailsWithContext,
    });
    return;
  }

  window.log.warn('received group update of unknown type. Discarding...');
}

export const GroupV2Receiver = {
  handleGroupUpdateMessage,
  handleGroupUpdateInviteResponseMessage,
};
