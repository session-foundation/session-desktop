import clsx from 'clsx';

import { isString } from 'lodash';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import styled from 'styled-components';
import useTimeoutFn from 'react-use/lib/useTimeoutFn';

import { SessionButton, SessionButtonColor, SessionButtonType } from './basic/SessionButton';
import { SessionTheme } from '../themes/SessionTheme';
import { switchPrimaryColorTo } from '../themes/switchPrimaryColor';
import { switchThemeTo } from '../themes/switchTheme';
import { SessionToastContainer } from './SessionToastContainer';
import { SessionWrapperModal } from './SessionWrapperModal';
import { SessionToast } from './basic/SessionToast';
import { SessionSpinner } from './loading';
import { Localizer } from './basic/Localizer';

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

// We cannot import toastutils from the password window as it is pulling the whole sending
// pipeline(and causing crashes on Session instances with password)
function pushToastError(id: string, description: string) {
  toast.error(<SessionToast description={description} />, {
    toastId: id,
    updateId: id,
  });
}

function ClearDataViewButtons({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="session-modal__button-group">
      <SessionButton
        text={window.i18n('clearDevice')}
        buttonColor={SessionButtonColor.Danger}
        buttonType={SessionButtonType.Simple}
        onClick={window.clearLocalData}
      />
      <SessionButton
        text={window.i18n('cancel')}
        buttonType={SessionButtonType.Simple}
        onClick={onCancel}
      />
    </div>
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

  return (
    <div className={clsx(showResetElements && 'session-modal__button-group')}>
      {showResetElements && (
        <>
          <SessionButton
            text={window.i18n('clearDevice')}
            buttonColor={SessionButtonColor.Danger}
            buttonType={SessionButtonType.Simple}
            onClick={onShowClearDataView}
          />
        </>
      )}
      {!loading && (
        <SessionButton
          text={showResetElements ? window.i18n('tryAgain') : window.i18n('done')}
          buttonType={SessionButtonType.Simple}
          onClick={initLogin}
          disabled={loading}
        />
      )}
    </div>
  );
}

async function onLogin(passPhrase: string, increaseErrorCount: () => void, onFinished: () => void) {
  // Note: we don't trim the password anymore. If the user entered a space at the end, so be it.
  try {
    await window.onLogin(passPhrase);
  } catch (error) {
    // Increment the error counter and show the button if necessary
    increaseErrorCount();

    if (error && isString(error)) {
      pushToastError('onLogin', error);
    } else if (error?.message && isString(error.message)) {
      pushToastError('onLogin', error.message);
    }
  }
  onFinished();
}

function ClearDataDescription() {
  return (
    <p>
      <Localizer token="clearDeviceDescription" />
    </p>
  );
}

const PasswordPrompt = ({
  onEnterPressed,
  onPasswordChange,
}: {
  onPasswordChange: (password: string) => void;
  onEnterPressed: () => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useTimeoutFn(() => {
    inputRef.current?.focus();
  }, 50);

  return (
    <div className="session-modal__input-group">
      <input
        type="password"
        autoFocus={true}
        defaultValue=""
        placeholder={window.i18n('passwordEnter')}
        onChange={e => {
          onPasswordChange(e.target.value);
        }}
        onKeyUp={e => {
          if (e.key === 'Enter') {
            onEnterPressed();
          }
        }}
        ref={inputRef}
      />
    </div>
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
      title={clearDataView ? window.i18n('clearDevice') : window.i18n('passwordEnter')}
    >
      {loading ? (
        <SessionSpinner loading={true} />
      ) : clearDataView ? (
        <ClearDataDescription />
      ) : (
        <PasswordPrompt onEnterPressed={initLogin} onPasswordChange={setPassword} />
      )}
      <TextPleaseWait isLoading={loading} />
      {clearDataView ? (
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
      )}
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
    <SessionTheme>
      <SessionToastContainer />
      <StyledContent>
        <SessionPasswordPromptInner />
      </StyledContent>
    </SessionTheme>
  );
};
