import { ipcRenderer } from 'electron';
import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { Flex } from '../../../../../../basic/Flex';
import { SessionToggle } from '../../../../../../basic/SessionToggle';
import { SectionHeading, SessionNetworkParagraph, Block } from '../../components';
import { ModalSimpleSessionInput } from '../../../../../../inputs/SessionInput';
import {
  SessionButton,
  SessionButtonColor,
  SessionButtonShape,
  SessionButtonType,
} from '../../../../../../basic/SessionButton';
import { SpacerMD, SpacerXS } from '../../../../../../basic/Text';
import { ToastUtils } from '../../../../../../../session/utils';
import { SettingsKey } from '../../../../../../../data/settings-key';
import { normalizeProxySettings } from '../../../../../../../session/utils/ProxySettings';

const PROXY_COPY = {
  title: 'SOCKS5 Proxy',
  description: 'Route supported Session traffic and the auto-updater through a SOCKS5 proxy.',
  enableTitle: 'Enable SOCKS5 proxy',
  enableDescription: 'Apply SOCKS5 settings to supported Session traffic.',
  host: 'Host',
  hostRequired: 'Host is required.',
  port: 'Port',
  portInvalid: 'Port must be between 1 and 65535.',
  usernameOptional: 'Username (optional)',
  passwordOptional: 'Password (optional)',
  validationError: 'Invalid SOCKS5 proxy settings.',
  saved: 'SOCKS5 proxy settings saved.',
  applyFailed: 'Failed to apply SOCKS5 proxy settings.',
  save: 'Save',
  saving: 'Saving...',
} as const;

type ProxyDraft = {
  enabled: boolean;
  host: string;
  port: string;
  username: string;
  password: string;
};

type ValidationResult = {
  hostError?: string;
  portError?: string;
};

const ToggleRow = styled.button`
  width: 100%;
  border: 0;
  padding: var(--margins-md);
  text-align: start;
  background: transparent;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--margins-md);
  cursor: pointer;
  color: var(--text-primary-color);
`;

const ToggleCopy = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--margins-xs);
`;

const ToggleTitle = styled.p`
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 700;
`;

const ToggleDescription = styled.p`
  margin: 0;
  font-size: var(--font-size-md);
  color: var(--text-secondary-color);
`;

const InputsContainer = styled(Flex)`
  width: 100%;
  gap: var(--margins-sm);
