import { isString } from 'lodash';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import styled from 'styled-components';
import { Provider } from 'react-redux';

import { SessionButton, SessionButtonColor, SessionButtonType } from './basic/SessionButton';
import { SessionTheme } from '../themes/SessionTheme';
import { switchPrimaryColorTo } from '../themes/switchPrimaryColor';
import { switchThemeTo } from '../themes/switchTheme';
import { SessionToastContainer } from './SessionToastContainer';
import { SessionToast } from './basic/SessionToast';
import { SessionSpinner } from './loading';
import { Localizer } from './basic/Localizer';
import { tr } from '../localization/localeTools';
import {
  ModalBasicHeader,
  ModalActionsContainer,
  SessionWrapperModal,
  WrapperModalWidth,
} from './SessionWrapperModal';
import { themeStore } from '../state/theme/store';
import { ShowHideSessionInput } from './inputs/SessionInput';
import { sleepFor } from '../session/utils/Promise';
import { ModalDescription } from './dialog/shared/ModalDescriptionContainer';
import { SpacerMD } from './basic/Text';
import { ModalFlexContainer } from './dialog/shared/ModalFlexContainer';

const MAX_LOGIN_TRIES = 3;

const TextPleaseWait = (props: { isLoading: boolean }) => {
  if (!props.isLoading) {
    return null;
  }
  return (
    <div>
      <Localizer token="waitOneMoment" />
    </div>
  );
};

const StyledContent = styled.div`
  background-color: var(--background-secondary-color);
  height: 100%;
  width: 100%;
`;

// We cannot import ToastUtils from the password window as it is pulling the whole sending
// pipeline(and causing crashes on Session instances with password)
function pushToastError(id: string, description: string) {
  toast.error(<SessionToast description={description} />, {
    toastId: id,
    updateId: id,
  });
}

function ClearDataViewButtons({ onCancel }: { onCancel: () => void }) {
  return (
    <ModalActionsContainer>
      <SessionButton
        text={tr('clearDevice')}
        buttonColor={SessionButtonColor.Danger}
        buttonType={SessionButtonType.Simple}
        onClick={window.clearLocalData}
      />
      <SessionButton text={tr('cancel')} buttonType={SessionButtonType.Simple} onClick={onCancel} />
    </ModalActionsContainer>
  );
}

function PasswordViewButtons({
  errorCount,
  initLogin,
  loading,
  onShowClearDataView,
}: {
  errorCount: number;
  loading: boolean;
  initLogin: () => void;
  onShowClearDataView: () => void;
}) {
  const showResetElements = errorCount >= MAX_LOGIN_TRIES;

  if (loading) {
    return null;
  }

  return (
    <ModalActionsContainer>
      {showResetElements && (
        <SessionButton
          text={tr('clearDevice')}
          buttonColor={SessionButtonColor.Danger}
          buttonType={SessionButtonType.Simple}
          onClick={onShowClearDataView}
        />
      )}
      {!loading && (
        <SessionButton
          text={showResetElements ? tr('tryAgain') : tr('done')}
          buttonType={SessionButtonType.Simple}
          onClick={initLogin}
          disabled={loading}
        />
      )}
    </ModalActionsContainer>
  );
}

async function onLogin(passPhrase: string, increaseErrorCount: () => void, onFinished: () => void) {
  const start = Date.now();
  // Note: we don't trim the password anymore. If the user entered a space at the end, so be it.
  try {
    await window.onLogin(passPhrase);
  } catch (error) {
    // Increment the error counter and show the button if necessary
    increaseErrorCount();
    const minLoginTime = 500;
    if (Date.now() - start < minLoginTime) {
      // keep the loader shown if it was shown only briefly
      const toSleepMs = minLoginTime - (Date.now() - start);
      // console.log(`login took ${Date.now() - start}ms, sleeping for ${toSleepMs}ms`);
      await sleepFor(toSleepMs);
    }

    if (error && isString(error)) {
      pushToastError('onLogin', error);
    } else if (error?.message && isString(error.message)) {
      pushToastError('onLogin', error.message);
    }
  }

  onFinished();
}

const PasswordPrompt = ({
  onEnterPressed,
  onPasswordChange,
  password,
}: {
  onPasswordChange: (password: string) => void;
  onEnterPressed: () => void;
  password: string;
}) => {
  return (
    <ShowHideSessionInput
      placeholder={tr('passwordEnter')}
      onEnterPressed={onEnterPressed}
      onValueChanged={onPasswordChange}
      ariaLabel="password input"
      value={password}
      padding="var(--margins-sm) var(--margins-md)"
      providedError={undefined}
      errorDataTestId="error-message"
      inputDataTestId="password-input"
      showHideButtonAriaLabels={{ hide: 'Hide password', show: 'Reveal password' }}
      showHideButtonDataTestIds={{
        hide: 'hide-password-input-toggle',
        show: 'reveal-password-input-toggle',
      }}
    />
  );
};

const SessionPasswordPromptInner = () => {
  const [password, setPassword] = useState('');
  const [errorCount, setErrorCount] = useState(0);
  const [clearDataView, setClearDataView] = useState(false);
  const [loading, setLoading] = useState(false);

  const showClearDataView = () => {
    setErrorCount(0);
    setClearDataView(true);
  };

  const increaseErrorCount = () => {
    setErrorCount(errorCount + 1);
  };

  const initLogin = () => {
    setLoading(true);

    // this is to make sure a render has the time to happen before we lock the thread with all of the db work
    // this might be removed once we get the db operations to a worker thread
    global.setTimeout(() => {
      void onLogin(password, increaseErrorCount, () => setLoading(false));
    }, 100);
  };

  return (
    <SessionWrapperModal
      headerChildren={
        <ModalBasicHeader title={tr(clearDataView ? 'clearDevice' : 'passwordEnter')} />
      }
      $contentMinWidth={WrapperModalWidth.narrow}
      buttonChildren={
        clearDataView ? (
          <ClearDataViewButtons
            onCancel={() => {
              setClearDataView(false);
            }}
          />
        ) : (
          <PasswordViewButtons
            errorCount={errorCount}
            loading={loading}
            initLogin={initLogin}
            onShowClearDataView={showClearDataView}
          />
        )
      }
    >
      <ModalFlexContainer>
        {loading ? (
          <>
            <SessionSpinner loading={true} />
            <TextPleaseWait isLoading={loading} />
            <SpacerMD />
          </>
        ) : clearDataView ? (
          <ModalDescription
            dataTestId="modal-description"
            localizerProps={{
              token: 'clearDeviceDescription',
            }}
          />
        ) : (
          <PasswordPrompt
            onEnterPressed={initLogin}
            onPasswordChange={setPassword}
            password={password}
          />
        )}
      </ModalFlexContainer>
    </SessionWrapperModal>
  );
};

export const SessionPasswordPrompt = () => {
  useEffect(() => {
    if (window.theme) {
      void switchThemeTo({
        theme: window.theme,
      });
    }
    if (window.primaryColor) {
      void switchPrimaryColorTo(window.primaryColor);
    }
  }, []);

  return (
    <Provider store={themeStore}>
      <SessionTheme>
        <SessionToastContainer />
        <StyledContent>
          <SessionPasswordPromptInner />
        </StyledContent>
      </SessionTheme>
    </Provider>
  );
};
