import { useState, useEffect } from 'react';
import useUpdate from 'react-use/lib/useUpdate';
import styled from 'styled-components';
import { ipcRenderer } from 'electron';

import { tr } from '../../../../localization/localeTools';
import { type UserSettingsModalState } from '../../../../state/ducks/modalDialog';
import { PanelButtonGroup } from '../../../buttons/panel/PanelButton';
import { ModalBasicHeader } from '../../../SessionWrapperModal';
import { ModalBackButton } from '../../shared/ModalBackButton';
import {
  useUserSettingsBackAction,
  useUserSettingsCloseAction,
  useUserSettingsTitle,
} from './userSettingsHooks';
import { SettingsToggleBasic } from '../components/SettingsToggleBasic';
import { SettingsKey } from '../../../../data/settings-key';
import { ToastUtils } from '../../../../session/utils';
import { UserSettingsModalContainer } from '../components/UserSettingsModalContainer';
import { ModalSimpleSessionInput } from '../../../inputs/SessionInput';
import { Flex } from '../../../basic/Flex';
import { SessionButton, SessionButtonColor } from '../../../basic/SessionButton';

const ProxyInputsContainer = styled(Flex)`
  width: 100%;
  gap: var(--margins-md);
  padding: var(--margins-md) 0;
`;

type ProxySettings = {
  enabled: boolean;
  bootstrapOnly: boolean;
  host: string;
  port: string;
  username: string;
  password: string;
};

async function loadProxySettings(): Promise<ProxySettings> {
  const enabled = Boolean(window.getSettingValue(SettingsKey.proxyEnabled));
  const bootstrapOnly = Boolean(window.getSettingValue(SettingsKey.proxyBootstrapOnly));
  const host = (window.getSettingValue(SettingsKey.proxyHost) as string) || '';
  const port = String(window.getSettingValue(SettingsKey.proxyPort) || '');
  const username = (window.getSettingValue(SettingsKey.proxyUsername) as string) || '';
  const password = (window.getSettingValue(SettingsKey.proxyPassword) as string) || '';

  return { enabled, bootstrapOnly, host, port, username, password };
}

function validateProxySettings(settings: ProxySettings): { valid: boolean; error?: string } {
  if (!settings.enabled) {
    return { valid: true };
  }

  if (!settings.host || settings.host.trim() === '') {
    return { valid: false, error: tr('proxyValidationErrorHost') };
  }

  const portNum = parseInt(settings.port, 10);
  if (Number.isNaN(portNum) || portNum < 1 || portNum > 65535) {
    return { valid: false, error: tr('proxyValidationErrorPort') };
  }

  return { valid: true };
}

async function saveProxySettings(settings: ProxySettings): Promise<boolean> {
  const validation = validateProxySettings(settings);
  if (!validation.valid) {
    ToastUtils.pushToastError('proxyValidationError', validation.error || '');
    return false;
  }

  await window.setSettingValue(SettingsKey.proxyEnabled, settings.enabled);
  await window.setSettingValue(SettingsKey.proxyBootstrapOnly, settings.bootstrapOnly);
  await window.setSettingValue(SettingsKey.proxyHost, settings.host);
  await window.setSettingValue(SettingsKey.proxyPort, parseInt(settings.port, 10) || 0);
  await window.setSettingValue(SettingsKey.proxyUsername, settings.username);
  await window.setSettingValue(SettingsKey.proxyPassword, settings.password);

  // Notify main process to apply proxy settings
  const applyResult = await new Promise<Error | null>(resolve => {
    ipcRenderer.once('apply-proxy-settings-response', (_event, error) => {
      resolve(error ?? null);
    });
    ipcRenderer.send('apply-proxy-settings');
  });

  if (applyResult) {
    // Surface apply errors instead of silently failing
    console.error('apply-proxy-settings failed:', applyResult);
    ToastUtils.pushToastError('proxyTestFailed', tr('proxyTestFailedDescription'));
    return false;
  }

  ToastUtils.pushToastSuccess('proxySaved', tr('proxySavedDescription'));
  return true;
}

