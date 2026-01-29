import { createSlice, PayloadAction } from '@reduxjs/toolkit';
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
