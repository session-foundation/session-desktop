import { expect } from 'chai';
import Sinon from 'sinon';

import {
  addStagedAttachmentsInConversation,
  getEmptyStagedAttachmentsState,
  reducer,
  removeStagedAttachmentInConversation,
} from '../../../../state/ducks/stagedAttachments';
import type { StagedAttachmentType } from '../../../../components/conversation/composition/CompositionBox';

const conversationKey = 'conversation-key';

function makeAttachment({
  stagedAttachmentId,
  fileName,
  url = '',
  videoUrl,
  isVoiceMessage = false,
}: {
  stagedAttachmentId: string;
  fileName: string;
  url?: string;
  videoUrl?: string;
  isVoiceMessage?: boolean;
}): StagedAttachmentType {
  return {
    stagedAttachmentId,
    file: {} as File,
    contentType: 'image/jpeg',
    fileName,
    url,
    videoUrl,
    fileSize: null,
    isVoiceMessage,
    screenshot: null,
    thumbnail: null,
  };
}

describe('state/ducks/stagedAttachments', () => {
  beforeEach(() => {
    (global as any).window = {
      log: {
        warn: Sinon.stub(),
      },
    };

    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = () => undefined;
    }

    Sinon.stub(URL, 'revokeObjectURL');
  });

  afterEach(() => {
    Sinon.restore();
    delete (global as any).window;
  });

  it('keeps staged attachments with the same filename when their staged ids differ', () => {
    const first = makeAttachment({
      stagedAttachmentId: 'first',
      fileName: 'image.jpg',
      url: 'blob:first',
    });
    const second = makeAttachment({
      stagedAttachmentId: 'second',
      fileName: 'image.jpg',
      url: 'blob:second',
    });

    const state = reducer(
      getEmptyStagedAttachmentsState(),
      addStagedAttachmentsInConversation({
        conversationKey,
        newAttachments: [first, second],
      })
    );

    expect(state.stagedAttachments[conversationKey].map(attachment => attachment.url)).to.deep.eq([
      'blob:first',
      'blob:second',
    ]);
  });

  it('removes only the staged attachment matching the staged id', () => {
    const first = makeAttachment({
      stagedAttachmentId: 'first',
      fileName: 'image.jpg',
      url: 'blob:first',
    });
    const second = makeAttachment({
      stagedAttachmentId: 'second',
      fileName: 'image.jpg',
      url: 'blob:second',
      videoUrl: 'blob:second-video',
    });

    const stateWithAttachments = reducer(
      getEmptyStagedAttachmentsState(),
      addStagedAttachmentsInConversation({
        conversationKey,
        newAttachments: [first, second],
      })
    );

    const state = reducer(
      stateWithAttachments,
      removeStagedAttachmentInConversation({
        conversationKey,
        stagedAttachmentId: 'second',
      })
    );

    const revokedUrls = (URL.revokeObjectURL as Sinon.SinonStub)
      .getCalls()
      .map(call => call.args[0]);

    expect(
      state.stagedAttachments[conversationKey].map(attachment => attachment.stagedAttachmentId)
    ).to.deep.eq(['first']);
    expect(revokedUrls).to.deep.eq(['blob:second', 'blob:second-video']);
  });

  it('does not add a voice message with another staged attachment', () => {
    const currentAttachment = makeAttachment({
      stagedAttachmentId: 'current',
      fileName: 'image.jpg',
    });
    const voiceAttachment = makeAttachment({
      stagedAttachmentId: 'voice',
      fileName: 'session-audio-message',
      isVoiceMessage: true,
    });

    const stateWithAttachment = reducer(
      getEmptyStagedAttachmentsState(),
      addStagedAttachmentsInConversation({
        conversationKey,
        newAttachments: [currentAttachment],
      })
    );

    const state = reducer(
      stateWithAttachment,
      addStagedAttachmentsInConversation({
        conversationKey,
        newAttachments: [voiceAttachment],
      })
    );

    expect(
      state.stagedAttachments[conversationKey].map(attachment => attachment.stagedAttachmentId)
    ).to.deep.eq(['current']);
    expect((global as any).window.log.warn.calledOnce).to.eq(true);
  });

  it('does not add multiple voice messages at once', () => {
    const firstVoiceAttachment = makeAttachment({
      stagedAttachmentId: 'first-voice',
      fileName: 'session-audio-message',
      isVoiceMessage: true,
    });
    const secondVoiceAttachment = makeAttachment({
      stagedAttachmentId: 'second-voice',
      fileName: 'session-audio-message',
      isVoiceMessage: true,
    });

    const state = reducer(
      getEmptyStagedAttachmentsState(),
      addStagedAttachmentsInConversation({
        conversationKey,
        newAttachments: [firstVoiceAttachment, secondVoiceAttachment],
      })
    );

    expect(state.stagedAttachments[conversationKey]).to.eq(undefined);
    expect((global as any).window.log.warn.calledOnce).to.eq(true);
  });

  it('does not add another attachment when a voice message is already staged', () => {
    const voiceAttachment = makeAttachment({
      stagedAttachmentId: 'voice',
      fileName: 'session-audio-message',
      isVoiceMessage: true,
    });
    const nextAttachment = makeAttachment({
      stagedAttachmentId: 'next',
      fileName: 'image.jpg',
    });

    const stateWithVoiceMessage = reducer(
      getEmptyStagedAttachmentsState(),
      addStagedAttachmentsInConversation({
        conversationKey,
        newAttachments: [voiceAttachment],
      })
    );

    const state = reducer(
      stateWithVoiceMessage,
      addStagedAttachmentsInConversation({
        conversationKey,
        newAttachments: [nextAttachment],
      })
    );

    expect(
      state.stagedAttachments[conversationKey].map(attachment => attachment.stagedAttachmentId)
    ).to.deep.eq(['voice']);
    expect((global as any).window.log.warn.calledOnce).to.eq(true);
  });
});
