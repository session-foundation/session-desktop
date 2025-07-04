import { useCallback, useEffect } from 'react';

import { isEmpty, isString } from 'lodash';
import { useDispatch } from 'react-redux';
import useKey from 'react-use/lib/useKey';
import { SpacerSM } from '../../../basic/Text';
import { StyledLeftPaneOverlay } from '../OverlayMessage';
import { ActionRow, StyledActionRowContainer } from './ActionRow';
import { ContactsListWithBreaks } from './ContactsListWithBreaks';
import { groupInfoActions } from '../../../../state/ducks/metaGroups';
import { sectionActions } from '../../../../state/ducks/section';
import { localize } from '../../../../localization/localeTools';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';

export const OverlayChooseAction = () => {
  const dispatch = useDispatch();

  function closeOverlay() {
    dispatch(sectionActions.resetLeftOverlayMode());
  }

  const openNewMessage = useCallback(() => {
    dispatch(sectionActions.setLeftOverlayMode('message'));
  }, [dispatch]);

  const openCreateGroup = useCallback(() => {
    dispatch(sectionActions.setLeftOverlayMode('closed-group'));
    dispatch(groupInfoActions.updateGroupCreationName({ name: '' }));
    dispatch(groupInfoActions.setSelectedGroupMembers({ membersToSet: [] }));
  }, [dispatch]);

  const openJoinCommunity = useCallback(() => {
    dispatch(sectionActions.setLeftOverlayMode('open-group'));
  }, [dispatch]);

  const inviteAFriend = useCallback(() => {
    dispatch(sectionActions.setLeftOverlayMode('invite-a-friend'));
  }, [dispatch]);

  useKey('Escape', closeOverlay);

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      event.preventDefault();

      const pasted = event.clipboardData?.getData('text');

      if (pasted && isString(pasted) && !isEmpty(pasted)) {
        if (pasted.startsWith('http') || pasted.startsWith('https')) {
          openJoinCommunity();
        } else if (pasted.startsWith('05')) {
          openNewMessage();
        }
      }
    }
    document?.addEventListener('paste', handlePaste);

    return () => {
      document?.removeEventListener('paste', handlePaste);
    };
  }, [openJoinCommunity, openNewMessage]);

  return (
    <StyledLeftPaneOverlay
      $container={true}
      $flexDirection={'column'}
      $flexGrow={1}
      $alignItems={'center'}
    >
      <StyledActionRowContainer
        $container={true}
        $flexDirection={'column'}
        $justifyContent={'flex-start'}
        $alignItems={'flex-start'}
      >
        <ActionRow
          title={localize('messageNew').withArgs({ count: 1 }).toString()}
          ariaLabel={'New message button'}
          unicode={LUCIDE_ICONS_UNICODE.MESSAGE_SQUARE}
          onClick={openNewMessage}
          dataTestId="chooser-new-conversation-button"
        />
        <ActionRow
          title={localize('groupCreate').toString()}
          ariaLabel={'Create a group button'}
          unicode={LUCIDE_ICONS_UNICODE.USERS_ROUND}
          onClick={openCreateGroup}
          dataTestId="chooser-new-group"
        />
        <ActionRow
          title={localize('communityJoin').toString()}
          ariaLabel={'Join a community button'}
          unicode={LUCIDE_ICONS_UNICODE.GLOBE}
          onClick={openJoinCommunity}
          dataTestId="chooser-new-community"
        />
        <ActionRow
          title={localize('sessionInviteAFriend').toString()}
          ariaLabel={'Invite a friend button'}
          unicode={LUCIDE_ICONS_UNICODE.USER_ROUND_PLUS}
          onClick={inviteAFriend}
          dataTestId="chooser-invite-friend"
        />
      </StyledActionRowContainer>
      <SpacerSM />
      <ContactsListWithBreaks />
    </StyledLeftPaneOverlay>
  );
};
