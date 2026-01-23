import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { getAppDispatch } from '../../state/dispatch';
import { LeftOverlayMode, sectionActions } from '../../state/ducks/section';
import { useLeftOverlayMode } from '../../state/selectors/section';
import {
  getShowRecoveryPhrasePrompt,
  useHideRecoveryPasswordEnabled,
} from '../../state/selectors/settings';
import { useIsDarkTheme } from '../../state/theme/selectors/theme';
import { isSignWithRecoveryPhrase } from '../../util/storage';
import { Flex } from '../basic/Flex';
import { SessionButton, SessionButtonColor } from '../basic/SessionButton';
import { SpacerMD, SpacerSM } from '../basic/Text';
import { MenuButton } from '../buttons';
import { SessionIcon } from '../icon';
import { Localizer } from '../basic/Localizer';
import { H4 } from '../basic/Heading';
import { searchActions } from '../../state/ducks/search';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';
import { SessionLucideIconButton } from '../icon/SessionIconButton';
import { tr } from '../../localization/localeTools';
import { userSettingsModal } from '../../state/ducks/modalDialog';
import { SettingsKey } from '../../data/settings-key';
import { LeftPaneAnnouncements } from './LeftPaneAnnoucements';

const StyledLeftPaneSectionHeader = styled(Flex)`
  height: var(--main-view-header-height);
  padding-inline-end: 7px;
  transition: var(--default-duration);
`;

const SectionTitle = styled(H4)`
  flex-grow: 1;
`;

const StyledProgressBarContainer = styled.div`
  width: 100%;
  height: 5px;
  flex-direction: row;
  background: var(--border-color);
`;

const StyledProgressBarInner = styled.div`
  background: var(--primary-color);
  width: 100%;
  transition: width var(--default-duration) ease-in;
  height: 100%;
`;

const StyledBanner = styled(Flex)`
  p {
    padding: 0;
    margin: 0;
    line-height: 1.2;
  }

  p:nth-child(2) {
    font-size: 12px;
  }

  .session-button {
    width: 100%;
  }

  svg {
    margin-top: -3px;
    margin-left: var(--margins-xs);
  }
`;

const StyledBannerTitle = styled.p`
  font-size: var(--font-size-h8);
  font-weight: 500;
  line-height: 1;
`;

const StyledLeftPaneBanner = styled.div`
  background: var(--background-secondary-color);
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid var(--border-color);
`;

function getLeftPaneHeaderLabel(leftOverlayMode: LeftOverlayMode | undefined): string {
  let label = '';

  switch (leftOverlayMode) {
    case 'open-group':
      label = tr('communityJoin');
      break;
    case 'closed-group':
      label = tr('groupCreate');
      break;
    case 'message':
      label = tr('messageNew', { count: 1 });
      break;
    case 'message-requests':
      label = tr('sessionMessageRequests');
      break;
    case 'invite-a-friend':
      label = tr('sessionInviteAFriend');
      break;
    case 'choose-action':
    default:
      label = tr('messages');
  }

  return label;
}

const LeftPaneBanner = () => {
  const isDarkTheme = useIsDarkTheme();
  const isSignInWithRecoveryPhrase = isSignWithRecoveryPhrase();
  const hideRecoveryPassword = useHideRecoveryPasswordEnabled();

  const dispatch = getAppDispatch();

  const showRecoveryPhraseModal = async () => {
    await window.setSettingValue(SettingsKey.showRecoveryPhrasePrompt, false);
    dispatch(userSettingsModal({ userSettingsPage: 'recovery-password' }));
  };

  if (isSignInWithRecoveryPhrase || hideRecoveryPassword) {
    return null;
  }

  return (
    <StyledLeftPaneBanner>
      <StyledProgressBarContainer>
        <StyledProgressBarInner />
      </StyledProgressBarContainer>
      <StyledBanner
        $container={true}
        width={'100%'}
        $flexDirection="column"
        $alignItems={'flex-start'}
        $padding={'var(--margins-md)'}
      >
        <Flex $container={true} width={'100%'} $alignItems="flex-start">
          <StyledBannerTitle>
            <Localizer token="recoveryPasswordBannerTitle" />
          </StyledBannerTitle>
          <SessionIcon
            iconType={isDarkTheme ? 'recoveryPasswordFill' : 'recoveryPasswordOutline'}
            iconSize="medium"
            iconColor="var(--text-primary-color)"
          />
        </Flex>
        <p>{tr('recoveryPasswordBannerDescription')}</p>
        <SpacerMD />
        <SessionButton
          ariaLabel="Reveal recovery phrase button"
          text={tr('theContinue')}
          onClick={showRecoveryPhraseModal}
          buttonColor={SessionButtonColor.PrimaryDark}
          dataTestId="reveal-recovery-phrase"
        />
      </StyledBanner>
    </StyledLeftPaneBanner>
  );
};

export const LeftPaneSectionHeader = () => {
  const leftOverlayMode = useLeftOverlayMode();
  const noOverlayMode = !leftOverlayMode;
  const showRecoveryPhrasePrompt = useSelector(getShowRecoveryPhrasePrompt);

  const dispatch = getAppDispatch();
  const goBack = () => {
    if (!leftOverlayMode) {
      return;
    }
    if (leftOverlayMode === 'choose-action') {
      dispatch(sectionActions.resetLeftOverlayMode());

      return;
    }
    if (leftOverlayMode === 'message-requests') {
      dispatch(sectionActions.resetLeftOverlayMode());

      return;
    }
    if (leftOverlayMode === 'closed-group') {
      dispatch(searchActions.clearSearch());
      dispatch(sectionActions.setLeftOverlayMode('choose-action'));

      return;
    }
    dispatch(sectionActions.setLeftOverlayMode('choose-action'));
  };

  const label = getLeftPaneHeaderLabel(leftOverlayMode);

  return (
    <Flex $flexDirection="column">
      <StyledLeftPaneSectionHeader
        $container={true}
        $flexDirection="row"
        $justifyContent="space-between"
        $alignItems="center"
      >
        {leftOverlayMode ? (
          <SessionLucideIconButton
            ariaLabel="Back button"
            iconSize="large"
            unicode={LUCIDE_ICONS_UNICODE.CHEVRON_LEFT}
            onClick={goBack}
            dataTestId="back-button"
            padding="var(--margins-sm)"
          />
        ) : (
          <SpacerSM />
        )}
        <SectionTitle color={'var(--text-primary-color)'} onClick={goBack}>
          {label}
        </SectionTitle>
        {!leftOverlayMode && <MenuButton />}
      </StyledLeftPaneSectionHeader>
      {noOverlayMode && showRecoveryPhrasePrompt && <LeftPaneBanner />}
      {noOverlayMode && <LeftPaneAnnouncements />}
    </Flex>
  );
};
