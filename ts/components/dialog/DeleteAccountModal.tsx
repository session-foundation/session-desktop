import { useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';

import { updateDeleteAccountModal } from '../../state/ducks/modalDialog';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SpacerLG } from '../basic/Text';
import { SessionSpinner } from '../loading';

import {
  deleteEverythingAndNetworkData,
  sendConfigMessageAndDeleteEverything,
} from '../../util/accountManager';
import { SessionRadioGroup } from '../basic/SessionRadioGroup';
import { Localizer } from '../basic/Localizer';

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
      label: window.i18n('clearDeviceOnly'),
      value: DEVICE_ONLY,
    },
    {
      label: window.i18n('clearDeviceAndNetwork'),
      value: DEVICE_AND_NETWORK,
    },
  ].map(m => ({
    ...m,
    inputDataTestId: `input-${m.value}` as const,
    labelDataTestId: `label-${m.value}` as const,
  }));

  return (
    <>
      <span
        className="session-confirm-main-message"
        data-testid="modal-description"
        style={{ maxWidth: '40ch' }}
      >
        <Localizer token="clearDataAllDescription" />
      </span>

      <SpacerLG />
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
    <span className="session-confirm-main-message" data-testid="modal-description">
      {props.deleteMode === 'device_and_network'
        ? window.i18n('clearDeviceAndNetworkConfirm')
        : window.i18n('clearDeviceDescription')}
    </span>
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
    <SessionWrapperModal
      title={window.i18n('clearDataAll')}
      onClose={onClickCancelHandler}
      showExitIcon={true}
    >
      {askingConfirmation ? (
        <DescriptionWhenAskingConfirmation deleteMode={deleteMode} />
      ) : (
        <DescriptionBeforeAskingConfirmation
          deleteMode={deleteMode}
          setDeleteMode={setDeleteMode}
        />
      )}
      <div className="session-modal__centered">
        <div className="session-modal__button-group">
          <SessionButton
            text={window.i18n('clear')}
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
            text={window.i18n('cancel')}
            buttonType={SessionButtonType.Simple}
            onClick={() => {
              dispatch(updateDeleteAccountModal(null));
            }}
            disabled={isLoading}
            dataTestId="session-confirm-cancel-button"
          />
        </div>
        {isLoading && <SpacerLG />}
        <SessionSpinner loading={isLoading} />
      </div>
    </SessionWrapperModal>
  );
};
