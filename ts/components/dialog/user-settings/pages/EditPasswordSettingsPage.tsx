import { useState } from 'react';
import { isEmpty } from 'lodash';

import {
  PanelButtonGroup,
  PanelButtonTextWithSubText,
  PanelLabelWithDescription,
} from '../../../buttons/panel/PanelButton';
import { ModalActionsContainer, ModalBasicHeader } from '../../../SessionWrapperModal';
import { ModalBackButton } from '../../shared/ModalBackButton';
import {
  useUserSettingsBackAction,
  useUserSettingsCloseAction,
  useUserSettingsTitle,
} from './userSettingsHooks';

import { Flex } from '../../../basic/Flex';
import type { PasswordAction } from '../../../../types/ReduxTypes';
import { SimpleSessionInput } from '../../../inputs/SessionInput';
import { tr, tStripped, type WithTrArgs } from '../../../../localization/localeTools';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../../../basic/SessionButton';
import { LucideIcon } from '../../../icon/LucideIcon';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';
import { Localizer } from '../../../basic/Localizer';
import { useTheme } from '../../../../state/theme/selectors/theme';
import { ToastUtils } from '../../../../session/utils';
import { assertUnreachable } from '../../../../types/sqlSharedTypes';
import { getPasswordHash, Storage } from '../../../../util/storage';
import { matchesHash, validatePassword } from '../../../../util/passwordUtils';
import { UserSettingsModalContainer } from '../components/UserSettingsModalContainer';

function StrengthCriteria(opts: { isMet: boolean } & WithTrArgs) {
  const theme = useTheme();
  const criteriaMetColor = theme.includes('classic') ? 'var(--green-color)' : 'var(--blue-color)';
  return (
    <Flex $container={true} $alignItems="flex-start" $flexGap="var(--margins-xs)">
      <Localizer {...opts.trArgs} />
      <LucideIcon
        iconColor={opts.isMet ? criteriaMetColor : 'var(--danger-color)'}
        unicode={opts.isMet ? LUCIDE_ICONS_UNICODE.CIRCLE_CHECK : LUCIDE_ICONS_UNICODE.CIRCLE_X}
        iconSize="small"
      />
    </Flex>
  );
}

function showError(error: string | null) {
  if (!error) {
    return;
  }
  ToastUtils.pushToastError('enterPasswordErrorToast', error);
}

function validatePasswordHash(password: string | null) {
  // Check if the password matches the hash we have stored
  const hash = getPasswordHash();
  if (hash && !matchesHash(password, hash)) {
    return false;
  }

  return true;
}
/**
 * Returns false and set the state error field in the input is not a valid password
 * or returns true
 */
function validatePasswordLocal(enteredPassword: string) {
  if (isEmpty(enteredPassword)) {
    // Note: we don't want to display an error when the password is empty, but just drop the action
    window.log.info('validatePassword needs a password to be given');
    return false;
  }
  // if user did not fill the first password field, we can't do anything
  const errorFirstInput = validatePassword(enteredPassword);
  if (errorFirstInput !== null) {
    showError(errorFirstInput);
    return false;
  }
  return true;
}

async function handleActionSet(
  enteredPassword: string,
  enteredPasswordConfirm: string,
  onDone?: () => void
) {
  // be sure both password are valid
  if (!validatePasswordLocal(enteredPassword)) {
    return;
  }
  // no need to validate second password. we just need to check that enteredPassword is valid, and that both password matches

  if (enteredPassword !== enteredPasswordConfirm) {
    showError(tr('passwordErrorMatch'));
    return;
  }
  try {
    const updatedHash = await window.setPassword(enteredPassword, null);
    if (!updatedHash) {
      throw new Error('window.setPassword expected updatedHash to be set for actionSet');
    }
    await Storage.put('passHash', updatedHash);

    ToastUtils.pushToastSuccess(
      'setPasswordSuccessToast',
      tStripped('passwordSetDescriptionToast')
    );

    onDone?.();
  } catch (err) {
    window.log.error(err);

    showError(tr('passwordFailed'));
  }
}

