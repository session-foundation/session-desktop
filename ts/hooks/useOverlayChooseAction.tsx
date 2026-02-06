import { useCallback } from 'react';
import { PubkeyType } from 'libsession_util_nodejs';
import { getAppDispatch } from '../state/dispatch';
import { sectionActions } from '../state/ducks/section';
import { groupInfoActions } from '../state/ducks/metaGroups';

export function useOverlayChooseAction() {
  const dispatch = getAppDispatch();
  const openNewMessage = useCallback(
    (conversationId?: string) => {
      dispatch(
        sectionActions.setLeftOverlayMode({
          type: 'message',
          params: { initialInputValue: conversationId ?? '' },
        })
      );
    },
    [dispatch]
  );

  const openCreateGroup = useCallback(
    (groupName?: string, members?: Array<PubkeyType>) => {
      dispatch(
        sectionActions.setLeftOverlayMode({
          type: 'closed-group',
          params: { initialInputValue: groupName ?? '' },
        })
      );
      dispatch(groupInfoActions.updateGroupCreationName({ name: groupName ?? '' }));
      dispatch(groupInfoActions.setSelectedGroupMembers({ membersToSet: members ?? [] }));
    },
    [dispatch]
  );

  const openJoinCommunity = useCallback(
    (communityUrl?: string) => {
      dispatch(
        sectionActions.setLeftOverlayMode({
          type: 'open-group',
          params: { initialInputValue: communityUrl ?? '' },
        })
      );
    },
    [dispatch]
  );

  const inviteAFriend = useCallback(() => {
    dispatch(sectionActions.setLeftOverlayMode({ type: 'invite-a-friend', params: null }));
  }, [dispatch]);

  return {
    openNewMessage,
    openCreateGroup,
    openJoinCommunity,
    inviteAFriend,
  };
}
