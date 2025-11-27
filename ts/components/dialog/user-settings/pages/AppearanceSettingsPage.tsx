import useUpdate from 'react-use/lib/useUpdate';
import useInterval from 'react-use/lib/useInterval';

import styled from 'styled-components';
import { useDispatch } from 'react-redux';
import { isFinite, isNumber, range } from 'lodash';
import { contextMenu, Menu } from 'react-contexify';
import { useRef } from 'react';

import { type UserSettingsModalState } from '../../../../state/ducks/modalDialog';
import {
  PanelButton,
  PanelButtonGroup,
  PanelButtonTextWithSubText,
  PanelLabelWithDescription,
} from '../../../buttons/panel/PanelButton';
import {
  ModalBasicHeader,
  SessionWrapperModal,
  WrapperModalWidth,
} from '../../../SessionWrapperModal';
import { ModalBackButton } from '../../shared/ModalBackButton';
import {
  useUserSettingsBackAction,
  useUserSettingsCloseAction,
  useUserSettingsTitle,
} from './userSettingsHooks';
import { SettingsToggleBasic } from '../components/SettingsToggleBasic';
import {
  useFollowSystemThemeSetting,
  useHideMenuBarSetting,
} from '../../../../state/selectors/settings';
import { isHideMenuBarSupported } from '../../../../types/Settings';
import {
  getPrimaryColors,
  getThemeColors,
  type StyleSessionSwitcher,
} from '../../../../themes/constants/colors';
import { RadioDot, SessionRadio } from '../../../basic/SessionRadio';
import { usePrimaryColor } from '../../../../state/selectors/primaryColor';
import { switchPrimaryColorTo } from '../../../../themes/switchPrimaryColor';
import { useTheme } from '../../../../state/theme/selectors/theme';
import { switchThemeTo } from '../../../../themes/switchTheme';
import { StyledPanelButtonSeparator } from '../../../buttons/panel/StyledPanelButtonGroupSeparator';
import { GenericPanelButtonWithAction } from '../../../buttons/panel/GenericPanelButtonWithAction';
import { Flex } from '../../../basic/Flex';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';
import { LucideIcon } from '../../../icon/LucideIcon';
import { H9 } from '../../../basic/Heading';
import { getMenuAnimation } from '../../../menu/MenuAnimation';
import { ItemWithDataTestId } from '../../../menu/items/MenuItemWithDataTestId';
import { ZOOM_FACTOR } from '../../../../session/constants';
import { SessionContextMenuContainerItemsCentered } from '../../../SessionContextMenuContainer';

const StyledPrimaryColorSwitcherContainer = styled.div`
  display: flex;
  flex-direction: row;
  padding-inline: 20px;
  align-items: center;
  align-self: center;
  width: 100%;
  justify-content: space-around;
  height: var(--panel-button-container-min-height);
`;

function PrimaryColorSwitcher() {
  const selectedPrimaryColor = usePrimaryColor();
  const dispatch = useDispatch();
  const diameterRadioBorder = 35;

  return (
    <StyledPrimaryColorSwitcherContainer>
      {getPrimaryColors().map(item => {
        const overriddenColorsVars = {
          '--primary-color': item.color,
          '--text-primary-color': item.id === selectedPrimaryColor ? undefined : 'transparent',
        } as React.CSSProperties;
        return (
          <RadioDot
            selected={true}
            onClick={() => {
              void switchPrimaryColorTo(item.id, dispatch);
            }}
            key={item.id}
            disabled={false}
            dataTestId={undefined}
            diameterRadioBorder={diameterRadioBorder}
            style={overriddenColorsVars}
            ariaLabel={item.ariaLabel}
          />
        );
      })}
    </StyledPrimaryColorSwitcherContainer>
  );
}

const StyledPreview = styled.svg`
  flex-shrink: 0;
  height: 58px;
`;

const ThemeIcon = (props: { style: StyleSessionSwitcher }) => {
  return (
    <StyledPreview xmlSpace="preserve" viewBox="0 0 80 72" fill={props.style.background}>
      <path
        stroke={props.style.border}
        d="M7.5.9h64.6c3.6 0 6.5 2.9 6.5 6.5v56.9c0 3.6-2.9 6.5-6.5 6.5H7.5c-3.6 0-6.5-2.9-6.5-6.5V7.4C1 3.9 3.9.9 7.5.9z"
      />
      <path
        fill={props.style.receivedBackground}
        d="M8.7 27.9c0-3.2 2.6-5.7 5.7-5.7h30.4c3.2 0 5.7 2.6 5.7 5.7 0 3.2-2.6 5.7-5.7 5.7H14.4c-3.1.1-5.7-2.5-5.7-5.7z"
      />
      <path
        fill={props.style.sentBackground}
        d="M32.6 42.2c0-3.2 2.6-5.7 5.7-5.7h27c3.2 0 5.7 2.6 5.7 5.7 0 3.2-2.6 5.7-5.7 5.7h-27c-3.1 0-5.7-2.5-5.7-5.7z"
      />
    </StyledPreview>
  );
};

