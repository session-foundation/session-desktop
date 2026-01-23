import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { LUCIDE_ICONS_UNICODE } from '../../components/icon/lucide';
import type { TrArgs } from '../../localization/localeTools';

const debNeedsBreakingUpdate = 'debNeedsBreakingUpdate';

type AnnouncementKeys = typeof debNeedsBreakingUpdate;

export type Announcement = {
  key: AnnouncementKeys;
  timestamp: number;
  titleArgs: TrArgs;
  descriptionArgs: TrArgs;
  link?: string;
};

export type AnnouncementsState = {
  details: Array<Announcement>;
};

export const initialAnnouncementState: AnnouncementsState = {
  details: [],
};

export const announcementSlice = createSlice({
  name: 'announcements',
  initialState: initialAnnouncementState,
  reducers: {
    addDebNeedsBreakingUpdate(state, action: PayloadAction<boolean>) {
      const foundAt = state.details.findIndex(a => a.key === debNeedsBreakingUpdate);

      if (!action.payload) {
        if (foundAt !== -1) {
          state.details.splice(foundAt, 1);
        }
        return;
      }

      if (foundAt === -1) {
        state.details.push({
          key: debNeedsBreakingUpdate,
          timestamp: Date.now(),
          titleArgs: { token: 'announcementDebBreakingUpdateTitle' as const },
          descriptionArgs: {
            token: 'announcementDebBreakingUpdateDescription' as const,
            icon: LUCIDE_ICONS_UNICODE.EXTERNAL_LINK_ICON,
          },
          link: 'https://getsession.org/rotating-keys-for-session-repos',
        });
      }
    },
    closeByKey(state, action: PayloadAction<AnnouncementKeys>) {
      const foundAt = state.details.findIndex(a => a.key === action.payload);

      if (foundAt === -1) {
        return;
      }

      state.details.splice(foundAt, 1);
    },
  },
});

export default announcementSlice.reducer;
export const announcementActions = {
  ...announcementSlice.actions,
};
