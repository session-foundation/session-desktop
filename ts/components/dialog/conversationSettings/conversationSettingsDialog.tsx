import { AnimatePresence } from 'framer-motion';
import styled from 'styled-components';
import { useDispatch } from 'react-redux';
import { Flex } from '../../basic/Flex';
import { SessionWrapperModal2 } from '../../SessionWrapperModal2';
import {
  updateConversationSettingsModal,
  type ConversationSettingsModalState,
} from '../../../state/ducks/modalDialog';
import { localize } from '../../../localization/localeTools';
import { ConversationSettingsHeader } from './conversationSettingsHeader';

const StyledContent = styled(Flex)``;

export function ConversationSettingsDialog(props: ConversationSettingsModalState) {
  const dispatch = useDispatch();

  const onClose = () => {
    dispatch(updateConversationSettingsModal(null));
  };

  if (!props?.conversationId) {
    return null;
  }

  return (
    <AnimatePresence>
      <SessionWrapperModal2
        title={localize('sessionSettings').toString()}
        onClose={onClose}
        showExitIcon={true}
        contentBorder={false}
        contentWidth={'75%'}
        shouldOverflow={true}
        allowOutsideClick={false}
      >
        <StyledContent
          $container={true}
          $flexDirection="column"
          $alignItems="flex-start"
          padding="var(--margins-sm) 0"
        >
          <ConversationSettingsHeader conversationId={props.conversationId} />
        </StyledContent>
      </SessionWrapperModal2>
    </AnimatePresence>
  );
}