const StyledThemeName = styled.div`
  font-size: var(--font-size-h8);
  color: var(--text-primary-color);
  font-weight: 700;
  flex-shrink: 0;
`;

const Themes = () => {
  const themes = getThemeColors();
  const selectedTheme = useTheme();
  const dispatch = useDispatch();

  return (
    <>
      {themes.map(theme => (
        <>
          <PanelButton
            dataTestId="invalid-data-testid"
            key={theme.id}
            onClick={() => {
              void switchThemeTo({
                theme: theme.id,
                mainWindow: true,
                dispatch,
              });
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                maxHeight: '100%',
                gap: 'var(--margins-lg)',
                alignItems: 'center',
              }}
            >
              <ThemeIcon style={theme.style} />
              <StyledThemeName>{theme.title}</StyledThemeName>
            </div>
            <SessionRadio
              active={selectedTheme === theme.id}
              value={theme.id}
              inputName={'theme-switcher'}
              style={{ padding: '0 0 0 var(--margins-lg)' }}
            />
          </PanelButton>
          <StyledPanelButtonSeparator />
        </>
      ))}
    </>
  );
};

function ChatBubblePreview() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 359 158"
      style={{
        borderRadius: '16px',
        padding: '0px',
        marginInline: 'var(--margins-sm)',
      }}
    >
      <rect width="358" height="158" x=".74" fill="var(--background-secondary-color)" rx="11" />
      <rect
        width="284"
        height="74"
        x="15.74"
        y="15"
        fill="var(--message-bubbles-received-background-color)"
        rx="16"
      />
      <mask id="a" fill="var(--text-primary-color)">
        <path d="M28.74 25h199v30h-199V25Z" />
      </mask>
      <path fill="var(--text-primary-color)" d="M28.74 55h4V25h-8v30h4Z" mask="url(#a)" />
      <rect
        width="203"
        height="39"
        x="140.74"
        y="104"
        fill="var(--message-bubbles-sent-background-color)"
        rx="16"
      />
      <text
        fill="var(--message-bubbles-received-text-color)"
        x="40px"
        y="37px"
        style={{ letterSpacing: '0.43', fontWeight: 'bold' }}
      >
        You
      </text>
      <text
        fill="var(--message-bubbles-received-text-color)"
        x="40px"
        y="54px"
        style={{ letterSpacing: '0.43' }}
      >
        What are you doing this week?
      </text>
      <text
        fill="var(--message-bubbles-received-text-color)"
        x="30px"
        y="75px"
        style={{ letterSpacing: '0.43' }}
      >
        Going to the beach, what about you?
      </text>

      <text
        fill="var(--message-bubbles-sent-text-color)"
        x="155px"
        y="130px"
        style={{ letterSpacing: '0.43' }}
      >
        Oh cool, ill see you there!
      </text>
    </svg>
  );
}

async function setZoomFactor(value: number, forceUpdate: () => void) {
  if (!isNumber(value) || !isFinite(value) || value < 0) {
    throw new Error('setZoomFactor: value not valid');
  }

  await window.setSettingValue('zoom-factor-setting', value);
  window.updateZoomFactor();
  forceUpdate();
}

const zoomFactorMenuId = 'zoom-factor-menu';

const zoomFactorValues = range(
  ZOOM_FACTOR.MIN,
  ZOOM_FACTOR.MAX + ZOOM_FACTOR.STEP, // just so the upper end is an option
  ZOOM_FACTOR.STEP
);

const ZoomFactorMenuPicker = ({
  forceUpdate,
  currentZoomFactor,
}: {
  forceUpdate: () => void;
  currentZoomFactor: number;
}) => {
  const selectedRef = useRef<HTMLDivElement | null>(null);

  const handleShow = (isVisible: boolean) => {
    if (!isVisible) {
      return;
    }
    requestAnimationFrame(() => {
      selectedRef.current?.scrollIntoView({
        block: 'center',
      });
      // Note: we can't auto select the starting item of keyboard navigation with react-contexify.
    });
  };

  return (
    <SessionContextMenuContainerItemsCentered>
      <Menu
        id={zoomFactorMenuId}
        animation={getMenuAnimation()}
        onVisibilityChange={handleShow}
        style={{
          zIndex: 400,
          maxHeight: '200px',
          width: '100px',
          minWidth: '100px',
          maxWidth: '100px',
          pointerEvents: 'all',
          overflow: 'auto',
        }}
      >
        {zoomFactorValues.map(m => {
          return (
            <ItemWithDataTestId
              key={m}
              onClick={() => {
                void setZoomFactor(m, forceUpdate);
              }}
              style={{
                backgroundColor: m === currentZoomFactor ? 'var(--primary-color)' : 'unset',
              }}
            >
              <div ref={m === currentZoomFactor ? selectedRef : undefined}>{m}%</div>
            </ItemWithDataTestId>
          );
        })}
      </Menu>
    </SessionContextMenuContainerItemsCentered>
  );
};

