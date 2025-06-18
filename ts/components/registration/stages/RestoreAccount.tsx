import { Dispatch } from '@reduxjs/toolkit';
import { isEmpty } from 'lodash';
import { useDispatch } from 'react-redux';
import { useState } from 'react';
import { ONBOARDING_TIMES } from '../../../session/constants';
import { InvalidWordsError, NotEnoughWordsError } from '../../../session/crypto/mnemonic';
import { ProfileManager } from '../../../session/profile_manager/ProfileManager';
import { PromiseUtils } from '../../../session/utils';
import { TaskTimedOutError } from '../../../session/utils/Promise';
import {
  EmptyDisplayNameError,
  NotFoundError,
  RetrieveDisplayNameError,
} from '../../../session/utils/errors';
import {
  AccountRestoration,
  setAccountRestorationStep,
  setDisplayName,
  setDisplayNameError,
  setHexGeneratedPubKey,
  setProgress,
  setRecoveryPassword,
  setRecoveryPasswordError,
} from '../../../state/onboarding/ducks/registration';
import {
  useDisplayName,
  useDisplayNameError,
  useOnboardAccountRestorationStep,
  useProgress,
  useRecoveryPassword,
  useRecoveryPasswordError,
} from '../../../state/onboarding/selectors/registration';
import {
  registerSingleDevice,
  registrationDone,
  signInByLinkingDevice,
} from '../../../util/accountManager';
import { setSignInByLinking, setSignWithRecoveryPhrase } from '../../../util/storage';
import { Flex } from '../../basic/Flex';
import { SpacerLG, SpacerSM } from '../../basic/Text';
import { SessionIcon } from '../../icon';
import { SessionProgressBar } from '../../loading';
import { resetRegistration } from '../RegistrationStages';
import { ContinueButton, OnboardDescription, OnboardHeading } from '../components';
import { BackButtonWithinContainer } from '../components/BackButton';
import { useRecoveryProgressEffect } from '../hooks';
import { localize } from '../../../localization/localeTools';
import { sanitizeDisplayNameOrToast } from '../utils';
import { SimpleSessionInput } from '../../inputs/SessionInput';
import { ShowHideButton } from '../../inputs/ShowHidePasswordButton';

type AccountRestoreDetails = {
  recoveryPassword: string;
  dispatch: Dispatch;
  abortSignal?: AbortSignal;
};

export async function finishRestore(pubkey: string, displayName: string) {
  await setSignWithRecoveryPhrase(true);
  await registrationDone(pubkey, displayName);

  window.Whisper.events.trigger('openInbox');
}

/**
 * This will try to sign in with the user recovery password.
 * If no ConfigurationMessage is received within ONBOARDING_RECOVERY_TIMEOUT, the user will be asked to enter a display name.
 */
async function signInAndFetchDisplayName({
  recoveryPassword,
  dispatch,
  abortSignal,
}: AccountRestoreDetails) {
  try {
    await resetRegistration();
    const promiseLink = signInByLinkingDevice(recoveryPassword, 'english', abortSignal);
    const promiseWait = PromiseUtils.waitForTask(done => {
      window.Whisper.events.on(
        'configurationMessageReceived',
        async (ourPubkey: string, displayName: string) => {
          window.Whisper.events.off('configurationMessageReceived');
          await setSignInByLinking(false);
          dispatch(setHexGeneratedPubKey(ourPubkey));
          dispatch(setDisplayName(displayName));
          dispatch(setAccountRestorationStep(AccountRestoration.Finishing));
          done(displayName);
        }
      );
    }, ONBOARDING_TIMES.RECOVERY_TIMEOUT);

    await Promise.all([promiseLink, promiseWait]);
  } catch (e) {
    await resetRegistration();
    throw e;
  }
}

/**
 * Sign in/restore from seed.
 * Ask for a display name, as we will drop incoming ConfigurationMessages if any are saved on the swarm.
 * We will handle a ConfigurationMessage
 */
async function signInWithNewDisplayName({
  displayName,
  recoveryPassword,
  dispatch,
}: AccountRestoreDetails & { displayName: string }) {
  try {
    await resetRegistration();
    await registerSingleDevice(recoveryPassword, 'english', displayName, async (pubkey: string) => {
      dispatch(setHexGeneratedPubKey(pubkey));
      dispatch(setDisplayName(displayName));
      await finishRestore(pubkey, displayName);
    });
  } catch (e) {
    await resetRegistration();
    throw e;
  }
}

let abortController = new AbortController();

