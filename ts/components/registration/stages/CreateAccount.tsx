import { isEmpty } from 'lodash';
import { useDispatch } from 'react-redux';
import useMount from 'react-use/lib/useMount';
import { useState } from 'react';
import { SettingsKey } from '../../../data/settings-key';
import { mnDecode } from '../../../session/crypto/mnemonic';
import { ProfileManager } from '../../../session/profile_manager/ProfileManager';
import { StringUtils } from '../../../session/utils';
import { fromHex } from '../../../session/utils/String';
import {
  AccountCreation,
  setAccountCreationStep,
  setDisplayName,
  setDisplayNameError,
  setHexGeneratedPubKey,
  setRecoveryPassword,
} from '../../../state/onboarding/ducks/registration';
import {
  useDisplayName,
  useDisplayNameError,
  useRecoveryPassword,
} from '../../../state/onboarding/selectors/registration';
import {
  generateMnemonic,
  registerSingleDevice,
  sessionGenerateKeyPair,
} from '../../../util/accountManager';
import { Storage, setSignWithRecoveryPhrase } from '../../../util/storage';
import { Flex } from '../../basic/Flex';
import { SpacerLG, SpacerSM } from '../../basic/Text';
import { resetRegistration } from '../RegistrationStages';
import { ContinueButton, OnboardDescription, OnboardHeading } from '../components';
import { BackButtonWithinContainer } from '../components/BackButton';
import { sanitizeDisplayNameOrToast } from '../utils';
import { EmptyDisplayNameError, RetrieveDisplayNameError } from '../../../session/utils/errors';
import { localize } from '../../../localization/localeTools';
import { SimpleSessionInput } from '../../inputs/SessionInput';

type AccountCreateDetails = {
  recoveryPassword: string;
  displayName: string;
};

async function signUp(signUpDetails: AccountCreateDetails) {
  const { displayName, recoveryPassword } = signUpDetails;

  try {
    await resetRegistration();
    await registerSingleDevice(recoveryPassword, 'english', displayName);
    await Storage.put(SettingsKey.hasSyncedInitialConfigurationItem, Date.now());
    await setSignWithRecoveryPhrase(false);
    window.Whisper.events.trigger('openInbox');
  } catch (e) {
    await resetRegistration();
    throw e;
  }
}

export const CreateAccount = () => {
  const recoveryPassword = useRecoveryPassword();
  const displayName = useDisplayName();
  const displayNameError = useDisplayNameError();

  const dispatch = useDispatch();

  const [cannotContinue, setCannotContinue] = useState(true);

  const generateMnemonicAndKeyPair = async () => {
    if (recoveryPassword === '') {
      const mnemonic = await generateMnemonic();

      let seedHex = mnDecode(mnemonic);
      // handle shorter than 32 bytes seeds
      const privKeyHexLength = 32 * 2;
      if (seedHex.length !== privKeyHexLength) {
        seedHex = seedHex.concat('0'.repeat(32));
        seedHex = seedHex.substring(0, privKeyHexLength);
      }
      const seed = fromHex(seedHex);
      const keyPair = await sessionGenerateKeyPair(seed);
      const newHexPubKey = StringUtils.decode(keyPair.pubKey, 'hex');

      dispatch(setRecoveryPassword(mnemonic));
      dispatch(setHexGeneratedPubKey(newHexPubKey)); // our 'frontend' account ID
    }
  };

  useMount(() => {
    void generateMnemonicAndKeyPair();
  });

  const signUpWithDetails = async () => {
    try {
      const sanitizedName = sanitizeDisplayNameOrToast(displayName);

      // this should never happen, but just in case
      if (isEmpty(sanitizedName)) {
        return;
      }

      // this throws if the display name is too long
      const validName = await ProfileManager.updateOurProfileDisplayNameOnboarding(sanitizedName);

      await signUp({
        displayName: validName,
        recoveryPassword,
      });

      dispatch(setAccountCreationStep(AccountCreation.Done));
    } catch (err) {
      window.log.error(
        `[onboarding] create account: signUpWithDetails failed! Error: ${err.message || String(err)}`
      );

      setCannotContinue(true);
      dispatch(setAccountCreationStep(AccountCreation.DisplayName));

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
      shouldQuitOnClick={true}
      quitI18nMessageArgs={{ token: 'onboardingBackAccountCreation' }}
      callback={() => {
        dispatch(setDisplayName(''));
        dispatch(setRecoveryPassword(''));
        dispatch(setDisplayNameError(undefined));
      }}
    >
      <Flex
        $container={true}
        width="100%"
        $flexDirection="column"
        $alignItems="flex-start"
        margin={'0 0 0 8px'}
      >
        <OnboardHeading>{window.i18n('displayNamePick')}</OnboardHeading>
        <SpacerSM />
        <OnboardDescription>{window.i18n('displayNameDescription')}</OnboardDescription>
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
          onEnterPressed={() => void signUpWithDetails()}
          providedError={displayNameError}
          inputDataTestId="display-name-input"
          errorDataTestId="error-message"
        />
        <SpacerLG />
        <ContinueButton onClick={signUpWithDetails} disabled={cannotContinue} />
      </Flex>
    </BackButtonWithinContainer>
  );
};