function ZoomFactorPicker() {
  const forceUpdate = useUpdate();
  const baseDataTestId = 'zoom-factor';
  useInterval(() => {
    // the keyboard shortcuts can change this value. So let's make this refresh often when visible
    forceUpdate();
  }, 500);

  const zoomFactorCurrentSetting =
    window.getSettingValue('zoom-factor-setting') || ZOOM_FACTOR.DEFAULT;
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <GenericPanelButtonWithAction
      rowDataTestId={`${baseDataTestId}-settings-row`}
      onClick={e => {
        const boundingRect = containerRef.current?.getBoundingClientRect();
        if (!boundingRect) {
          return;
        }
        contextMenu.show({
          id: zoomFactorMenuId,
          event: e,
          position: {
            x: boundingRect.left + boundingRect.width / 2,
            y: boundingRect.top + boundingRect.height / 2 - 75,
          },
        });
      }}
      textElement={
        <PanelButtonTextWithSubText
          text={{ token: 'zoomFactor' }}
          subText={{ token: 'zoomFactorDescription' }}
          textDataTestId={`${baseDataTestId}-settings-text`}
          subTextDataTestId={`${baseDataTestId}-settings-sub-text`}
        />
      }
      actionElement={
        <Flex
          $container={true}
          $flexDirection="row"
          width="100%"
          height="100%"
          $alignItems="center"
          ref={containerRef}
        >
          <ZoomFactorMenuPicker
            forceUpdate={forceUpdate}
            currentZoomFactor={zoomFactorCurrentSetting}
          />
          <LucideIcon
            unicode={LUCIDE_ICONS_UNICODE.CHEVRON_DOWN}
            iconSize="small"
            iconColor="var(--text-primary-color)"
            style={{ paddingInlineEnd: 'var(--margins-xs)' }}
          />
          <H9 style={{ flexShrink: 0 }}>{zoomFactorCurrentSetting}%</H9>
        </Flex>
      }
    />
  );
}

export function AppearanceSettingsPage(modalState: UserSettingsModalState) {
  const backAction = useUserSettingsBackAction(modalState);
  const closeAction = useUserSettingsCloseAction(modalState);
  const title = useUserSettingsTitle(modalState);

  const followSystemThemeSetting = useFollowSystemThemeSetting();
  const hideMenuBarSetting = useHideMenuBarSetting();

  const themes = getThemeColors();
  const selectedTheme = useTheme();
  const selectedThemeColors = themes.find(theme => theme.id === selectedTheme);

  if (!selectedThemeColors) {
    throw new Error('No theme colors found');
  }

  return (
    <SessionWrapperModal
      headerChildren={
        <ModalBasicHeader
          title={title}
          bigHeader={true}
          showExitIcon={true}
          extraLeftButton={backAction ? <ModalBackButton onClick={backAction} /> : undefined}
        />
      }
      onClose={closeAction || undefined}
      shouldOverflow={true}
      allowOutsideClick={false}
      $contentMinWidth={WrapperModalWidth.normal}
    >
      <PanelLabelWithDescription title={{ token: 'appearanceThemes' }} />
      <PanelButtonGroup>
        <Themes />
      </PanelButtonGroup>
      <PanelLabelWithDescription title={{ token: 'appearancePrimaryColor' }} />
      <PanelButtonGroup>
        <PrimaryColorSwitcher />
      </PanelButtonGroup>
      <PanelLabelWithDescription title={{ token: 'themePreview' }} />
      <ChatBubblePreview />
      <PanelLabelWithDescription title={{ token: 'darkMode' }} />

      <PanelButtonGroup>
        <SettingsToggleBasic
          baseDataTestId="auto-dark-mode"
          text={{ token: 'appearanceAutoDarkMode' }}
          subText={{ token: 'followSystemSettings' }}
          onClick={followSystemThemeSetting.toggle}
          active={followSystemThemeSetting.enabled}
        />
      </PanelButtonGroup>
      <PanelLabelWithDescription title={{ token: 'display' }} />
      <PanelButtonGroup>
        <ZoomFactorPicker />
      </PanelButtonGroup>
      {isHideMenuBarSupported() ? (
        <>
          <PanelLabelWithDescription title={{ token: 'menuBar' }} />
          <PanelButtonGroup>
            <SettingsToggleBasic
              baseDataTestId="hide-menu-bar"
              text={{ token: 'appearanceHideMenuBar' }}
              subText={{ token: 'hideMenuBarDescription' }}
              onClick={hideMenuBarSetting.toggle}
              active={hideMenuBarSetting.enabled}
            />
          </PanelButtonGroup>
        </>
      ) : null}
    </SessionWrapperModal>
  );
}
