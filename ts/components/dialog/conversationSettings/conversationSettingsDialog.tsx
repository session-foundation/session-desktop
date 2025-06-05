import { AnimatePresence } from 'framer-motion';
import styled from 'styled-components';
import { useDispatch } from 'react-redux';
import { noop } from 'lodash';

import { Flex } from '../../basic/Flex';
import { SessionWrapperModal2 } from '../../SessionWrapperModal2';
import {
  updateConversationSettingsModal,
  type ConversationSettingsModalPage,
  type ConversationSettingsModalState,
} from '../../../state/ducks/modalDialog';
import { localize } from '../../../localization/localeTools';
import { DisappearingMessagesPage } from './pages/disappearing-messages/DisappearingMessagesPage';
import { DefaultConversationSettingsPage } from './pages/default/defaultPage';
import { assertUnreachable } from '../../../types/sqlSharedTypes';
import { NotificationsPage } from './pages/notifications/NotificationPage';
import { useShowConversationSettingsFor } from '../../menuAndSettingsHooks/useShowConversationSettingsFor';

const StyledContent = styled(Flex)`
  /* position: absolute; */
  /* top: 10vh;
  max-height: 80vh; */
`;

function useTitleFromPage(page: ConversationSettingsModalPage | undefined) {
  switch (page) {
    case 'disappearing_message':
      return localize('disappearingMessages').toString();
    case 'notifications':
      return localize('sessionNotifications').toString();
    case 'default':
    case undefined:
      return localize('sessionSettings').toString();
    default:
      assertUnreachable(page, "useTitleFromPage doesn't support this page");
      throw new Error('useTitleFromPage does not support this page');
  }
}

function useCloseActionFromPage(props: ConversationSettingsModalState) {
  const dispatch = useDispatch();
  const showConvoSettingsCb = useShowConversationSettingsFor(props?.conversationId);
  if (!props?.conversationId || !showConvoSettingsCb) {
    return noop;
  }
  switch (props.settingsModalPage) {
    case 'disappearing_message':
    case 'notifications':
      return props.standalonePage
        ? () => dispatch(updateConversationSettingsModal(null))
        : () =>
            showConvoSettingsCb?.({
              settingsModalPage: 'default',
            });

    default:
      return () => dispatch(updateConversationSettingsModal(null));
  }
}

function useBackButtonForPage(modalState: ConversationSettingsModalState) {
  const showConvoSettingsCb = useShowConversationSettingsFor(modalState?.conversationId);

  if (
    !modalState?.settingsModalPage ||
    modalState?.settingsModalPage === 'default' ||
    modalState?.standalonePage ||
    !showConvoSettingsCb
  ) {
    // no back button if we are on the default page or if the page is standalone
    return undefined;
  }

  return [
    {
      iconType: 'chevron' as const,
      iconRotation: 90,
      onClick: () => {
        showConvoSettingsCb({
          settingsModalPage: 'default',
        });
      },
    },
  ];
}

export function ConversationSettingsDialog(props: ConversationSettingsModalState) {
  const onClose = useCloseActionFromPage(props);
  const title = useTitleFromPage(props?.settingsModalPage);
  const backButton = useBackButtonForPage(props);

  if (!props?.conversationId) {
    return null;
  }

  const modalPage = props.settingsModalPage;

  const PageToRender =
    !props || modalPage === 'default'
      ? DefaultConversationSettingsPage
      : modalPage === 'notifications'
        ? NotificationsPage
        : DisappearingMessagesPage;

  return (
    <AnimatePresence>
      <SessionWrapperModal2
        title={title}
        onClose={onClose}
        showExitIcon={!backButton}
        contentBorder={false}
        shouldOverflow={true}
        allowOutsideClick={false}
        headerIconButtons={backButton}
        $contentMinWidth="400px"
      >
        <StyledContent
          $container={true}
          $flexDirection="column"
          $alignItems="flex-start"
          padding="var(--margins-sm) 0"
          width="100%"
        >
          <PageToRender conversationId={props.conversationId} />
        </StyledContent>
      </SessionWrapperModal2>
    </AnimatePresence>
  );
}
