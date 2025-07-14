import { useEffect } from 'react';
import { useSelector } from 'react-redux';

import styled from 'styled-components';
import { useConversationUsername } from '../../hooks/useParamSelector';
import { CallManager } from '../../session/utils';
import { ed25519Str } from '../../session/utils/String';
import { callTimeoutMs } from '../../session/utils/calling/CallManager';
import { getHasIncomingCall, getHasIncomingCallFrom } from '../../state/selectors/call';
import { Avatar, AvatarSize } from '../avatar/Avatar';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { tr } from '../../localization/localeTools';
import {
  ModalBasicHeader,
  ModalActionsContainer,
  SessionWrapperModal,
} from '../SessionWrapperModal';

export const CallWindow = styled.div`
  position: absolute;
  z-index: 9;
  padding: 1rem;
  top: 50vh;
  left: 50vw;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  background-color: var(--modal-background-content-color);
  border: 1px solid var(--border-color);
`;

const IncomingCallAvatarContainer = styled.div`
  padding: 15px;
`;

export const IncomingCallDialog = () => {
  const hasIncomingCall = useSelector(getHasIncomingCall);
  const incomingCallFromPubkey = useSelector(getHasIncomingCallFrom);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (incomingCallFromPubkey) {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      timeout = global.setTimeout(async () => {
        if (incomingCallFromPubkey) {
          window.log.info(
            `call missed with ${ed25519Str(
              incomingCallFromPubkey
            )} as the dialog was not interacted with for ${callTimeoutMs} ms`
          );
          await CallManager.USER_rejectIncomingCallRequest(incomingCallFromPubkey);
        }
      }, callTimeoutMs);
    }

    return () => {
      if (timeout) {
        global.clearTimeout(timeout);
      }
    };
  }, [incomingCallFromPubkey]);

  // #region input handlers
  const handleAcceptIncomingCall = async () => {
    if (incomingCallFromPubkey) {
      await CallManager.USER_acceptIncomingCallRequest(incomingCallFromPubkey);
    }
  };

  const handleDeclineIncomingCall = async () => {
    // close the modal
    if (incomingCallFromPubkey) {
      await CallManager.USER_rejectIncomingCallRequest(incomingCallFromPubkey);
    }
  };
  const from = useConversationUsername(incomingCallFromPubkey);
  if (!hasIncomingCall || !incomingCallFromPubkey) {
    return null;
  }
  // #endregion

  if (hasIncomingCall) {
    return (
      <SessionWrapperModal
        headerChildren={
          <ModalBasicHeader
            title={tr('callsIncoming', { name: from ?? tr('unknown') })}
          />
        }
        buttonChildren={
          <ModalActionsContainer>
            <SessionButton
              text={tr('accept')}
              buttonType={SessionButtonType.Simple}
              onClick={handleAcceptIncomingCall}
              buttonColor={SessionButtonColor.Danger}
            />
            <SessionButton
              text={tr('decline')}
              buttonType={SessionButtonType.Simple}
              onClick={handleDeclineIncomingCall}
            />
          </ModalActionsContainer>
        }
      >
        <IncomingCallAvatarContainer>
          <Avatar size={AvatarSize.XL} pubkey={incomingCallFromPubkey} />
        </IncomingCallAvatarContainer>
      </SessionWrapperModal>
    );
  }
  // display spinner while connecting
  return null;
};
