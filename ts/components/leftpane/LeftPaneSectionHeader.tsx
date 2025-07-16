import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { LeftOverlayMode, sectionActions, SectionType } from '../../state/ducks/section';
import { disableRecoveryPhrasePrompt } from '../../state/ducks/userConfig';
import { getFocusedSection, useLeftOverlayMode } from '../../state/selectors/section';
import { useHideRecoveryPasswordEnabled } from '../../state/selectors/settings';
import { useIsDarkTheme } from '../../state/theme/selectors/theme';
import { getShowRecoveryPhrasePrompt } from '../../state/selectors/userConfig';
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

function getLeftPaneHeaderLabel(
  leftOverlayMode: LeftOverlayMode | undefined,
  focusedSection: SectionType
): string {
  let label = '';

  switch (leftOverlayMode) {
    case 'open-group':
      label = window.i18n('communityJoin');
      break;
    case 'closed-group':
      label = window.i18n('groupCreate');
      break;
    case 'message':
      label = window.i18n('messageNew', { count: 1 });
      break;
    case 'message-requests':
      label = window.i18n('sessionMessageRequests');
      break;
    case 'invite-a-friend':
      label = window.i18n('sessionInviteAFriend');
      break;
    case 'choose-action':
    default:
      label = window.i18n('messages');
  }

  switch (focusedSection) {
    case SectionType.Settings:
      label = window.i18n('sessionSettings');
      break;
    case SectionType.Message:
    default:
  }

  return label;
}

export const LeftPaneBanner = () => {
  const isDarkTheme = useIsDarkTheme();
  const section = useSelector(getFocusedSection);
  const isSignInWithRecoveryPhrase = isSignWithRecoveryPhrase();
  const hideRecoveryPassword = useHideRecoveryPasswordEnabled();

  const dispatch = useDispatch();

  const showRecoveryPhraseModal = () => {
    dispatch(disableRecoveryPhrasePrompt());
    dispatch(sectionActions.showLeftPaneSection(SectionType.Settings));
    dispatch(sectionActions.showSettingsSection('recovery-password'));
  };

  if (section !== SectionType.Message || isSignInWithRecoveryPhrase || hideRecoveryPassword) {
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
        padding={'var(--margins-md)'}
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
        <p>{window.i18n('recoveryPasswordBannerDescription')}</p>
        <SpacerMD />
        <SessionButton
          ariaLabel="Reveal recovery phrase button"
          text={window.i18n('theContinue')}
          onClick={showRecoveryPhraseModal}
          buttonColor={SessionButtonColor.PrimaryDark}
          dataTestId="reveal-recovery-phrase"
        />
      </StyledBanner>
    </StyledLeftPaneBanner>
  );
};

export const LeftPaneSectionHeader = () => {
  const showRecoveryPhrasePrompt = useSelector(getShowRecoveryPhrasePrompt);
  const focusedSection = useSelector(getFocusedSection);
  const leftOverlayMode = useLeftOverlayMode();

  const dispatch = useDispatch();
  const returnToActionChooser = () => {
    if (leftOverlayMode === 'closed-group') {
      dispatch(searchActions.clearSearch());
    }
    dispatch(sectionActions.setLeftOverlayMode('choose-action'));
  };

  const label = getLeftPaneHeaderLabel(leftOverlayMode, focusedSection);
  const isMessageSection = focusedSection === SectionType.Message;

  return (
    <Flex $flexDirection="column">
      <StyledLeftPaneSectionHeader
        $container={true}
        $flexDirection="row"
        $justifyContent="space-between"
        $alignItems="center"
      >
        {leftOverlayMode &&
        leftOverlayMode !== 'choose-action' &&
        leftOverlayMode !== 'message-requests' ? (
          <SessionLucideIconButton
            ariaLabel="Back button"
            iconSize="large"
            unicode={LUCIDE_ICONS_UNICODE.CHEVRON_LEFT}
            onClick={returnToActionChooser}
            dataTestId="back-button"
          />
        ) : (
          <SpacerSM />
        )}
        <SectionTitle color={'var(--text-primary-color)'}>{label}</SectionTitle>
        {isMessageSection && <MenuButton />}
      </StyledLeftPaneSectionHeader>
      {showRecoveryPhrasePrompt && <LeftPaneBanner />}
    </Flex>
  );
};