const showHideButtonAriaLabels = {
  hide: 'Hide recovery password toggle',
  show: 'Reveal recovery password toggle',
} as const;

const showHideButtonDataTestIds = {
  hide: 'hide-recovery-phrase-toggle',
  show: 'reveal-recovery-phrase-toggle',
} as const;

const RecoveryPhraseInput = ({
  hasError,
  onEnterPressed,
}: {
  hasError: boolean;
  onEnterPressed: () => Promise<void>;
}) => {
  const dispatch = useDispatch();
  const recoveryPassword = useRecoveryPassword();
  const recoveryPasswordError = useRecoveryPasswordError();

  const [forceShow, setForceShow] = useState(false);
  return (
    <SimpleSessionInput
      ariaLabel="Recovery password input"
      autoFocus={true}
      type={forceShow ? 'text' : 'password'}
      placeholder={window.i18n('recoveryPasswordEnter')}
      value={recoveryPassword}
      onValueChanged={(seed: string) => {
        dispatch(setRecoveryPassword(seed));
        dispatch(
          setRecoveryPasswordError(!seed ? window.i18n('recoveryPasswordEnter') : undefined)
        );
      }}
      onEnterPressed={() => void onEnterPressed()}
      providedError={recoveryPasswordError}
      errorDataTestId="error-message"
      inputDataTestId="recovery-phrase-input"
      buttonEnd={
        showHideButtonDataTestIds ? (
          <ShowHideButton
            forceShow={forceShow}
            toggleForceShow={() => {
              setForceShow(!forceShow);
            }}
            hasError={hasError}
            ariaLabels={showHideButtonAriaLabels}
            dataTestIds={showHideButtonDataTestIds}
          />
        ) : undefined
      }
    />
  );
};

