import { useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';

import { updateDeleteAccountModal } from '../../state/ducks/modalDialog';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SpacerLG } from '../basic/Text';
import { SessionSpinner } from '../loading';

import {
  deleteEverythingAndNetworkData,
  sendConfigMessageAndDeleteEverything,
} from '../../util/accountManager';
import { SessionRadioGroup } from '../basic/SessionRadioGroup';
import { localize } from '../../localization/localeTools';
import {
  BasicModalHeader,
  ModalActionsContainer,
  SessionWrapperModal2,
} from '../SessionWrapperModal2';
import { ModalDescription } from './shared/ModalDescriptionContainer';

const DEVICE_ONLY = 'device_only' as const;
const DEVICE_AND_NETWORK = 'device_and_network' as const;
type DeleteModes = typeof DEVICE_ONLY | typeof DEVICE_AND_NETWORK;

const DescriptionBeforeAskingConfirmation = (props: {
  deleteMode: DeleteModes;
  setDeleteMode: (deleteMode: DeleteModes) => void;
}) => {
  const { deleteMode, setDeleteMode } = props;

  const items = [
    {
      label: localize('clearDeviceOnly').toString(),
      value: DEVICE_ONLY,
    },
    {
      label: localize('clearDeviceAndNetwork').toString(),
      value: DEVICE_AND_NETWORK,
    },
  ].map(m => ({
    ...m,
    inputDataTestId: `input-${m.value}` as const,
    labelDataTestId: `label-${m.value}` as const,
  }));

  return (
    <>
      <ModalDescription
        dataTestId="modal-description"
        style={{ maxWidth: '40ch' }}
        localizerProps={{ token: 'clearDataAllDescription' }}
      />
      <SessionRadioGroup
        group="delete_account"
        initialItem={deleteMode}
        onClick={value => {
          if (value === DEVICE_ONLY || value === DEVICE_AND_NETWORK) {
            setDeleteMode(value);
          }
        }}
        items={items}
      />
    </>
  );
};

const DescriptionWhenAskingConfirmation = (props: { deleteMode: DeleteModes }) => {
  return (
    <ModalDescription
      dataTestId="modal-description"
      localizerProps={{
        token:
          props.deleteMode === 'device_and_network'
            ? 'clearDeviceAndNetworkConfirm'
            : 'clearDeviceDescription',
      }}
    />
  );
};

export const DeleteAccountModal = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [askingConfirmation, setAskingConfirmation] = useState(false);
  const [deleteMode, setDeleteMode] = useState<DeleteModes>(DEVICE_ONLY);

  const dispatch = useDispatch();

  const onDeleteEverythingLocallyOnly = async () => {
    if (!isLoading) {
      setIsLoading(true);
      try {
        window.log.warn('Deleting everything on device but keeping network data');

        await sendConfigMessageAndDeleteEverything();
      } catch (e) {
        window.log.warn(e);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const onDeleteEverythingAndNetworkData = async () => {
    if (!isLoading) {
      setIsLoading(true);
      try {
        window.log.warn('Deleting everything including network data');
        await deleteEverythingAndNetworkData();
      } catch (e) {
        window.log.warn(e);
      } finally {
        setIsLoading(false);
      }
    }
  };

  /**
   * Performs specified on close action then removes the modal.
   */
  const onClickCancelHandler = useCallback(() => {
    dispatch(updateDeleteAccountModal(null));
  }, [dispatch]);

  return (
    <SessionWrapperModal2
      headerChildren={<BasicModalHeader title={localize('clearDataAll').toString()} />}
      onClose={onClickCancelHandler}
      buttonChildren={
        <ModalActionsContainer>
          <SessionButton
            text={localize('clear').toString()}
            buttonColor={SessionButtonColor.Danger}
            buttonType={SessionButtonType.Simple}
            onClick={() => {
              if (!askingConfirmation) {
                setAskingConfirmation(true);
                return;
              }
              if (deleteMode === 'device_only') {
                void onDeleteEverythingLocallyOnly();
              } else if (deleteMode === 'device_and_network') {
                void onDeleteEverythingAndNetworkData();
              }
            }}
            dataTestId="session-confirm-ok-button"
            disabled={isLoading}
          />

          <SessionButton
            text={localize('cancel').toString()}
            buttonType={SessionButtonType.Simple}
            onClick={() => {
              dispatch(updateDeleteAccountModal(null));
            }}
            disabled={isLoading}
            dataTestId="session-confirm-cancel-button"
          />
        </ModalActionsContainer>
      }
    >
      {askingConfirmation ? (
        <DescriptionWhenAskingConfirmation deleteMode={deleteMode} />
      ) : (
        <DescriptionBeforeAskingConfirmation
          deleteMode={deleteMode}
          setDeleteMode={setDeleteMode}
        />
      )}
      {isLoading && <SpacerLG />}
      <SessionSpinner loading={isLoading} />
    </SessionWrapperModal2>
  );
};
