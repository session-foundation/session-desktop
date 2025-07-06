import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { compact } from 'lodash';

import { sogsV3AddAdmin } from '../../session/apis/open_group_api/sogsv3/sogsV3AddRemoveMods';
import { PubKey } from '../../session/types';
import { ToastUtils } from '../../session/utils';
import { ConvoHub } from '../../session/conversations';
import { updateAddModeratorsModal } from '../../state/ducks/modalDialog';
import { Flex } from '../basic/Flex';
import { SessionButton, SessionButtonType } from '../basic/SessionButton';
import { SessionSpinner } from '../loading';
import { localize } from '../../localization/localeTools';
import { I18nSubText } from '../basic/I18nSubText';
import { MAX_SUBREQUESTS_COUNT } from '../../session/apis/snode_api/SnodeRequestTypes';
import { ButtonChildrenContainer, SessionWrapperModal2 } from '../SessionWrapperModal2';
import { SimpleSessionInput } from '../inputs/SessionInput';
import { SpacerMD } from '../basic/Text';
import { ClearInputButton } from '../inputs/ClearInputButton';

type Props = {
  conversationId: string;
};

export const AddModeratorsDialog = (props: Props) => {
  const { conversationId } = props;

  const dispatch = useDispatch();
  const convo = ConvoHub.use().get(conversationId);

  const [inputBoxValue, setInputBoxValue] = useState('');
  const [addingInProgress, setAddingInProgress] = useState(false);

  const pubkeys = compact(inputBoxValue.split(',').map(p => PubKey.from(p.trim())));

  const addAsModerator = async () => {
    if (!pubkeys || pubkeys.length === 0) {
      ToastUtils.pushInvalidPubKey();
      return;
    }

    if (pubkeys.length > MAX_SUBREQUESTS_COUNT) {
      window?.log?.info(`too many moderators to be added: ${pubkeys.length}`);

      return;
    }

    window?.log?.info(`asked to add moderators: ${pubkeys.map(p => p.key)}`);

    try {
      setAddingInProgress(true);

      // this is a v2 opengroup
      const roomInfos = convo.toOpenGroupV2();
      const isAdded = await sogsV3AddAdmin(pubkeys, roomInfos);

      if (!isAdded) {
        window?.log?.warn('failed to add moderators:', isAdded);

        ToastUtils.pushFailedToAddAsModerator();
      } else {
        const userNames = pubkeys.map(
          p =>
            ConvoHub.use().get(p.key)?.getNicknameOrRealUsernameOrPlaceholder() ||
            window.i18n('unknown')
        );
        window?.log?.info(`${userNames.join(', ')} added as moderator(s)...`);
        ToastUtils.pushUserAddedToModerators(userNames);

        // clear input box
        setInputBoxValue('');
      }
    } catch (e) {
      window?.log?.error('Got error while adding moderator:', e);
    } finally {
      setAddingInProgress(false);
    }
  };

  const onClose = () => {
    dispatch(updateAddModeratorsModal(null));
  };

  const tooManyModerators = pubkeys.length > MAX_SUBREQUESTS_COUNT;

  return (
    <SessionWrapperModal2
      title={localize('addAdmins').toString()}
      onClose={onClose}
      buttonChildren={
        <ButtonChildrenContainer>
          <SessionButton
            buttonType={SessionButtonType.Simple}
            onClick={addAsModerator}
            text={localize('add').toString()}
            disabled={addingInProgress || inputBoxValue.length === 0 || tooManyModerators}
            dataTestId="add-admins-confirm-button"
          />
          <SessionButton
            buttonType={SessionButtonType.Simple}
            onClick={onClose}
            text={localize('cancel').toString()}
            dataTestId="add-admins-cancel-button"
          />
        </ButtonChildrenContainer>
      }
    >
      <Flex $container={true} $flexDirection="column" $alignItems="center">
        <I18nSubText
          dataTestId="modal-description"
          localizerProps={{ token: 'addAdminsDescription' }}
        />
        <SimpleSessionInput
          placeholder={localize('accountId').toString()}
          onValueChanged={setInputBoxValue}
          disabled={addingInProgress}
          value={inputBoxValue}
          ariaLabel="account Id input"
          textSize="md"
          padding={'var(--margins-md) var(--margins-md)'}
          inputDataTestId="add-admins-input"
          onEnterPressed={() => void addAsModerator()}
          errorDataTestId="error-message"
          providedError={''}
          autoFocus={true}
          buttonEnd={
            <ClearInputButton
              dataTestId={'clear-add-admins-button'}
              onClearInputClicked={() => {
                setInputBoxValue('');
              }}
              show={!!inputBoxValue}
            />
          }
        />

        <SessionSpinner loading={addingInProgress} />
        <SpacerMD />
      </Flex>
    </SessionWrapperModal2>
  );
};
