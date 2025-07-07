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
import { Localizer } from '../basic/Localizer';
import { localize } from '../../localization/localeTools';
import { ButtonChildrenContainer, SessionWrapperModal2 } from '../SessionWrapperModal2';
import { StyledModalDescriptionContainer } from './shared/ModalDescriptionContainer';

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
      <StyledModalDescriptionContainer data-testid="modal-description" style={{ maxWidth: '40ch' }}>
        <Localizer token="clearDataAllDescription" />
      </StyledModalDescriptionContainer>
      <SessionRadioGroup
        group="delete_account"
        initialItem={deleteMode}
        style={{ gap: 'var(--margins-md)' }}
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
    <StyledModalDescriptionContainer data-testid="modal-description">
      {props.deleteMode === 'device_and_network'
        ? localize('clearDeviceAndNetworkConfirm').toString()
        : localize('clearDeviceDescription').toString()}
    </StyledModalDescriptionContainer>
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
      title={localize('clearDataAll').toString()}
      onClose={onClickCancelHandler}
      showExitIcon={false}
      buttonChildren={
        <ButtonChildrenContainer>
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
        </ButtonChildrenContainer>
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
