import chai from 'chai';

import { shouldScrollAfterSend } from '../../../../../components/conversation/shouldScrollAfterSend';

const { expect } = chai;

describe('shouldScrollAfterSend', () => {
  it('allows scrolling when the sent conversation is still selected', () => {
    expect(
      shouldScrollAfterSend({
        selectedConversationKey: 'conversation-a',
        sentConversationId: 'conversation-a',
      })
    ).to.equal(true);
  });

  it('does not allow scrolling when another conversation is selected', () => {
    expect(
      shouldScrollAfterSend({
        selectedConversationKey: 'conversation-b',
        sentConversationId: 'conversation-a',
      })
    ).to.equal(false);
  });

  it('does not allow scrolling without a sent conversation id', () => {
    expect(
      shouldScrollAfterSend({
        selectedConversationKey: 'conversation-a',
        sentConversationId: undefined,
      })
    ).to.equal(false);
  });
});
