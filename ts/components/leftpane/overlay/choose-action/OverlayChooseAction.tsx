import { useEffect } from 'react';

import { isEmpty, isString } from 'lodash';
import { getAppDispatch } from '../../../../state/dispatch';
import { SpacerSM } from '../../../basic/Text';
import { StyledLeftPaneOverlay } from '../OverlayMessage';
import { ActionRow, StyledActionRowContainer } from './ActionRow';
import { ContactsListWithBreaks } from './ContactsListWithBreaks';
import { sectionActions } from '../../../../state/ducks/section';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';
import { tr } from '../../../../localization/localeTools';
import { useIsInScope } from '../../../../state/focus';
import { useLeftOverlayModeType } from '../../../../state/selectors/section';
import { useOverlayChooseAction } from '../../../../hooks/useOverlayChooseAction';
import { useEscBlurThenHandler } from '../../../../hooks/useKeyboardShortcut';

function useChooseActionOnPaste() {
  const { openNewMessage, openJoinCommunity } = useOverlayChooseAction();
  const inScope = useIsInScope({ scope: 'conversationList' });
  const leftOverlayMode = useLeftOverlayModeType();

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      if (!inScope) {
        return;
      }
      const pasted = event.clipboardData?.getData('text');

      if (pasted && isString(pasted) && !isEmpty(pasted)) {
        if (pasted.startsWith('http') || pasted.startsWith('https')) {
          if (leftOverlayMode !== 'open-group') {
            openJoinCommunity(pasted);
            event.preventDefault();
          }
        } else if (pasted.startsWith('05')) {
          if (leftOverlayMode !== 'message') {
            openNewMessage(pasted);
            event.preventDefault();
          }
        }
      }
    }
    document.addEventListener('paste', handlePaste);

    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [inScope, leftOverlayMode, openNewMessage, openJoinCommunity]);
}

// NOTE: [react-compiler] this has to live here for the hook to be identified as static
function useOverlayChooseActionWrapper() {
  return useOverlayChooseAction();
}

export const OverlayChooseAction = () => {
  const dispatch = getAppDispatch();
  const { openNewMessage, openCreateGroup, openJoinCommunity, inviteAFriend } =
    useOverlayChooseActionWrapper();
  useChooseActionOnPaste();

  function closeOverlay() {
    dispatch(sectionActions.resetLeftOverlayMode());
  }

  useEscBlurThenHandler(closeOverlay);

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
          title={tr('messageNew', { count: 1 })}
          ariaLabel={'New message button'}
          unicode={LUCIDE_ICONS_UNICODE.MESSAGE_SQUARE}
          onClick={() => openNewMessage()}
          dataTestId="chooser-new-conversation-button"
        />
        <ActionRow
          title={tr('groupCreate')}
          ariaLabel={'Create a group button'}
          unicode={LUCIDE_ICONS_UNICODE.USERS_ROUND}
          onClick={() => openCreateGroup()}
          dataTestId="chooser-new-group"
        />
        <ActionRow
          title={tr('communityJoin')}
          ariaLabel={'Join a community button'}
          unicode={LUCIDE_ICONS_UNICODE.GLOBE}
          onClick={() => openJoinCommunity()}
          dataTestId="chooser-new-community"
        />
        <ActionRow
          title={tr('sessionInviteAFriend')}
          ariaLabel={'Invite a friend button'}
          unicode={LUCIDE_ICONS_UNICODE.USER_ROUND_PLUS}
          onClick={() => inviteAFriend()}
          dataTestId="chooser-invite-friend"
        />
      </StyledActionRowContainer>
      <SpacerSM />
      <ContactsListWithBreaks />
    </StyledLeftPaneOverlay>
  );
};
