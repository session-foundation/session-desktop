/* eslint-disable @typescript-eslint/no-misused-promises */

import autoBind from 'auto-bind';
import { isEmpty } from 'lodash';
import { Component } from 'react';
import { ToastUtils } from '../../session/utils';
import { sessionPassword } from '../../state/ducks/modalDialog';
import type { PasswordAction } from '../../types/ReduxTypes';
import { assertUnreachable } from '../../types/sqlSharedTypes';
import { matchesHash, validatePassword } from '../../util/passwordUtils';
import { getPasswordHash, Storage } from '../../util/storage';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { tr, tStripped } from '../../localization/localeTools';
import {
  ModalBasicHeader,
  ModalActionsContainer,
  SessionWrapperModal,
  WrapperModalWidth,
} from '../SessionWrapperModal';
import { SimpleSessionInput } from '../inputs/SessionInput';
import { ModalFlexContainer } from './shared/ModalFlexContainer';

interface Props {
  passwordAction: PasswordAction;
  onOk: () => void;
}

interface State {
  error: string | null;
  currentPasswordEntered: string | null;
  currentPasswordConfirmEntered: string | null;
  currentPasswordRetypeEntered: string | null;
}

export class SessionSetPasswordDialog extends Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      error: null,
      currentPasswordEntered: null,
      currentPasswordConfirmEntered: null,
      currentPasswordRetypeEntered: null,
    };

    autoBind(this);
  }

  public render() {
    const { passwordAction } = this.props;
    const { currentPasswordEntered } = this.state;
    let placeholders: Array<string> = [];
    switch (passwordAction) {
      case 'change':
        placeholders = [tr('passwordEnterCurrent'), tr('passwordEnterNew'), tr('passwordConfirm')];
        break;
      case 'remove':
        placeholders = [tr('passwordRemove')];
        break;
      case 'enter':
        placeholders = [tr('passwordCreate')];
        break;
      default:
        placeholders = [tr('passwordCreate'), tr('passwordConfirm')];
    }

    const confirmButtonText = passwordAction === 'remove' ? tr('remove') : tr('save');

    const titleString = () => {
      switch (passwordAction) {
        case 'change':
          return tr('passwordChange');
        case 'remove':
          return tr('passwordRemove');
        case 'enter':
          return tr('passwordEnter');
        default:
          return tr('passwordSet');
      }
    };

    const sharedInputProps = {
      type: 'password',
      padding: 'var(--margins-sm) var(--margins-md)',
      errorDataTestId: 'error-message',
      providedError: undefined,
      textSize: 'md',
      onEnterPressed: () => {
        void this.setPassword();
      },
    } as const;

    return (
      <SessionWrapperModal
        headerChildren={<ModalBasicHeader title={titleString()} />}
        onClose={this.closeDialog}
        $contentMinWidth={WrapperModalWidth.narrow}
        $contentMaxWidth={WrapperModalWidth.narrow}
        buttonChildren={
          <ModalActionsContainer>
            <SessionButton
              text={confirmButtonText}
              buttonColor={passwordAction === 'remove' ? SessionButtonColor.Danger : undefined}
              buttonType={SessionButtonType.Simple}
              onClick={this.setPassword}
              disabled={
                (passwordAction === 'change' ||
                  passwordAction === 'set' ||
                  passwordAction === 'remove') &&
                isEmpty(currentPasswordEntered)
              }
            />
            {passwordAction !== 'enter' && (
              <SessionButton
                text={tr('cancel')}
                buttonColor={passwordAction !== 'remove' ? SessionButtonColor.Danger : undefined}
                buttonType={SessionButtonType.Simple}
                onClick={this.closeDialog}
              />
            )}
          </ModalActionsContainer>
        }
      >
        <ModalFlexContainer>
          <SimpleSessionInput
            {...sharedInputProps}
            placeholder={placeholders[0]}
            onValueChanged={this.onPasswordInput}
            data-testid="password-input"
            autoFocus={true}
          />
          {passwordAction !== 'enter' && passwordAction !== 'remove' && (
            <SimpleSessionInput
              {...sharedInputProps}
              placeholder={placeholders[1]}
              onValueChanged={this.onPasswordConfirmInput}
              data-testid="password-input-confirm"
            />
          )}
          {passwordAction === 'change' && (
            <SimpleSessionInput
              {...sharedInputProps}
              placeholder={placeholders[2]}
              onValueChanged={this.onPasswordRetypeInput}
              data-testid="password-input-reconfirm"
            />
          )}
        </ModalFlexContainer>
      </SessionWrapperModal>
    );
  }

  public validatePasswordHash(password: string | null) {
    // Check if the password matches the hash we have stored
    const hash = getPasswordHash();
    if (hash && !matchesHash(password, hash)) {
      return false;
    }

    return true;
  }

  private showError() {
    if (this.state.error) {
      ToastUtils.pushToastError('enterPasswordErrorToast', this.state.error);
    }
  }

  /**
   * Returns false and set the state error field in the input is not a valid password
   * or returns true
   */
  private validatePassword(enteredPassword: string) {
    if (isEmpty(enteredPassword)) {
      // Note, we don't want to display an error when the password is empty, but just drop the action
      window.log.info('validatePassword needs a password to be given');
      return false;
    }
    // if user did not fill the first password field, we can't do anything
    const errorFirstInput = validatePassword(enteredPassword);
    if (errorFirstInput !== null) {
      this.setState(
        {
          error: errorFirstInput,
        },
        () => this.showError()
      );
      return false;
    }
    return true;
  }

  private async handleActionSet(enteredPassword: string, enteredPasswordConfirm: string) {
    // be sure both password are valid
    if (!this.validatePassword(enteredPassword)) {
      return;
    }
    // no need to validate second password. we just need to check that enteredPassword is valid, and that both password matches

    if (enteredPassword !== enteredPasswordConfirm) {
      this.setState({
        error: tr('passwordErrorMatch'),
      });
      this.showError();
      return;
    }
    try {
      const updatedHash = await window.setPassword(enteredPassword, null);
      if (!updatedHash) {
        throw new Error('window.setPassword expected updatedHash to be set for actionSet');
      }
      await Storage.put('passHash', updatedHash);

      ToastUtils.pushToastSuccess('setPasswordSuccessToast', tStripped('passwordSetDescription'));

      this.props.onOk();
      this.closeDialog();
    } catch (err) {
      window.log.error(err);
      this.setState({
        error: tr('passwordFailed'),
      });
      this.showError();
    }
  }

  private async handleActionChange(
    oldPassword: string,
    newPassword: string,
    newConfirmedPassword: string
  ) {
    // We don't validate oldPassword on change: this is validate on the validatePasswordHash below
    // we only validate the newPassword here
    if (!this.validatePassword(newPassword)) {
      return;
    }

    // Check the retyped password matches the new password
    if (newPassword !== newConfirmedPassword) {
      this.setState({
        error: tr('passwordErrorMatch'),
      });
      this.showError();
      return;
    }

    const isValidWithStoredInDB = this.validatePasswordHash(oldPassword);
    if (!isValidWithStoredInDB) {
      this.setState({
        error: tr('passwordCurrentIncorrect'),
      });
      this.showError();
      return;
    }

    try {
      const updatedHash = await window.setPassword(newPassword, oldPassword);
      if (!updatedHash) {
        throw new Error('window.setPassword expected updatedHash to be set for actionChange');
      }
      await Storage.put('passHash', updatedHash);

      ToastUtils.pushToastSuccess(
        'setPasswordSuccessToast',
        tStripped('passwordChangedDescription')
      );

      this.props.onOk();
      this.closeDialog();
    } catch (err) {
      window.log.error(err);
      this.setState({
        error: tr('changePasswordFail'),
      });
      this.showError();
    }
  }

  private async handleActionRemove(oldPassword: string) {
    if (isEmpty(oldPassword)) {
      // Note, we want to drop "Enter" when no passwords are entered.
      window.log.info('handleActionRemove: no password given. dropping');
      return;
    }
    // We don't validate oldPassword on change: this is validate on the validatePasswordHash below
    const isValidWithStoredInDB = this.validatePasswordHash(oldPassword);
    if (!isValidWithStoredInDB) {
      this.setState({
        error: tr('passwordIncorrect'),
      });
      this.showError();
      return;
    }

    try {
      const updatedHash = await window.setPassword(null, oldPassword);
      if (updatedHash) {
        throw new Error('window.setPassword expected updatedHash to be unset for actionRemove');
      }
      await Storage.remove('passHash');

      ToastUtils.pushToastWarning(
        'setPasswordSuccessToast',
        tStripped('passwordRemovedDescription')
      );

      this.props.onOk();
      this.closeDialog();
    } catch (err) {
      window.log.error(err);
      this.setState({
        error: tr('removePasswordFail'),
      });
      this.showError();
    }
  }

  private async handleActionEnter(enteredPassword: string) {
    // be sure the password is valid
    if (!this.validatePassword(enteredPassword)) {
      return;
    }

    const isValidWithStoredInDB = this.validatePasswordHash(enteredPassword);
    if (!isValidWithStoredInDB) {
      this.setState({
        error: tr('passwordIncorrect'),
      });
      this.showError();
      return;
    }

    this.props.onOk();
    this.closeDialog();
  }

  private async setPassword() {
    const { passwordAction } = this.props;
    const { currentPasswordEntered, currentPasswordConfirmEntered, currentPasswordRetypeEntered } =
      this.state;

    // Note: don't trim anything. If the user entered a space as a first/last
    // char and saved it as is in his password manager, so be it.
    const firstPasswordEntered = currentPasswordEntered || '';
    const secondPasswordEntered = currentPasswordConfirmEntered || '';
    const thirdPasswordEntered = currentPasswordRetypeEntered || '';

    switch (passwordAction) {
      case 'set': {
        await this.handleActionSet(firstPasswordEntered, secondPasswordEntered);
        return;
      }
      case 'change': {
        await this.handleActionChange(
          firstPasswordEntered,
          secondPasswordEntered,
          thirdPasswordEntered
        );
        return;
      }
      case 'remove': {
        await this.handleActionRemove(firstPasswordEntered);
        return;
      }
      case 'enter': {
        await this.handleActionEnter(firstPasswordEntered);
        return;
      }
      default:
        assertUnreachable(passwordAction, 'passwordAction');
    }
  }

  private closeDialog() {
    window.inboxStore?.dispatch(sessionPassword(null));
  }

  private onPasswordInput(value: string) {
    const currentPasswordEntered = value;
    this.setState({ currentPasswordEntered });
  }

  private onPasswordConfirmInput(value: string) {
    const currentPasswordConfirmEntered = value;
    this.setState({ currentPasswordConfirmEntered });
  }

  private onPasswordRetypeInput(value: string) {
    const currentPasswordRetypeEntered = value;
    this.setState({ currentPasswordRetypeEntered });
  }
}
