import { createSelector } from 'reselect';
import { StateType } from '../reducer';

const getAnnouncementsState = (state: StateType) => state.announcements;

export const getSortedAnnouncements = createSelector(
  [getAnnouncementsState],
  (announcements: StateType['announcements']) =>
    announcements.details.sort((a, b) => b.timestamp - a.timestamp)
);
