import { expect } from 'chai';
import Sinon from 'sinon';

import { Data } from '../../../../data/data';
import { deleteOrMarkAsDeletedMessages } from '../../../../interactions/conversations/deleteOrMarkAsDeletedMessages';
import type { ConversationModel } from '../../../../models/conversation';
import { READ_MESSAGE_STATE } from '../../../../models/conversationAttributes';
import { MessageDeletedType } from '../../../../models/messageType';
import { TestUtils } from '../../../test-utils';

describe('deleteOrMarkAsDeletedMessages', () => {
  beforeEach(() => {
    TestUtils.stubWindowLog();
  });

  afterEach(() => {
    Sinon.restore();
  });

  function makeUnreadMessage() {
    const message = TestUtils.generateFakeIncomingPrivateMessage();
    message.set({ unread: READ_MESSAGE_STATE.unread });

    const refreshInMemoryDetails = Sinon.stub().resolves();
    const updateLastMessage = Sinon.stub();
    const saveMessage = Sinon.stub(Data, 'saveMessage').resolves(message.id);

    Sinon.stub(message, 'getConversation').returns({
      refreshInMemoryDetails,
      updateLastMessage,
    } as unknown as ConversationModel);

    return { message, refreshInMemoryDetails, saveMessage, updateLastMessage };
  }

  it('preserves unread state when a message is deleted remotely', async () => {
    const { message, refreshInMemoryDetails, saveMessage, updateLastMessage } = makeUnreadMessage();

    await deleteOrMarkAsDeletedMessages({
      conversation: {} as ConversationModel,
      messages: [message],
      deletionType: 'markDeletedGlobally',
      actionContextIsUI: false,
    });

    expect(message.get('isDeleted')).to.equal(MessageDeletedType.deletedGlobally);
    expect(message.get('unread')).to.equal(READ_MESSAGE_STATE.unread);
    expect(saveMessage.calledOnce).to.equal(true);
    expect(saveMessage.firstCall.firstArg.unread).to.equal(READ_MESSAGE_STATE.unread);
    expect(refreshInMemoryDetails.calledOnce).to.equal(true);
    expect(updateLastMessage.calledOnce).to.equal(true);
  });

  it('marks an unread message as read when it is deleted from the UI', async () => {
    const { message, saveMessage } = makeUnreadMessage();

    await deleteOrMarkAsDeletedMessages({
      conversation: {} as ConversationModel,
      messages: [message],
      deletionType: 'markDeletedThisDevice',
      actionContextIsUI: true,
    });

    expect(message.get('isDeleted')).to.equal(MessageDeletedType.deletedLocally);
    expect(message.get('unread')).to.equal(READ_MESSAGE_STATE.read);
    expect(saveMessage.calledOnce).to.equal(true);
    expect(saveMessage.firstCall.firstArg.unread).to.equal(READ_MESSAGE_STATE.read);
  });

  it('does not start delete-after-read expiry when a message is deleted remotely', async () => {
    const { message } = makeUnreadMessage();
    message.set({ expirationType: 'deleteAfterRead', expireTimer: 60 });

    await deleteOrMarkAsDeletedMessages({
      conversation: {} as ConversationModel,
      messages: [message],
      deletionType: 'markDeletedGlobally',
      actionContextIsUI: false,
    });

    expect(message.get('unread')).to.equal(READ_MESSAGE_STATE.unread);
    expect(message.getExpirationStartTimestamp()).to.equal(undefined);
    expect(message.getExpiresAt()).to.equal(undefined);
  });
});
