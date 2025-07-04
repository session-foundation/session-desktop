import autoBind from 'auto-bind';
import clsx from 'clsx';

import { isString } from 'lodash';
import { PureComponent, useEffect } from 'react';
import { toast } from 'react-toastify';
import styled from 'styled-components';

import { Provider } from 'react-redux';
import { SessionButton, SessionButtonColor, SessionButtonType } from './basic/SessionButton';
import { SessionTheme } from '../themes/SessionTheme';
import { switchPrimaryColorTo } from '../themes/switchPrimaryColor';
import { switchThemeTo } from '../themes/switchTheme';
import { SessionToastContainer } from './SessionToastContainer';
import { SessionWrapperModal } from './SessionWrapperModal';
import { SessionToast } from './basic/SessionToast';
import { SessionSpinner } from './loading';
import { Localizer } from './basic/Localizer';
import { themeStore } from '../state/theme/store';

interface State {
  errorCount: number;
  clearDataView: boolean;
  loading: boolean;
}

export const MAX_LOGIN_TRIES = 3;

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

class SessionPasswordPromptInner extends PureComponent<unknown, State> {
  private inputRef?: any;

  constructor(props: any) {
    super(props);

    this.state = {
      errorCount: 0,
      clearDataView: false,
      loading: false,
    };

    autoBind(this);
  }

  public componentDidMount() {
    setTimeout(() => {
      this.inputRef?.focus();
    }, 100);
  }

  public render() {
    const isLoading = this.state.loading;
    const spinner = isLoading ? <SessionSpinner loading={true} /> : null;
    const featureElement = this.state.clearDataView ? (
      <p>
        <Localizer token="clearDeviceDescription" />
      </p>
    ) : (
      <div className="session-modal__input-group">
        <input
          type="password"
          id="password-prompt-input"
          defaultValue=""
          placeholder={window.i18n('passwordEnter')}
          onKeyUp={this.onKeyUp}
          ref={input => {
            this.inputRef = input;
          }}
        />
      </div>
    );

    return (
      <SessionWrapperModal
        title={this.state.clearDataView ? window.i18n('clearDevice') : window.i18n('passwordEnter')}
      >
        {spinner || featureElement}
        <TextPleaseWait isLoading={isLoading} />
        {this.state.clearDataView
          ? this.renderClearDataViewButtons()
          : this.renderPasswordViewButtons()}
      </SessionWrapperModal>
    );
  }

  public onKeyUp(event: any) {
    switch (event.key) {
      case 'Enter':
        this.initLogin();
        break;
      default:
    }
    event.preventDefault();
  }

  public async onLogin(passPhrase: string) {
    // Note: we don't trim the password anymore. If the user entered a space at the end, so be it.
    try {
      await window.onLogin(passPhrase);
    } catch (error) {
      // Increment the error counter and show the button if necessary
      this.setState({
        errorCount: this.state.errorCount + 1,
      });

      if (error && isString(error)) {
        pushToastError('onLogin', error);
      } else if (error?.message && isString(error.message)) {
        pushToastError('onLogin', error.message);
      }

      global.setTimeout(() => {
        document.getElementById('password-prompt-input')?.focus();
      }, 50);
    }
    this.setState({
      loading: false,
    });
  }

  private initLogin() {
    this.setState({
      loading: true,
    });
    const passPhrase = String((this.inputRef as HTMLInputElement).value);

    // this is to make sure a render has the time to happen before we lock the thread with all of the db work
    // this might be removed once we get the db operations to a worker thread
    global.setTimeout(() => {
      void this.onLogin(passPhrase);
    }, 100);
  }

  private initClearDataView() {
    this.setState({
      errorCount: 0,
      clearDataView: true,
    });
  }

  private renderPasswordViewButtons(): JSX.Element {
    const showResetElements = this.state.errorCount >= MAX_LOGIN_TRIES;

    return (
      <div className={clsx(showResetElements && 'session-modal__button-group')}>
        {showResetElements && (
          <>
            <SessionButton
              text={window.i18n('clearDevice')}
              buttonColor={SessionButtonColor.Danger}
              buttonType={SessionButtonType.Simple}
              onClick={this.initClearDataView}
            />
          </>
        )}
        {!this.state.loading && (
          <SessionButton
            text={showResetElements ? window.i18n('tryAgain') : window.i18n('done')}
            buttonType={SessionButtonType.Simple}
            onClick={this.initLogin}
            disabled={this.state.loading}
          />
        )}
      </div>
    );
  }

  private renderClearDataViewButtons(): JSX.Element {
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
          onClick={() => {
            this.setState({ clearDataView: false });
          }}
        />
      </div>
    );
  }
}

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
