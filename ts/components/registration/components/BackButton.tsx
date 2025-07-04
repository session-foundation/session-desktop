import { ReactNode } from 'react';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import { updateQuitModal } from '../../../state/onboarding/ducks/modals';
import {
  AccountRestoration,
  Onboarding,
  setAccountRestorationStep,
  setDirection,
  setOnboardingStep,
} from '../../../state/onboarding/ducks/registration';
import {
  useOnboardAccountRestorationStep,
  useOnboardStep,
} from '../../../state/onboarding/selectors/registration';
import { deleteDbLocally } from '../../../util/accountManager';
import { Flex } from '../../basic/Flex';
import { SessionButtonColor } from '../../basic/SessionButton';
import type { LocalizerProps } from '../../basic/Localizer';
import { SessionLucideIconButton } from '../../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../../icon/lucide';
import { localize } from '../../../localization/localeTools';

/** Min height should match the onboarding step with the largest height this prevents the loading spinner from jumping around while still keeping things centered  */
const StyledBackButtonContainer = styled(Flex)`
  min-height: 276px;
  height: 100%;
`;

export const BackButtonWithinContainer = ({
  children,
  margin,
  callback,
  onQuitVisible,
  shouldQuitOnClick,
  quitI18nMessageArgs,
}: {
  children: ReactNode;
  margin?: string;
  callback?: () => void;
  onQuitVisible?: () => void;
  shouldQuitOnClick?: boolean;
  quitI18nMessageArgs: LocalizerProps;
}) => {
  return (
    <StyledBackButtonContainer
      $container={true}
      width={'100%'}
      $flexDirection="row"
      $justifyContent="flex-start"
      $alignItems="flex-start"
    >
      <div style={{ margin }}>
        <BackButton
          callback={callback}
          onQuitVisible={onQuitVisible}
          shouldQuitOnClick={shouldQuitOnClick}
          quitI18nMessageArgs={quitI18nMessageArgs}
        />
      </div>
      {children}
    </StyledBackButtonContainer>
  );
};

const BackButton = ({
  callback,
  onQuitVisible,
  shouldQuitOnClick,
  quitI18nMessageArgs,
}: {
  callback?: () => void;
  onQuitVisible?: () => void;
  shouldQuitOnClick?: boolean;
  quitI18nMessageArgs: LocalizerProps;
}) => {
  const step = useOnboardStep();
  const restorationStep = useOnboardAccountRestorationStep();

  const dispatch = useDispatch();

  return (
    <SessionLucideIconButton
      ariaLabel="Back button"
      iconSize="large"
      unicode={LUCIDE_ICONS_UNICODE.CHEVRON_LEFT}
      iconColor="var(--color-text-primary)"
      dataTestId="back-button"
      onClick={() => {
        if (shouldQuitOnClick && quitI18nMessageArgs) {
          if (onQuitVisible) {
            onQuitVisible();
          }

          dispatch(
            updateQuitModal({
              title: localize('warning').toString(),
              i18nMessage: quitI18nMessageArgs,
              okTheme: SessionButtonColor.Danger,
              okText: localize('quitButton').toString(),
              onClickOk: async () => {
                try {
                  window.log.warn(
                    '[onboarding] Deleting everything on device but keeping network data'
                  );
                  await deleteDbLocally();
                } catch (error) {
                  window.log.warn(
                    '[onboarding] Something went wrong when deleting all local data:',
                    error && error.stack ? error.stack : error
                  );
                } finally {
                  window.restart();
                }
              },
              onClickCancel: () => {
                window.inboxStore?.dispatch(updateQuitModal(null));
              },
            })
          );
          return;
        }

        dispatch(setDirection('backward'));
        if (step === Onboarding.CreateAccount) {
          dispatch(setOnboardingStep(Onboarding.Start));
        }

        if (step === Onboarding.RestoreAccount) {
          if (restorationStep === AccountRestoration.RecoveryPassword) {
            dispatch(setOnboardingStep(Onboarding.Start));
          } else if (restorationStep === AccountRestoration.DisplayName) {
            dispatch(setAccountRestorationStep(AccountRestoration.RecoveryPassword));
          }
        }

        if (callback) {
          callback();
        }
      }}
    />
  );
};