`;

function loadDraft(): ProxyDraft {
  return {
    enabled: Boolean(window.getSettingValue(SettingsKey.proxyEnabled)),
    host: (window.getSettingValue(SettingsKey.proxyHost) as string) || '',
    port: String(window.getSettingValue(SettingsKey.proxyPort) || ''),
    username: (window.getSettingValue(SettingsKey.proxyUsername) as string) || '',
    password: (window.getSettingValue(SettingsKey.proxyPassword) as string) || '',
  };
}

function validateDraft(draft: ProxyDraft): ValidationResult {
  if (!draft.enabled) {
    return {};
  }

  if (!draft.host.trim()) {
    return { hostError: PROXY_COPY.hostRequired };
  }

  const port = Number.parseInt(draft.port, 10);
  if (Number.isNaN(port) || port < 1 || port > 65535) {
    return { portError: PROXY_COPY.portInvalid };
  }

  return {};
}

async function applyProxySettings() {
  return new Promise<Error | null>(resolve => {
    ipcRenderer.once('apply-proxy-settings-response', (_event, error) => {
      resolve(error ?? null);
    });
    ipcRenderer.send('apply-proxy-settings');
  });
}

export function ProxySection() {
  const [draft, setDraft] = useState<ProxyDraft>(loadDraft);
  const [saving, setSaving] = useState(false);
  const validation = useMemo(() => validateDraft(draft), [draft]);

  const saveDisabled =
    saving || (!!draft.enabled && (!!validation.hostError || !!validation.portError));

  const saveSettings = async () => {
    if (saveDisabled) {
      if (validation.hostError || validation.portError) {
        ToastUtils.pushToastError(
          'proxyValidationError',
          validation.hostError || validation.portError || PROXY_COPY.validationError
        );
      }
      return;
    }

    setSaving(true);

    try {
      await window.setSettingValue(SettingsKey.proxyEnabled, draft.enabled);
      await window.setSettingValue(SettingsKey.proxyHost, draft.host.trim());
      await window.setSettingValue(SettingsKey.proxyPort, Number.parseInt(draft.port, 10) || 0);
      await window.setSettingValue(SettingsKey.proxyUsername, draft.username.trim());
      await window.setSettingValue(SettingsKey.proxyPassword, draft.password.trim());

      const error = await applyProxySettings();
      if (error) {
        throw error;
      }

      const normalized = normalizeProxySettings({
        enabled: draft.enabled,
        host: draft.host,
        port: draft.port,
        username: draft.username,
        password: draft.password,
      });

      setDraft(
        normalized
          ? {
              enabled: normalized.enabled,
              host: normalized.host,
              port: String(normalized.port),
              username: normalized.username || '',
              password: normalized.password || '',
            }
          : {
              ...draft,
              host: draft.host.trim(),
              username: draft.username.trim(),
              password: draft.password.trim(),
            }
      );

      ToastUtils.pushToastSuccess('proxySaved', PROXY_COPY.saved);
    } catch {
      ToastUtils.pushToastError('proxyApplyFailed', PROXY_COPY.applyFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Flex
      $container={true}
      width="100%"
      $flexDirection="column"
      $justifyContent="flex-start"
      $alignItems="center"
    >
      <SectionHeading $margin={'0 0 var(--margins-xs)'}>{PROXY_COPY.title}</SectionHeading>
      <SessionNetworkParagraph>{PROXY_COPY.description}</SessionNetworkParagraph>
      <SpacerMD />
      <Block
        $container={true}
        width="100%"
        $flexDirection="column"
        $backgroundColor="var(--background-secondary-color)"
      >
        <ToggleRow
          type="button"
          onClick={() => setDraft(current => ({ ...current, enabled: !current.enabled }))}
        >
          <ToggleCopy>
            <ToggleTitle>{PROXY_COPY.enableTitle}</ToggleTitle>
            <ToggleDescription>{PROXY_COPY.enableDescription}</ToggleDescription>
          </ToggleCopy>
          <SessionToggle active={draft.enabled} />
        </ToggleRow>
        {draft.enabled ? (
          <>
            <InputsContainer
              $container={true}
              $flexDirection="column"
              $padding="0 var(--margins-md) var(--margins-md)"
            >
              <ModalSimpleSessionInput
                ariaLabel={PROXY_COPY.host}
                placeholder={PROXY_COPY.host}
                value={draft.host}
                onValueChanged={value => setDraft(current => ({ ...current, host: value }))}
                onEnterPressed={() => {
                  void saveSettings();
                }}
                providedError={validation.hostError}
                errorDataTestId={'error-message'}
              />
              <ModalSimpleSessionInput
                ariaLabel={PROXY_COPY.port}
                placeholder={PROXY_COPY.port}
                value={draft.port}
                onValueChanged={value => setDraft(current => ({ ...current, port: value }))}
                onEnterPressed={() => {
                  void saveSettings();
                }}
                providedError={validation.portError}
                errorDataTestId={'error-message'}
              />
              <ModalSimpleSessionInput
                ariaLabel={PROXY_COPY.usernameOptional}
                placeholder={PROXY_COPY.usernameOptional}
                value={draft.username}
                onValueChanged={value => setDraft(current => ({ ...current, username: value }))}
                onEnterPressed={() => {
                  void saveSettings();
                }}
                providedError={undefined}
                errorDataTestId={'error-message'}
              />
              <ModalSimpleSessionInput
                ariaLabel={PROXY_COPY.passwordOptional}
                placeholder={PROXY_COPY.passwordOptional}
                value={draft.password}
                onValueChanged={value => setDraft(current => ({ ...current, password: value }))}
                onEnterPressed={() => {
                  void saveSettings();
                }}
                providedError={undefined}
                errorDataTestId={'error-message'}
                type="password"
              />
            </InputsContainer>
          </>
        ) : null}
      </Block>
      <SpacerXS />
      <Flex $container={true} width="100%" $justifyContent="flex-end">
        <SessionButton
          text={saving ? PROXY_COPY.saving : PROXY_COPY.save}
          buttonType={SessionButtonType.Solid}
          buttonShape={SessionButtonShape.Square}
          buttonColor={SessionButtonColor.Primary}
          onClick={saveSettings}
          disabled={saveDisabled}
        />
      </Flex>
    </Flex>
  );
}
