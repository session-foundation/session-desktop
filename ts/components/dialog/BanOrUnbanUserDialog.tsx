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
import {
  BanType,
  isBan,
  isServerBanUnban,
  updateBanOrUnbanUserModal,
} from '../../state/ducks/modalDialog';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SessionSpinner } from '../loading';
import {
  ModalBasicHeader,
  ModalActionsContainer,
  SessionWrapperModal,
  WrapperModalWidth,
} from '../SessionWrapperModal';
import { tr } from '../../localization/localeTools';
import { SimpleSessionInput } from '../inputs/SessionInput';
import { ModalDescription } from './shared/ModalDescriptionContainer';
import { ModalFlexContainer } from './shared/ModalFlexContainer';
import { SessionToggle } from '../basic/SessionToggle';
import { getFeatureFlag } from '../../state/ducks/types/releasedFeaturesReduxTypes';
import { Flex } from '../basic/Flex';

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
    const isChangeApplied = isBan(banType)
      ? await sogsV3BanUser({
          userToBan: pubkey,
          roomInfos,
          deleteAllMessages: deleteAll,
          banType,
        })
      : await sogsV3UnbanUser({
          userToUnban: pubkey,
          roomInfos,
          banType,
        });

    if (!isChangeApplied) {
      window?.log?.warn(`failed to ${banType} user: ${isChangeApplied}`);

      switch (banType) {
        case 'ban':
          ToastUtils.pushUserBanFailure();
          break;
        case 'unban':
          ToastUtils.pushGlobalUserBanFailure();
          break;
        case 'server-ban':
          ToastUtils.pushUserUnbanFailure();
          break;
        case 'server-unban':
          ToastUtils.pushGlobalUserUnbanFailure();
          break;
        default:
          throw new Error('Unknown banType');
      }
      return false;
    }
    window?.log?.info(`${pubkey.key} user ${banType}ned successfully...`);

    if (isBan(banType)) {
      ToastUtils.pushUserBanSuccess();
    } else {
      ToastUtils.pushUserUnbanSuccess();
    }
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
  const dispatch = getAppDispatch();
  const convo = ConvoHub.use().get(conversationId);
  const inputRef = useRef(null);

  useFocusMount(inputRef, true);
  const [inputBoxValue, setInputBoxValue] = useState('');
  const [inProgress, setInProgress] = useState(false);
  const [localBanType, setLocalBanType] = useState(banType);

  const isServerWide = isServerBanUnban(localBanType);
  const isBanAction = isBan(localBanType);

  const displayName = useConversationUsernameWithFallback(true, pubkey);
  const hasPubkeyOnLoad = pubkey?.length;

  const inputTextToDisplay =
    !!pubkey && displayName ? `${displayName} ${PubKey.shorten(pubkey)}` : undefined;

  /**
   * Ban or Unban a user from a community
   * @param deleteAll Delete all messages for that user in the community (only works with ban)
   */
  const banOrUnBanUser = async (deleteAll: boolean) => {
    const castedPubkey = pubkey?.length ? pubkey : inputBoxValue;

    window?.log?.info(
      `asked to ${localBanType} user: ${castedPubkey}, banAndDeleteAll:${deleteAll}`
    );
    setInProgress(true);
    const isBanned = await banOrUnBanUserCall(convo, castedPubkey, localBanType, deleteAll);
    if (isBanned) {
      // clear input box
      setInputBoxValue('');
      if (pubkey) {
        dispatch(updateBanOrUnbanUserModal(null));
      }
    }

    setInProgress(false);
  };

  const serverHost = new window.URL(convo.toOpenGroupV2().serverUrl).host;
  const serverWideSuffix = isServerWide ? ` @ ${serverHost}` : '';
  const title = `${isBanAction ? tr('banUser') : tr('banUnbanUser')}${serverWideSuffix}`;

  /**
   * Starts procedure for banning/unbanning user and all their messages using dialog
   */
  const startBanAndDeleteAllSequence = async () => {
    await banOrUnBanUser(true);
  };

  const onClose = () => {
    dispatch(updateBanOrUnbanUserModal(null));
  };

  let buttonText = '';

  if (isServerWide) {
    if (isBanAction) {
      buttonText = tr('serverBanUserDev');
    } else {
      buttonText = tr('serverUnbanUserDev');
    }
  } else if (isBanAction) {
    buttonText = tr('banUser');
  } else {
    buttonText = tr('banUnbanUser');
  }

  return (
    <SessionWrapperModal
      modalId="banOrUnbanUserModal"
      $contentMinWidth={isServerWide ? WrapperModalWidth.wide : undefined}
      $contentMaxWidth={isServerWide ? WrapperModalWidth.wide : undefined}
      headerChildren={<ModalBasicHeader title={title} />}
      onClose={onClose}
      buttonChildren={
        <ModalActionsContainer
          buttonType={SessionButtonType.Simple}
          style={{ maxWidth: isServerWide ? '600px' : undefined }}
        >
          <SessionButton
            buttonType={SessionButtonType.Simple}
            onClick={banOrUnBanUser}
            text={buttonText}
            disabled={inProgress}
            buttonColor={isBanAction && !hasPubkeyOnLoad ? SessionButtonColor.Danger : undefined}
            dataTestId={isBanAction ? 'ban-user-confirm-button' : 'unban-user-confirm-button'}
          />
          {/*
           * Note: we can only ban-and-delete-all when we have a pubkey on load currently.
           * The reason is that there is an issue (sogs side), and the server won't lookup a blindedId from a
           * sessionID, for the delete_all endpoint specifically.
           * When hasPubkeyOnLoad is true, the dialog was shown from a right click on the messages list,
           * so we do have the blindedId already in this case.
           */}
          {isBanAction && hasPubkeyOnLoad ? (
            <SessionButton
              buttonType={SessionButtonType.Simple}
              buttonColor={SessionButtonColor.Danger}
              onClick={startBanAndDeleteAllSequence}
              text={isServerWide ? tr('serverBanUserAndDeleteAllDev') : tr('banDeleteAll')}
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
          localizerProps={{ token: isBanAction ? 'banUserDescription' : 'banUnbanUserDescription' }}
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
          inputDataTestId={isBanAction ? 'ban-user-input' : 'unban-user-input'}
        />
        {getFeatureFlag('useDevCommunityActions') ? (
          <Flex
            $container={true}
            $justifyContent="space-between"
            $alignItems="center"
            $flexGap="var(--margins-sm)"
          >
            <p>Server-wide:</p>
            <SessionToggle
              active={isServerWide}
              onClick={() => {
                const withoutServer = localBanType.replace('server-', '') as BanType;
                const withServer = `server-${withoutServer}` as BanType;
                setLocalBanType(isServerWide ? withoutServer : withServer);
              }}
            />
          </Flex>
        ) : null}
        <SessionSpinner $loading={inProgress} />
      </ModalFlexContainer>
    </SessionWrapperModal>
  );
};