async function handleActionChange(
  oldPassword: string,
  newPassword: string,
  newConfirmedPassword: string,
  onDone?: () => void
) {
  // We don't validate oldPassword on change: this is validate on the validatePasswordHash below
  // we only validate the newPassword here
  if (!validatePasswordLocal(newPassword)) {
    return;
  }

  // Check the retyped password matches the new password
  if (newPassword !== newConfirmedPassword) {
    showError(tr('passwordErrorMatch'));
    return;
  }

  const isValidWithStoredInDB = validatePasswordHash(oldPassword);
  if (!isValidWithStoredInDB) {
    showError(tr('passwordCurrentIncorrect'));
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
      tStripped('passwordChangedDescriptionToast')
    );

    onDone?.();
  } catch (err) {
    window.log.error(err);

    showError(tr('changePasswordFail'));
  }
}

async function handleActionRemove(oldPassword: string, onDone?: () => void) {
  if (isEmpty(oldPassword)) {
    // Note, we want to drop "Enter" when no passwords are entered.
    window.log.info('handleActionRemove: no password given. dropping');
    return;
  }
  // We don't validate oldPassword on change: this is validate on the validatePasswordHash below
  const isValidWithStoredInDB = validatePasswordHash(oldPassword);
  if (!isValidWithStoredInDB) {
    showError(tr('passwordIncorrect'));
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
      tStripped('passwordRemovedDescriptionToast')
    );

    onDone?.();
  } catch (err) {
    window.log.error(err);

    showError(tr('removePasswordFail'));
  }
}