export function ProxySettingsPage(modalState: UserSettingsModalState) {
  const backAction = useUserSettingsBackAction(modalState);
  const closeAction = useUserSettingsCloseAction(modalState);
  const title = useUserSettingsTitle(modalState);
  const forceUpdate = useUpdate();

  const [settings, setSettings] = useState<ProxySettings>({
    enabled: false,
    bootstrapOnly: false,
    host: '',
    port: '1080',
    username: '',
    password: '',
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const loadedSettings = await loadProxySettings();
      setSettings(loadedSettings);
      setIsLoading(false);
    })();
  }, []);

  const handleToggleEnabled = async () => {
    const newSettings = { ...settings, enabled: !settings.enabled };
    setSettings(newSettings);
  };

  const handleToggleBootstrapOnly = async () => {
    const newSettings = { ...settings, bootstrapOnly: !settings.bootstrapOnly };
    setSettings(newSettings);
  };

  const handleSave = async () => {
    const saved = await saveProxySettings(settings);
    if (saved) {
      forceUpdate();
    }
  };

  if (isLoading) {
    return null;
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
    >
      <PanelButtonGroup>
        <SettingsToggleBasic
          baseDataTestId="proxy-enabled"
          text={{ token: 'proxyEnabled' }}
          subText={{ token: 'proxyDescription' }}
          onClick={handleToggleEnabled}
          active={settings.enabled}
        />
        {settings.enabled && (
          <SettingsToggleBasic
            baseDataTestId="proxy-bootstrap-only"
            text={{ token: 'proxyBootstrapOnly' }}
            subText={{ token: 'proxyBootstrapOnlyDescription' }}
            onClick={handleToggleBootstrapOnly}
            active={settings.bootstrapOnly}
          />
        )}
      </PanelButtonGroup>

      {settings.enabled && (
        <ProxyInputsContainer $container={true} $flexDirection="column">
          <ModalSimpleSessionInput
            ariaLabel={tr('proxyHost')}
            placeholder={tr('proxyHostPlaceholder')}
            value={settings.host}
            onValueChanged={(value: string) => setSettings({ ...settings, host: value })}
            onEnterPressed={() => {}}
            providedError={undefined}
            errorDataTestId="error-message"
          />
          <ModalSimpleSessionInput
            ariaLabel={tr('proxyPort')}
            placeholder={tr('proxyPortPlaceholder')}
            value={settings.port}
            onValueChanged={(value: string) => setSettings({ ...settings, port: value })}
            onEnterPressed={() => {}}
            providedError={undefined}
            errorDataTestId="error-message"
          />
          <ModalSimpleSessionInput
            ariaLabel={tr('proxyAuthUsername')}
            placeholder={tr('proxyAuthUsername')}
            value={settings.username}
            onValueChanged={(value: string) => setSettings({ ...settings, username: value })}
            onEnterPressed={() => {}}
            providedError={undefined}
            errorDataTestId="error-message"
          />
          <ModalSimpleSessionInput
            ariaLabel={tr('proxyAuthPassword')}
            placeholder={tr('proxyAuthPassword')}
            value={settings.password}
            onValueChanged={(value: string) => setSettings({ ...settings, password: value })}
            onEnterPressed={() => {}}
            providedError={undefined}
            errorDataTestId="error-message"
            type="password"
          />
        </ProxyInputsContainer>
      )}

      <Flex
        $container={true}
        $justifyContent="flex-end"
        padding="var(--margins-md) 0 0 0"
        width="100%"
      >
        <SessionButton
          text={tr('save')}
          buttonColor={SessionButtonColor.Primary}
          onClick={handleSave}
        />
      </Flex>
    </UserSettingsModalContainer>
  );
}
