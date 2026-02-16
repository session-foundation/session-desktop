import { useRef, useState } from 'react';
import { getAppDispatch } from '../../state/dispatch';

import { useFocusMount } from '../../hooks/useFocusMount';
import { useConversationUsernameWithFallback } from '../../hooks/useParamSelector';
import { ConversationModel } from '../../models/conversation';
import {
  sogsV3BanUser,
  sogsV3UnbanUser,
} from '../../session/apis/open_group_api/sogsv3/sogsV3BanUnban';
import { ConvoHub } from '../../session/conversations/ConversationController';
import { PubKey } from '../../session/types';
import { ToastUtils } from '../../session/utils';
import { BanType, updateBanOrUnbanUserModal } from '../../state/ducks/modalDialog';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SessionSpinner } from '../loading';
import {
  ModalBasicHeader,
  ModalActionsContainer,
  SessionWrapperModal,
} from '../SessionWrapperModal';
import { tr } from '../../localization/localeTools';
import { SimpleSessionInput } from '../inputs/SessionInput';
import { ModalDescription } from './shared/ModalDescriptionContainer';
import { ModalFlexContainer } from './shared/ModalFlexContainer';
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut';

async function banOrUnBanUserCall(
  convo: ConversationModel,
  textValue: string,
  banType: BanType,
  deleteAll: boolean
) {
  // if we don't have valid data entered by the user
  const pubkey = PubKey.from(textValue);
  if (!pubkey) {
    window.log.info(`invalid pubkey for ${banType} user:${textValue}`);
    ToastUtils.pushInvalidPubKey();
    return false;
  }
  try {
    // this is a v2 opengroup
    const roomInfos = convo.toOpenGroupV2();
    const isChangeApplied =
      banType === 'ban'
        ? await sogsV3BanUser(pubkey, roomInfos, deleteAll)
        : await sogsV3UnbanUser(pubkey, roomInfos);

    if (!isChangeApplied) {
      window?.log?.warn(`failed to ${banType} user: ${isChangeApplied}`);

      // eslint-disable-next-line no-unused-expressions
      banType === 'ban' ? ToastUtils.pushUserBanFailure() : ToastUtils.pushUserUnbanSuccess();
      return false;
    }
    window?.log?.info(`${pubkey.key} user ${banType}ned successfully...`);
    // eslint-disable-next-line no-unused-expressions
    banType === 'ban' ? ToastUtils.pushUserBanSuccess() : ToastUtils.pushUserUnbanSuccess();
    return true;
  } catch (e) {
    window?.log?.error(`Got error while ${banType}ning user:`, e);

    return false;
  }
}

export const BanOrUnBanUserDialog = (props: {
  conversationId: string;
  banType: BanType;
  pubkey?: string;
}) => {
  const { conversationId, banType, pubkey } = props;
  const isBan = banType === 'ban';
  const dispatch = getAppDispatch();
  const convo = ConvoHub.use().get(conversationId);
  const inputRef = useRef(null);

  useFocusMount(inputRef, true);
  const [inputBoxValue, setInputBoxValue] = useState('');
  const [inProgress, setInProgress] = useState(false);

  const displayName = useConversationUsernameWithFallback(true, pubkey);

  const hasPubkeyOnLoad = pubkey?.length;

  const inputTextToDisplay =
    !!pubkey && displayName ? `${displayName} ${PubKey.shorten(pubkey)}` : undefined;

  /**
   * Ban or Unban a user from an open group
   * @param deleteAll Delete all messages for that user in the group (only works with ban)
   */
  const banOrUnBanUser = async (deleteAll: boolean) => {
    const castedPubkey = pubkey?.length ? pubkey : inputBoxValue;

    window?.log?.info(`asked to ${banType} user: ${castedPubkey}, banAndDeleteAll:${deleteAll}`);
    setInProgress(true);
    const isBanned = await banOrUnBanUserCall(convo, castedPubkey, banType, deleteAll);
    if (isBanned) {
      // clear input box
      setInputBoxValue('');
      if (pubkey) {
        dispatch(updateBanOrUnbanUserModal(null));
      }
    }

    setInProgress(false);
  };

  const title = isBan ? tr('banUser') : tr('banUnbanUser');

  /**
   * Starts procedure for banning/unbanning user and all their messages using dialog
   */
  const startBanAndDeleteAllSequence = async () => {
    await banOrUnBanUser(true);
  };

  const startBanSequence = async () => {
    await banOrUnBanUser(false);
  };

  const onClose = () => {
    dispatch(updateBanOrUnbanUserModal(null));
  };

  useKeyboardShortcut({
    shortcut: {
      keys: ['Escape'],
      name: 'Close Ban Modal',
      scope: 'banOrUnbanUserModal',
    },
    handler: onClose,
  });

  const buttonText = isBan ? tr('banUser') : tr('banUnbanUser');

  return (
    <SessionWrapperModal
      modalId="banOrUnbanUserModal"
      headerChildren={<ModalBasicHeader title={title} />}
      onClose={onClose}
      buttonChildren={
        <ModalActionsContainer buttonType={SessionButtonType.Simple}>
          <SessionButton
            buttonType={SessionButtonType.Simple}
            onClick={startBanSequence}
            text={buttonText}
            disabled={inProgress}
            buttonColor={isBan && !hasPubkeyOnLoad ? SessionButtonColor.Danger : undefined}
            dataTestId={isBan ? 'ban-user-confirm-button' : 'unban-user-confirm-button'}
          />
          {/*
           * Note: we can only ban-and-delete-all when we have a pubkey on load currently.
           * The reason is that there is an issue (sogs side), and the server won't lookup a blindedId from a
           * sessionID, for the delete_all endpoint specifically.
           * When hasPubkeyOnLoad is true, the dialog was shown from a right click on the messages list,
           * so we do have the blindedId already in this case.
           */}
          {isBan && hasPubkeyOnLoad ? (
            <SessionButton
              buttonType={SessionButtonType.Simple}
              buttonColor={SessionButtonColor.Danger}
              onClick={startBanAndDeleteAllSequence}
              text={tr('banDeleteAll')}
              disabled={inProgress}
              dataTestId="ban-user-delete-all-confirm-button"
            />
          ) : (
            <SessionButton
              buttonType={SessionButtonType.Simple}
              onClick={onClose}
              text={tr('cancel')}
              dataTestId="unban-user-cancel-button"
            />
          )}
        </ModalActionsContainer>
      }
    >
      <ModalFlexContainer>
        <ModalDescription
          dataTestId="modal-description"
          localizerProps={{ token: isBan ? 'banUserDescription' : 'banUnbanUserDescription' }}
        />

        <SimpleSessionInput
          inputRef={inputRef}
          placeholder={tr('accountId')}
          onValueChanged={setInputBoxValue}
          disabled={inProgress || !!pubkey}
          value={pubkey ? inputTextToDisplay : inputBoxValue}
          errorDataTestId="error-message"
          padding="var(--margins-sm) var(--margins-md)"
          providedError={''}
          // don't do anything on enter as we don't know if the user wants to ban or ban-delete-all
          onEnterPressed={() => {}}
          inputDataTestId={isBan ? 'ban-user-input' : 'unban-user-input'}
          allowEscapeKeyPassthrough={true}
        />
        <SessionSpinner $loading={inProgress} />
      </ModalFlexContainer>
    </SessionWrapperModal>
  );
};
