import { useState } from 'react';
import { getAppDispatch } from '../../state/dispatch';
import { useMessageReactsPropsById } from '../../hooks/useParamSelector';
import { clearSogsReactionByServerId } from '../../session/apis/open_group_api/sogsv3/sogsV3ClearReaction';
import { ConvoHub } from '../../session/conversations';
import { updateReactClearAllModal } from '../../state/ducks/modalDialog';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SessionSpinner } from '../loading';
import {
  ModalBasicHeader,
  ModalActionsContainer,
  SessionWrapperModal,
} from '../SessionWrapperModal';
import { ModalDescription } from './shared/ModalDescriptionContainer';
import { ModalFlexContainer } from './shared/ModalFlexContainer';
import { tr } from '../../localization/localeTools';

type Props = {
  reaction: string;
  messageId: string;
};

export const ReactClearAllModal = (props: Props) => {
  const { reaction, messageId } = props;

  const [clearingInProgress, setClearingInProgress] = useState(false);

  const dispatch = getAppDispatch();
  const msgProps = useMessageReactsPropsById(messageId);

  if (!msgProps) {
    return null;
  }

  const { convoId, serverId } = msgProps;
  const roomInfos = ConvoHub.use().get(convoId).toOpenGroupV2();

  const handleClose = () => {
    dispatch(updateReactClearAllModal(null));
  };

  const handleClearAll = async () => {
    if (roomInfos && serverId) {
      setClearingInProgress(true);
      await clearSogsReactionByServerId(reaction, serverId, roomInfos);
      setClearingInProgress(false);
      handleClose();
    } else {
      window.log.warn('Error for batch removal of', reaction, 'on message', messageId);
    }
  };

  return (
    <SessionWrapperModal
      modalId="reactClearAllModal"
      onClose={handleClose}
      headerChildren={<ModalBasicHeader title={tr('clearAll')} />}
      buttonChildren={
        <ModalActionsContainer buttonType={SessionButtonType.Simple}>
          <SessionButton
            text={tr('clear')}
            buttonColor={SessionButtonColor.Danger}
            buttonType={SessionButtonType.Simple}
            onClick={handleClearAll}
            disabled={clearingInProgress}
          />
          <SessionButton
            text={tr('cancel')}
            buttonType={SessionButtonType.Simple}
            onClick={handleClose}
            disabled={clearingInProgress}
          />
        </ModalActionsContainer>
      }
    >
      <ModalFlexContainer>
        <ModalDescription
          dataTestId="modal-description"
          localizerProps={{ token: 'emojiReactsClearAll', emoji: reaction }}
        />

        <SessionSpinner $loading={clearingInProgress} />
      </ModalFlexContainer>
    </SessionWrapperModal>
  );
};