export function EditPasswordSettingsPage(modalState: {
  userSettingsPage: 'password';
  passwordAction: PasswordAction;
}) {
  const backAction = useUserSettingsBackAction(modalState);
  const closeAction = useUserSettingsCloseAction(modalState);
  const title = useUserSettingsTitle(modalState);

  const isSet = modalState.passwordAction === 'set';
  const isChange = modalState.passwordAction === 'change';
  const isRemove = modalState.passwordAction === 'remove';

  const [firstPassword, setFirstPassword] = useState('');
  const [secondPassword, setSecondPassword] = useState('');
  const [thirdPassword, setThirdPassword] = useState('');

  const hasLengthStrength = firstPassword.length > 12;
  const hasNumber = !!firstPassword.match(/[0-9]/);
  const hasUppercase = !!firstPassword.match(/[A-Z]/);
  const hasLowercase = !!firstPassword.match(/[a-z]/);
  const hasSymbol = !!firstPassword.match(/[!@#$%^&*(),.?":{}|<>_\-\\[\]`~;'/+=]/);

  const sharedInputProps = {
    type: 'password',
    padding: 'var(--margins-sm) var(--margins-md)',
    errorDataTestId: 'error-message',
    providedError: undefined,
    textSize: 'md',
    onEnterPressed: doChange,
  } as const;

  async function doChange() {
    switch (modalState.passwordAction) {
      case 'set':
        await handleActionSet(firstPassword, secondPassword, backAction ?? undefined);
        break;
      case 'change':
        await handleActionChange(
          firstPassword,
          secondPassword,
          thirdPassword,
          backAction ?? undefined
        );
        break;
      case 'remove':
        await handleActionRemove(firstPassword, backAction ?? undefined);
        break;
      default:
        assertUnreachable(modalState.passwordAction, 'passwordAction');
    }
  }

  return (
    <UserSettingsModalContainer
      headerChildren={
        <ModalBasicHeader
          title={title}
          bigHeader={true}
          showExitIcon={true}
          extraLeftButton={backAction ? <ModalBackButton onClick={backAction} /> : undefined}
        />
      }
      onClose={closeAction || undefined}
      buttonChildren={
        <ModalActionsContainer buttonType={SessionButtonType.Outline}>
          <SessionButton
            text={tr(isSet ? 'passwordSet' : isRemove ? 'passwordRemove' : 'passwordChange')}
            buttonType={SessionButtonType.Outline}
            onClick={doChange}
            buttonColor={isRemove ? SessionButtonColor.Danger : SessionButtonColor.PrimaryDark}
            disabled={
              // to set a password, we need both passwords (new & confirm)
              (isSet && (!firstPassword || !secondPassword)) ||
              // to change a password, we need all 3 passwords (current, new & confirm )
              (isChange && (!firstPassword || !secondPassword || !thirdPassword)) ||
              // to remove a password, we need the current password
              (isRemove && !firstPassword)
            }
          />
        </ModalActionsContainer>
      }
    >
      <PanelLabelWithDescription title={{ token: 'password' }} />
      <PanelButtonGroup
        style={{
          padding: 'var(--margins-lg) var(--margins-lg) var(--margins-md) var(--margins-lg)',
        }}
        /* we want some spacing between the items in this section */
        containerStyle={{ gap: 'var(--margins-md)' }}
      >
        <PanelButtonTextWithSubText
          text={{ token: isSet ? 'passwordSet' : isChange ? 'passwordChange' : 'passwordRemove' }}
          subText={{
            token: isSet
              ? 'setPasswordModalDescription'
              : isChange
                ? 'changePasswordModalDescription'
                : 'removePasswordModalDescription',
          }}
          textDataTestId="invalid-data-testid"
          subTextDataTestId="invalid-data-testid"
        />

        <Flex
          $container={true}
          $justifyContent={'center'}
          $flexGap="var(--margins-sm)"
          $flexDirection="column"
        >
          <SimpleSessionInput
            {...sharedInputProps}
            placeholder={isSet ? tr('passwordCreate') : tr('currentPassword')}
            onValueChanged={setFirstPassword}
            inputDataTestId="password-input"
            autoFocus={true}
          />
          {!isRemove && (
            <SimpleSessionInput
              {...sharedInputProps}
              placeholder={isChange ? tr('newPassword') : tr('passwordCreate')}
              onValueChanged={setSecondPassword}
              inputDataTestId="password-input-confirm"
            />
          )}
          {isChange && (
            <SimpleSessionInput
              {...sharedInputProps}
              placeholder={tr('passwordConfirm')}
              onValueChanged={setThirdPassword}
              inputDataTestId="password-input-reconfirm"
            />
          )}
        </Flex>
      </PanelButtonGroup>

      {!isRemove && (
        <>
          <PanelLabelWithDescription title={{ token: 'strength' }} />
          <PanelButtonGroup
            style={{
              padding: 'var(--margins-lg) var(--margins-lg) var(--margins-md) var(--margins-lg)',
            }}
            /* we want some spacing between the items in this section */
            containerStyle={{ gap: 'var(--margins-md)' }}
          >
            <PanelButtonTextWithSubText
              text={{
                token: 'passwordStrengthIndicator',
              }}
              subText={{
                token: 'passwordStrengthIndicatorDescription',
              }}
              textDataTestId="invalid-data-testid"
              subTextDataTestId="invalid-data-testid"
            />
            <Flex
              $container={true}
              $alignItems="flex-start"
              padding="var(--margins-md)"
              $flexDirection="column"
              style={{
                backgroundColor: 'var(--modal-background-content-color)',
                borderRadius: 'var(--border-radius)',
              }}
            >
              <StrengthCriteria
                isMet={hasLengthStrength}
                trArgs={{ token: 'passwordStrengthCharLength' }}
              />
              <StrengthCriteria
                isMet={hasNumber}
                trArgs={{ token: 'passwordStrengthIncludeNumber' }}
              />
              <StrengthCriteria
                isMet={hasSymbol}
                trArgs={{ token: 'passwordStrengthIncludesSymbol' }}
              />
              <StrengthCriteria
                isMet={hasUppercase}
                trArgs={{ token: 'passwordStrengthIncludesUppercase' }}
              />
              <StrengthCriteria
                isMet={hasLowercase}
                trArgs={{ token: 'passwordStrengthIncludesLowercase' }}
              />
            </Flex>
          </PanelButtonGroup>
        </>
      )}
    </UserSettingsModalContainer>
  );
}