export const RestoreAccount = () => {
  const step = useOnboardAccountRestorationStep();
  const recoveryPassword = useRecoveryPassword();
  const recoveryPasswordError = useRecoveryPasswordError();
  const displayName = useDisplayName();
  const displayNameError = useDisplayNameError();
  const progress = useProgress();

  const dispatch = useDispatch();

  const [cannotContinue, setCannotContinue] = useState(true);

  useRecoveryProgressEffect();

  const recoverAndFetchDisplayName = async () => {
    if (!(!!recoveryPassword && !recoveryPasswordError)) {
      return;
    }
    const trimmedPassword = recoveryPassword.trim();
    setRecoveryPassword(trimmedPassword);

    try {
      abortController = new AbortController();
      dispatch(setProgress(0));
      dispatch(setAccountRestorationStep(AccountRestoration.Loading));
      await signInAndFetchDisplayName({
        recoveryPassword: trimmedPassword,
        dispatch,
        abortSignal: abortController.signal,
      });
    } catch (e) {
      if (e instanceof NotFoundError || e instanceof TaskTimedOutError) {
        // abort display name polling if we get either error
        if (!abortController.signal.aborted) {
          abortController.abort();
        }
        window.log.error(
          `[onboarding] restore account: Failed to fetch a display name, so we will have to enter it manually. Error: ${e.message || e} `
        );
        return;
      }

      if (e instanceof NotEnoughWordsError) {
        dispatch(setRecoveryPasswordError(window.i18n('recoveryPasswordErrorMessageShort')));
      } else if (e instanceof InvalidWordsError) {
        dispatch(setRecoveryPasswordError(window.i18n('recoveryPasswordErrorMessageIncorrect')));
      } else {
        dispatch(setRecoveryPasswordError(window.i18n('recoveryPasswordErrorMessageGeneric')));
      }
      dispatch(setAccountRestorationStep(AccountRestoration.RecoveryPassword));
    }
  };

  const recoverAndEnterDisplayName = async () => {
    if (isEmpty(recoveryPassword) || !isEmpty(recoveryPasswordError)) {
      return;
    }

    try {
      const sanitizedName = sanitizeDisplayNameOrToast(displayName);

      // this should never happen, but just in case
      if (isEmpty(sanitizedName)) {
        return;
      }

      // this will throw if the display name is too long
      const validName = await ProfileManager.updateOurProfileDisplayNameOnboarding(sanitizedName);

      const trimmedPassword = recoveryPassword.trim();
      setRecoveryPassword(trimmedPassword);

      await signInWithNewDisplayName({
        displayName: validName,
        recoveryPassword: trimmedPassword,
        dispatch,
      });
    } catch (err) {
      window.log.error(
        `[onboarding] restore account: Failed with new display name! Error: ${err.message || String(err)}`
      );

      setCannotContinue(true);
      dispatch(setAccountRestorationStep(AccountRestoration.DisplayName));

      if (err instanceof EmptyDisplayNameError || err instanceof RetrieveDisplayNameError) {
        dispatch(setDisplayNameError(localize('displayNameErrorDescription').toString()));
      } else {
        // Note: we have to assume here that libsession threw an error because the name was too long since we covered the other cases.
        // The error reported by libsession is not localized
        dispatch(setDisplayNameError(localize('displayNameErrorDescriptionShorter').toString()));
      }
    }
  };

  return (
    <BackButtonWithinContainer
      margin={'3px 0 0 -36px'}
      shouldQuitOnClick={step !== AccountRestoration.RecoveryPassword}
      quitI18nMessageArgs={{ token: 'onboardingBackLoadAccount' }}
      onQuitVisible={() => {
        if (!abortController.signal.aborted) {
          abortController.abort();
        }
        dispatch(setRecoveryPassword(''));
        dispatch(setDisplayName(''));
        dispatch(setProgress(0));
        dispatch(setRecoveryPasswordError(undefined));
        dispatch(setDisplayNameError(undefined));
        if (
          step === AccountRestoration.Loading ||
          step === AccountRestoration.Finishing ||
          step === AccountRestoration.Finished
        ) {
          dispatch(setAccountRestorationStep(AccountRestoration.RecoveryPassword));
        }
      }}
      callback={() => {
        dispatch(setRecoveryPassword(''));
        dispatch(setDisplayName(''));
        dispatch(setProgress(0));
        dispatch(setRecoveryPasswordError(undefined));
        dispatch(setDisplayNameError(undefined));
      }}
    >
      <Flex
        $container={true}
        width="100%"
        $flexDirection="column"
        $justifyContent="flex-start"
        $alignItems="flex-start"
        margin={
          step === AccountRestoration.RecoveryPassword || step === AccountRestoration.DisplayName
            ? '0 0 0 8px'
            : '0px'
        }
      >
        {step === AccountRestoration.RecoveryPassword ? (
          <>
            <Flex $container={true} width={'100%'} $alignItems="center">
              <OnboardHeading>{window.i18n('sessionRecoveryPassword')}</OnboardHeading>
              <SessionIcon
                iconType="recoveryPasswordOutline"
                iconSize="medium"
                iconColor="var(--text-primary-color)"
                style={{ margin: '-4px 0 0 12px' }}
              />
            </Flex>
            <SpacerSM />
            <OnboardDescription>
              {window.i18n('recoveryPasswordRestoreDescription')}
            </OnboardDescription>
            <SpacerLG />
            <RecoveryPhraseInput
              hasError={!!recoveryPasswordError}
              onEnterPressed={recoverAndFetchDisplayName}
            />
            <SpacerLG />
            <ContinueButton
              onClick={recoverAndFetchDisplayName}
              disabled={!(!!recoveryPassword && !recoveryPasswordError)}
            />
          </>
        ) : step === AccountRestoration.DisplayName ? (
          <Flex $container={true} width="100%" $flexDirection="column" $alignItems="flex-start">
            <OnboardHeading>{window.i18n('displayNameNew')}</OnboardHeading>
            <SpacerSM />
            <OnboardDescription>{window.i18n('displayNameErrorNew')}</OnboardDescription>
            <SpacerLG />
            <SimpleSessionInput
              ariaLabel={localize('displayNameEnter').toString()}
              autoFocus={true}
              placeholder={localize('displayNameEnter').toString()}
              value={displayName}
              onValueChanged={(name: string) => {
                dispatch(setDisplayName(name));
                setCannotContinue(false);
              }}
              onEnterPressed={() => void recoverAndEnterDisplayName()}
              providedError={displayNameError}
              inputDataTestId="display-name-input"
              errorDataTestId="error-message"
            />
            <SpacerLG />
            <ContinueButton
              onClick={recoverAndEnterDisplayName}
              disabled={
                isEmpty(recoveryPassword) || !isEmpty(recoveryPasswordError) || cannotContinue
              }
            />
          </Flex>
        ) : (
          <SessionProgressBar
            initialValue={
              step !== AccountRestoration.Finished && step !== AccountRestoration.Complete
                ? progress
                : 100
            }
            progress={progress}
            margin={'0'}
            title={window.i18n('waitOneMoment')}
            subtitle={window.i18n('loadAccountProgressMessage')}
            showPercentage={true}
          />
        )}
      </Flex>
    </BackButtonWithinContainer>
  );
};
