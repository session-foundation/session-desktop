import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import _ from 'lodash';
import { StagedAttachmentType } from '../../components/conversation/composition/CompositionBox';
import { WithConvoId } from '../../session/types/with';

export type StagedAttachmentsStateType = {
  stagedAttachments: { [conversationKey: string]: Array<StagedAttachmentType> };
};

// Reducer

export function getEmptyStagedAttachmentsState(): StagedAttachmentsStateType {
  return {
    stagedAttachments: {},
  };
}

const stagedAttachmentsSlice = createSlice({
  name: 'stagedAttachments',
  initialState: getEmptyStagedAttachmentsState(),
  reducers: {
    addStagedAttachmentsInConversation(
      state: StagedAttachmentsStateType,
      action: PayloadAction<{
        conversationKey: string;
        newAttachments: Array<StagedAttachmentType>;
      }>
    ) {
      const { conversationKey, newAttachments } = action.payload;
      if (newAttachments.length === 0) {
        return state;
      }
      const currentStagedAttachments = state.stagedAttachments[conversationKey] || [];

      const hasCurrentVoiceMessage = currentStagedAttachments.some(a => a.isVoiceMessage);
      const hasNewVoiceMessage = newAttachments.some(a => a.isVoiceMessage);

      if (
        (hasNewVoiceMessage &&
          (currentStagedAttachments.length > 0 || newAttachments.length > 1)) ||
        (hasCurrentVoiceMessage && newAttachments.length > 0)
      ) {
        window?.log?.warn(
          'Only one voice note can be staged, and it cannot be mixed with other attachments'
        );
        return state;
      }

      const allAttachments = _.concat(currentStagedAttachments, newAttachments);
      const uniqAttachments = _.uniqBy(allAttachments, m => m.stagedAttachmentId);

      state.stagedAttachments[conversationKey] = uniqAttachments;
      return state;
    },
    removeAllStagedAttachmentsInConversation(
      state: StagedAttachmentsStateType,
      action: PayloadAction<WithConvoId>
    ) {
      const { conversationId } = action.payload;

      const currentStagedAttachments = state.stagedAttachments[conversationId];
      if (!currentStagedAttachments || _.isEmpty(currentStagedAttachments)) {
        return state;
      }
      currentStagedAttachments.forEach(attachment => {
        if (attachment.url) {
          URL.revokeObjectURL(attachment.url);
        }
        if (attachment.videoUrl) {
          URL.revokeObjectURL(attachment.videoUrl);
        }
      });

      delete state.stagedAttachments[conversationId];
      return state;
    },
    removeStagedAttachmentInConversation(
      state: StagedAttachmentsStateType,
      action: PayloadAction<{ conversationKey: string; stagedAttachmentId: string }>
    ) {
      const { conversationKey, stagedAttachmentId } = action.payload;

      const currentStagedAttachments = state.stagedAttachments[conversationKey];

      if (!currentStagedAttachments || _.isEmpty(currentStagedAttachments)) {
        return state;
      }
      const attachmentToRemove = currentStagedAttachments.find(
        m => m.stagedAttachmentId === stagedAttachmentId
      );

      if (!attachmentToRemove) {
        return state;
      }

      if (attachmentToRemove.url) {
        URL.revokeObjectURL(attachmentToRemove.url);
      }
      if (attachmentToRemove.videoUrl) {
        URL.revokeObjectURL(attachmentToRemove.videoUrl);
      }
      state.stagedAttachments[conversationKey] = state.stagedAttachments[conversationKey].filter(
        a => a.stagedAttachmentId !== stagedAttachmentId
      );
      return state;
    },
  },
});

export const { actions, reducer } = stagedAttachmentsSlice;
export const {
  addStagedAttachmentsInConversation,
  removeAllStagedAttachmentsInConversation,
  removeStagedAttachmentInConversation,
} = actions;
