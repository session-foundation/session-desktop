import { isBoolean, isNil } from 'lodash';
import { Dispatch, useCallback, useEffect, useMemo, useState } from 'react';
import { clipboard } from 'electron';
import useAsync from 'react-use/lib/useAsync';
import { ProConfig, ProProof } from 'libsession_util_nodejs';
import { getAppDispatch } from '../../../state/dispatch';
import {
  getDataFeatureFlag,
  getFeatureFlag,
  MockProAccessExpiryOptions,
  SessionDataFeatureFlags,
  getDataFeatureFlagMemo,
  type SessionDataFeatureFlagKeys,
  type SessionBooleanFeatureFlagKeys,
  getFeatureFlagMemo,
} from '../../../state/ducks/types/releasedFeaturesReduxTypes';
import { Flex } from '../../basic/Flex';
import { SessionToggle } from '../../basic/SessionToggle';
import { HintText, SpacerXS } from '../../basic/Text';
import { DEBUG_FEATURE_FLAGS, isFeatureFlagAvailable } from './constants';
import { ConvoHub } from '../../../session/conversations';
import { ProMessageFeature } from '../../../models/proMessageFeature';
import { SessionButtonShiny } from '../../basic/SessionButtonShiny';
import { SessionButtonColor, SessionButtonShape } from '../../basic/SessionButton';
import { ToastUtils } from '../../../session/utils';
import { DEBUG_MENU_PAGE, DebugMenuPageProps, DebugMenuSection } from './DebugMenuModal';
import {
  ProAccessVariant,
  ProPaymentProvider,
  ProStatus,
} from '../../../session/apis/pro_backend_api/types';
import { DebugButton } from './components';
import { proBackendDataActions } from '../../../state/ducks/proBackendData';
import { Storage } from '../../../util/storage';
import { SettingsKey } from '../../../data/settings-key';
import {
  defaultProBooleanFeatureFlags,
  defaultProDataFeatureFlags,
} from '../../../state/ducks/types/defaultFeatureFlags';
import { UserConfigWrapperActions } from '../../../webworker/workers/browser/libsession/libsession_worker_userconfig_interface';
import { isDebugMode } from '../../../shared/env_vars';
import {
  useProBackendProDetails,
  useProBackendRefetch,
} from '../../../state/selectors/proBackendData';

type FeatureFlagToggleType = {
  forceUpdate: () => void;
  flag: SessionBooleanFeatureFlagKeys;
  parentFlag?: SessionBooleanFeatureFlagKeys;
};

function resetAllConversationUI() {
  ConvoHub.use()
    .getConversations()
    .forEach(convo => {
      convo.triggerUIRefresh();
    });
}

const handleSetFeatureFlag = ({
  flag,
  parentFlag,
  forceUpdate,
  value,
}: FeatureFlagToggleType & { value: boolean }) => {
  if (parentFlag) {
    (window as any).sessionBooleanFeatureFlags[parentFlag][flag] = value;
    window.log.debug(`[debugMenu] toggled ${parentFlag}.${flag} to ${value}`);
  } else {
    (window as any).sessionBooleanFeatureFlags[flag] = value;
    window.log.debug(`[debugMenu] toggled ${flag} to ${value}`);
  }

  forceUpdate();
  resetAllConversationUI();
};

const handleFeatureFlagToggle = ({ flag, parentFlag, forceUpdate }: FeatureFlagToggleType) => {
  const currentValue = parentFlag
    ? (window as any).sessionBooleanFeatureFlags[parentFlag][flag]
    : (window as any).sessionBooleanFeatureFlags[flag];
  handleSetFeatureFlag({ flag, parentFlag, forceUpdate, value: !currentValue });
};

export const FlagToggle = ({
  flag,
  forceUpdate,
  parentFlag,
  label,
  visibleWithBooleanFlag,
  visibleWithEnumFlag,
  hiddenAndDisabledWhenKeyEnabled,
}: FeatureFlagToggleType & {
  label?: string;
  visibleWithBooleanFlag?: SessionBooleanFeatureFlagKeys;
  visibleWithEnumFlag?: VisibleWithEnumFlagType<SessionDataFeatureFlagKeys>;
  hiddenAndDisabledWhenKeyEnabled?: SessionBooleanFeatureFlagKeys;
}) => {
  const key = `feature-flag-toggle-${flag}`;
  const visibleFlag = visibleWithBooleanFlag ? getFeatureFlag(visibleWithBooleanFlag) : true;
  const dataFlag = visibleWithEnumFlag ? getDataFeatureFlag(visibleWithEnumFlag.flag) : null;
  const visibleWithDataFlag = visibleWithEnumFlag
    ? dataFlag !== null && visibleWithEnumFlag.isVisible(dataFlag)
    : true;

  const hideAndDisable = hiddenAndDisabledWhenKeyEnabled
    ? getFeatureFlag(hiddenAndDisabledWhenKeyEnabled)
    : false;

  useEffect(() => {
    if (hideAndDisable) {
      handleSetFeatureFlag({ flag, forceUpdate, value: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hideAndDisable]);

  if (!isFeatureFlagAvailable(flag)) {
    return null;
  }

  return visibleFlag && visibleWithDataFlag ? (
    <Flex
      key={key}
      id={key}
      $container={true}
      width="100%"
      $alignItems="center"
      $justifyContent="flex-start"
      $flexGap="var(--margins-sm)"
    >
      <SessionToggle
        active={!!getFeatureFlag(flag)}
        onClick={() => void handleFeatureFlagToggle({ flag, parentFlag, forceUpdate })}
      />
      <span>
        {label || formatDefaultFlagName(flag) || flag}
        {DEBUG_FEATURE_FLAGS.DEV.includes(flag) ? <HintText>Experimental</HintText> : null}
        {DEBUG_FEATURE_FLAGS.UNTESTED.includes(flag) ? <HintText>Untested</HintText> : null}
      </span>
    </Flex>
  ) : null;
};

const handleFeatureFlagWithDataChange = ({
  flag,
  value,
  forceUpdate,
}: {
  flag: SessionDataFeatureFlagKeys;
  value: any;
  forceUpdate: () => void;
}) => {
  window.sessionDataFeatureFlags[flag] = value;
  forceUpdate();
  resetAllConversationUI();
};

type FlagDropdownInputProps = {
  forceUpdate: () => void;
  flag: SessionDataFeatureFlagKeys;
  options: Array<{ label: string; value: number | string | null }>;
  unsetOption: { label: string; value: number | string | null };
  visibleWithBooleanFlag?: SessionBooleanFeatureFlagKeys;
  visibleWithEnumFlag?: VisibleWithEnumFlagType<SessionDataFeatureFlagKeys>;
  label: string;
};

export const FlagEnumDropdownInput = ({
  flag,
  options,
  forceUpdate,
  unsetOption,
  visibleWithBooleanFlag,
  visibleWithEnumFlag,
  label,
}: FlagDropdownInputProps) => {
  const key = `feature-flag-dropdown-${flag}`;
  const [selected, setSelected] = useState<number | string | null>(() => {
    const initValue = window.sessionDataFeatureFlags[flag];
    return typeof initValue === 'string' || Number.isFinite(initValue)
      ? (initValue as string | number)
      : unsetOption.value;
  });

  if (!isFeatureFlagAvailable(flag)) {
    return null;
  }

  const handleSelect = (newValue: number | string | null) => {
    setSelected(newValue);
    handleFeatureFlagWithDataChange({
      flag,
      value: typeof newValue !== 'string' && Number.isNaN(newValue) ? null : newValue,
      forceUpdate,
    });
  };

  const visibleFlag = visibleWithBooleanFlag ? getFeatureFlag(visibleWithBooleanFlag) : true;

  const dataFlag = visibleWithEnumFlag ? getDataFeatureFlag(visibleWithEnumFlag.flag) : null;
  const visibleWithDataFlag = visibleWithEnumFlag
    ? dataFlag !== null && visibleWithEnumFlag.isVisible(dataFlag)
    : true;

  return visibleFlag && visibleWithDataFlag ? (
    <Flex
      key={key}
      id={key}
      $container={true}
      width="100%"
      $justifyContent="flex-start"
      $flexGap="var(--margins-sm)"
      $flexDirection="column"
    >
      <label
        style={{
          display: 'block',
          color: 'var(--text-primary-color)',
        }}
      >
        {label}
      </label>
      <select
        value={selected ?? undefined}
        onChange={e => {
          const valAsNum = Number.parseInt(e.target.value, 10);
          const val = Number.isFinite(valAsNum) ? valAsNum : e.target.value;
          handleSelect(val);
        }}
        style={{
          width: '100%',
          padding: 'var(--margins-sm) var(--margins-md)',
          backgroundColor: 'var(--background-primary-color)',
          color: 'var(--text-primary-color)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--border-radius)',
          cursor: 'pointer',
        }}
      >
        <option key={unsetOption.value} value={unsetOption.value ?? undefined}>
          {unsetOption.label}
        </option>
        {options.map(option => (
          <option key={option.value} value={option.value ?? undefined}>
            {option.label}
          </option>
        ))}
      </select>
    </Flex>
  ) : null;
};

type FlagIntegerInputProps = {
  forceUpdate: () => void;
  flag: SessionDataFeatureFlagKeys;
  visibleWithBooleanFlag?: SessionBooleanFeatureFlagKeys;
  label: string;
  min?: number;
  max?: number;
};

export const FlagIntegerInput = ({
  flag,
  forceUpdate,
  visibleWithBooleanFlag,
  label,
  min,
  max,
}: FlagIntegerInputProps) => {
  const currentValue = getDataFeatureFlagMemo(flag);
  const key = `feature-flag-integer-input-${flag}`;
  const [value, setValue] = useState<number>(() => {
    const initValue = window.sessionDataFeatureFlags[flag];
    if (typeof initValue === 'number' && Number.isFinite(initValue)) {
      return initValue;
    }

    if (!isNil(min)) {
      return min;
    }

    if (!isNil(max)) {
      return max;
    }
    return 0;
  });

  if (!isFeatureFlagAvailable(flag)) {
    return null;
  }

  const handleOnClick = () => {
    handleFeatureFlagWithDataChange({
      flag,
      value,
      forceUpdate,
    });
  };

  const handleUnsetOnClick = () => {
    handleFeatureFlagWithDataChange({
      flag,
      value: null,
      forceUpdate,
    });
  };

  const visibleFlag = visibleWithBooleanFlag ? getFeatureFlag(visibleWithBooleanFlag) : true;

  return visibleFlag ? (
    <Flex
      key={key}
      id={key}
      $container={true}
      width="100%"
      $justifyContent="flex-start"
      $flexGap="var(--margins-sm)"
      $flexDirection="column"
    >
      <label
        style={{
          display: 'block',
          color: 'var(--text-primary-color)',
        }}
      >
        {label}
      </label>
      <div style={{ display: 'flex', gap: 'var(--margins-sm)' }}>
        <input
          type="number"
          value={value}
          min={min ?? 0}
          max={max ?? undefined}
          onChange={e => setValue(e.target.valueAsNumber)}
          style={{
            width: '100px',
            padding: 'var(--margins-xs) var(--margins-sm)',
            backgroundColor: 'var(--background-primary-color)',
            color: 'var(--text-primary-color)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--border-radius)',
            cursor: 'pointer',
          }}
        />
        <SessionButtonShiny
          onClick={handleOnClick}
          shinyContainerStyle={{
            width: 'max-content',
          }}
          buttonColor={SessionButtonColor.PrimaryDark}
          buttonShape={SessionButtonShape.Square}
        >
          Set
        </SessionButtonShiny>
        {currentValue !== null ? (
          <SessionButtonShiny
            onClick={handleUnsetOnClick}
            shinyContainerStyle={{
              width: 'max-content',
            }}
            buttonColor={SessionButtonColor.Danger}
            buttonShape={SessionButtonShape.Square}
          >
            Unset
          </SessionButtonShiny>
        ) : null}
      </div>
    </Flex>
  ) : null;
};

const allProFeatures = Object.values(ProMessageFeature);

// Generate the rotation steps: [], [feat1], [feat2], ..., [featN], [f1, f2, ..., fn]
const proFeatureCycle: Array<Array<ProMessageFeature>> = [
  [],
  ...allProFeatures.map(f => [f]),
  allProFeatures,
];

function rotateMsgProFeat(currentValue: Array<ProMessageFeature>, forceUpdate: () => void) {
  // Find current step in the cycle
  const index = proFeatureCycle.findIndex(
    features =>
      features.length === currentValue.length && features.every(f => currentValue.includes(f))
  );

  // Next index wraps around
  const nextIndex = (index + 1) % proFeatureCycle.length;

  window.sessionDataFeatureFlags.mockMessageProFeatures = proFeatureCycle[nextIndex];

  void UserConfigWrapperActions.setProBadge(
    window.sessionDataFeatureFlags.mockMessageProFeatures.includes(ProMessageFeature.PRO_BADGE)
  );
  void UserConfigWrapperActions.setAnimatedAvatar(
    window.sessionDataFeatureFlags.mockMessageProFeatures.includes(
      ProMessageFeature.PRO_ANIMATED_DISPLAY_PICTURE
    )
  );

  forceUpdate();
}

type VisibleWithEnumFlagType<K extends SessionDataFeatureFlagKeys> = {
  flag: K;
  isVisible: (v: SessionDataFeatureFlags[K]) => boolean;
};

type BooleanFlags = Array<{
  flag: SessionBooleanFeatureFlagKeys;
  label?: string;
  visibleWithBooleanFlag?: SessionBooleanFeatureFlagKeys;
  visibleWithEnumFlag?: VisibleWithEnumFlagType<SessionDataFeatureFlagKeys>;
  hiddenAndDisabledWhenKeyEnabled?: SessionBooleanFeatureFlagKeys;
}>;

function formatDefaultFlagName(key: string) {
  if (!key?.length) {
    return '';
  }
  const withSpaces = key.replace(/([A-Z])/g, ' $1');
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1).toLowerCase();
}

const proBooleanFlags: BooleanFlags = [
  {
    label: 'Platform Refund Expired',
    flag: 'mockCurrentUserHasProPlatformRefundExpired',
    visibleWithBooleanFlag: 'proAvailable',
    visibleWithEnumFlag: {
      flag: 'mockProCurrentStatus',
      isVisible: v => v === ProStatus.Active,
    },
  },
  {
    label: 'Cancelled',
    flag: 'mockCurrentUserHasProCancelled',
    visibleWithEnumFlag: {
      flag: 'mockProCurrentStatus',
      isVisible: v => v === ProStatus.Active,
    },
  },
  {
    label: 'In Grace Period',
    flag: 'mockCurrentUserHasProInGracePeriod',
    hiddenAndDisabledWhenKeyEnabled: 'mockCurrentUserHasProCancelled',
    visibleWithEnumFlag: {
      flag: 'mockProCurrentStatus',
      isVisible: v => v === ProStatus.Active,
    },
  },
];

const proBackendBooleanFlags: BooleanFlags = [
  {
    label: 'Backend Loading',
    flag: 'mockProBackendLoading',
    visibleWithBooleanFlag: 'proAvailable',
    hiddenAndDisabledWhenKeyEnabled: 'mockProBackendError',
  },
  {
    label: 'Backend Error',
    flag: 'mockProBackendError',
    visibleWithBooleanFlag: 'proAvailable',
    hiddenAndDisabledWhenKeyEnabled: 'mockProBackendLoading',
  },
  {
    label: 'Recover always succeeds',
    flag: 'mockProRecoverButtonAlwaysSucceed',
    visibleWithBooleanFlag: 'proAvailable',
    hiddenAndDisabledWhenKeyEnabled: 'mockProRecoverButtonAlwaysFail',
  },
  {
    label: 'Recover always fails',
    flag: 'mockProRecoverButtonAlwaysFail',
    visibleWithBooleanFlag: 'proAvailable',
    hiddenAndDisabledWhenKeyEnabled: 'mockProRecoverButtonAlwaysSucceed',
  },
];

const debugFeatureFlags: BooleanFlags = [
  {
    flag: 'showPopoverAnchors',
  },
  {
    flag: 'debugInputCommands',
  },
];

const handledBooleanFeatureFlags = proBooleanFlags
  .map(({ flag: key }) => key)
  .concat(proBackendBooleanFlags.map(({ flag: key }) => key))
  .concat(debugFeatureFlags.map(({ flag: key }) => key))
  .concat([
    'proAvailable',
    'proGroupsAvailable',
    'useTestProBackend',
    'debugLogging',
    'debugLibsessionDumps',
    'debugBuiltSnodeRequests',
    'debugSwarmPolling',
    'debugServerRequests',
    'debugNonSnodeRequests',
    'debugOnionRequests',
    'debugOnionPaths',
    'debugSnodePool',
    'debugOnlineState',
    'debugInsecureNodeFetch',
  ]);

export const FeatureFlags = ({ forceUpdate }: { forceUpdate: () => void }) => {
  const flags = Object.fromEntries(
    Object.entries(window.sessionBooleanFeatureFlags).filter(
      ([key]) => !handledBooleanFeatureFlags.includes(key as SessionBooleanFeatureFlagKeys)
    )
  );
  return (
    <DebugMenuSection title="Feature Flags">
      <i>
        Changes are temporary. You can clear them by reloading the window or restarting the app.
      </i>
      <SpacerXS />
      {Object.entries(flags).map(([key, value]) => {
        const flag = key as SessionBooleanFeatureFlagKeys;
        if (!isFeatureFlagAvailable(flag)) {
          return null;
        }

        if (isBoolean(value)) {
          return <FlagToggle forceUpdate={forceUpdate} flag={flag} />;
        }
        throw new Error('Feature flag is not a boolean');
      })}
    </DebugMenuSection>
  );
};

export function DebugFeatureFlags({ forceUpdate }: { forceUpdate: () => void }) {
  return (
    <DebugMenuSection title="Debug Feature Flags">
      {debugFeatureFlags.map(props => (
        <FlagToggle {...props} forceUpdate={forceUpdate} />
      ))}
      <FlagIntegerInput
        flag="mockNetworkPageNodeCount"
        forceUpdate={forceUpdate}
        label="Network Page Node Count"
        min={1}
        max={10}
      />
    </DebugMenuSection>
  );
}

export function FeatureFlagDumper({ forceUpdate }: { forceUpdate: () => void }) {
  const [value, setValue] = useState<string>('');

  const handleCopyOnClick = () => {
    const json = JSON.stringify(
      {
        sessionBooleanFeatureFlags: window.sessionBooleanFeatureFlags,
        sessionDataFeatureFlags: window.sessionDataFeatureFlags,
      },
      undefined,
      2
    );
    clipboard.writeText(json);
    ToastUtils.pushToastSuccess('flag-dumper-toast-copy', 'Copied to clipboard');
  };

  const handleSetOnClick = () => {
    try {
      const json = JSON.parse(value);
      const keys = Object.keys(json);

      if (
        keys.length !== 2 &&
        keys[0] !== 'sessionBooleanFeatureFlags' &&
        keys[1] !== 'sessionDataFeatureFlags'
      ) {
        throw new Error(`Invalid keys in object: ${keys}`);
      }

      if (typeof json.sessionBooleanFeatureFlags !== 'object') {
        throw new Error('sessionBooleanFeatureFlags is not an object!');
      }

      if (typeof json.sessionDataFeatureFlags !== 'object') {
        throw new Error('sessionDataFeatureFlags is not an object!');
      }

      window.sessionBooleanFeatureFlags = json.sessionBooleanFeatureFlags;
      window.sessionDataFeatureFlags = json.sessionDataFeatureFlags;

      forceUpdate();
      resetAllConversationUI();
    } catch (e) {
      ToastUtils.pushToastError('flag-dumper-toast-set', e.message);
    }
  };

  return (
    <DebugMenuSection title="Feature Flag Dumper">
      <div style={{ display: 'flex', gap: 'var(--margins-sm)' }}>
        <SessionButtonShiny
          onClick={handleCopyOnClick}
          shinyContainerStyle={{
            width: 'max-content',
          }}
          buttonColor={SessionButtonColor.PrimaryDark}
          buttonShape={SessionButtonShape.Square}
        >
          Copy Feature Flags
        </SessionButtonShiny>
        <SessionButtonShiny
          onClick={handleSetOnClick}
          shinyContainerStyle={{
            width: 'max-content',
          }}
          disabled={!value || !value.startsWith('{') || !value.endsWith('}')}
          buttonColor={SessionButtonColor.PrimaryDark}
          buttonShape={SessionButtonShape.Square}
        >
          Set Feature Flags
        </SessionButtonShiny>
      </div>

      <textarea
        style={{
          width: '100%',
          minWidth: '100px',
          padding: 'var(--margins-xs) var(--margins-sm)',
          backgroundColor: 'var(--background-primary-color)',
          color: 'var(--text-primary-color)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--border-radius)',
        }}
        onChange={e => setValue(e.target.value)}
      />

      <i>
        Setting feature flags will override all existing feature flags with exactly what is in the
        input, any edits may cause unexpected behaviour
      </i>
    </DebugMenuSection>
  );
}

function MessageProFeatures({ forceUpdate }: { forceUpdate: () => void }) {
  const proIsAvailable = getFeatureFlagMemo('proAvailable');
  const value = getDataFeatureFlagMemo('mockMessageProFeatures') ?? [];

  if (!proIsAvailable) {
    return null;
  }

  return (
    <Flex
      $container={true}
      $alignItems="center"
      $flexDirection="row"
      style={{ cursor: 'pointer', gap: 'var(--margins-xs)' }}
      onClick={() => rotateMsgProFeat(value, forceUpdate)}
    >
      <div style={{ flexShrink: 0 }}>Message Pro Features</div>
      <pre style={{ overflow: 'hidden' }}>{JSON.stringify(value)}</pre>
    </Flex>
  );
}

function DebugInput({
  value,
  setValue,
  label,
}: {
  value: string;
  setValue: Dispatch<string>;
  label: string;
}) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          color: 'var(--text-primary-color)',
        }}
      >
        {label}
      </label>
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        style={{
          width: '100%',
          padding: 'var(--margins-xs) var(--margins-sm)',
          backgroundColor: 'var(--background-primary-color)',
          color: 'var(--text-primary-color)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--border-radius)',
          cursor: 'pointer',
        }}
      />
    </div>
  );
}

function ProConfigForm({
  proConfig,
  forceUpdate,
}: {
  proConfig?: ProConfig | null;
  forceUpdate: () => Promise<void>;
}) {
  const hasProConfig = !proConfig || typeof proConfig === 'object';
  const [error, setError] = useState<Error | null>();
  const [rotatingPrivKeyInput, setRotatingPrivKeyInput] = useState<string>(
    proConfig?.rotatingPrivKeyHex ?? ''
  );
  const [rotatingPubKeyInput, setRotatingPubKeyInput] = useState<string>(
    proConfig?.proProof.rotatingPubkeyHex ?? ''
  );
  const [expiryInput, setExpiryInput] = useState<string>(
    proConfig?.proProof.expiryMs.toString() ?? ''
  );
  const [sigInput, setSigInput] = useState<string>(proConfig?.proProof.signatureHex ?? '');
  const [genHashInput, setGenHashInput] = useState<string>(
    proConfig?.proProof.genIndexHashB64 ?? ''
  );
  const [versionInput, setVersionInput] = useState<string>(
    proConfig?.proProof.version.toString() ?? ''
  );

  const [configDumpValue, setConfigDumpValue] = useState<string>(
    hasProConfig ? JSON.stringify(proConfig) : ''
  );

  const setProProof = useCallback(
    async (config: Parameters<typeof UserConfigWrapperActions.setProConfig>[0]) => {
      try {
        await UserConfigWrapperActions.setProConfig(config);
      } catch (e) {
        window?.log?.error(e);
        setError(e);
      }
    },
    []
  );

  const save = useCallback(async () => {
    const proProof = {
      rotatingPubkeyHex: rotatingPubKeyInput,
      expiryMs: Number(expiryInput),
      signatureHex: sigInput,
      genIndexHashB64: genHashInput,
      version: Number(versionInput),
    } satisfies ProProof;
    await setProProof({
      proProof,
      rotatingPrivKeyHex: rotatingPrivKeyInput,
    });
  }, [
    setProProof,
    rotatingPrivKeyInput,
    rotatingPubKeyInput,
    expiryInput,
    sigInput,
    genHashInput,
    versionInput,
  ]);

  const copy = useCallback(() => {
    const json = JSON.stringify(proConfig);
    clipboard.writeText(json);
    ToastUtils.pushToastSuccess('flag-dumper-toast-copy', 'Copied to clipboard');
  }, [proConfig]);

  const setConfig = useCallback(async () => {
    try {
      const parsed = JSON.parse(configDumpValue) as ProConfig;

      // Update all the input fields with the pasted config
      setRotatingPrivKeyInput(parsed.rotatingPrivKeyHex ?? '');
      setRotatingPubKeyInput(parsed.proProof.rotatingPubkeyHex ?? '');
      setExpiryInput(parsed.proProof.expiryMs.toString() ?? '');
      setSigInput(parsed.proProof.signatureHex ?? '');
      setGenHashInput(parsed.proProof.genIndexHashB64 ?? '');
      setVersionInput(parsed.proProof.version.toString() ?? '');

      ToastUtils.pushToastSuccess('flag-dumper-toast-paste', 'Pasted from clipboard');
      await forceUpdate();
    } catch (e) {
      window?.log?.error(e);
      ToastUtils.pushToastError('flag-dumper-toast-paste-error', `Failed to paste: ${e?.message}`);
    }
  }, [configDumpValue, forceUpdate]);

  const removeConfig = useCallback(async () => {
    await UserConfigWrapperActions.removeProConfig();
    setRotatingPrivKeyInput('');
    setRotatingPubKeyInput('');
    setExpiryInput('');
    setSigInput('');
    setGenHashInput('');
    setVersionInput('');
    setConfigDumpValue('');
    await forceUpdate();
  }, [forceUpdate]);

  return (
    <div style={{ width: '100%' }}>
      <h2>Pro Config Dumper</h2>
      <DebugButton onClick={copy} disabled={!hasProConfig}>
        Copy Config Dump
      </DebugButton>
      <DebugButton onClick={setConfig} disabled={!configDumpValue?.length}>
        Set Config Dump
      </DebugButton>
      <label
        style={{
          display: 'block',
          color: 'var(--text-primary-color)',
        }}
      >
        Config Dump
      </label>
      <textarea
        style={{
          width: '100%',
          minWidth: '100px',
          padding: 'var(--margins-xs) var(--margins-sm)',
          backgroundColor: 'var(--background-primary-color)',
          color: 'var(--text-primary-color)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--border-radius)',
        }}
        onChange={e => setConfigDumpValue(e.target.value)}
        defaultValue={configDumpValue}
      />
      <h2>Pro Config</h2>
      <DebugButton
        onClick={removeConfig}
        disabled={!hasProConfig}
        buttonColor={SessionButtonColor.Danger}
      >
        Delete Pro Config
      </DebugButton>
      <DebugInput
        label="Rotating Private Key"
        value={rotatingPrivKeyInput}
        setValue={setRotatingPrivKeyInput}
      />
      <DebugInput
        label="Rotating Public Key"
        value={rotatingPubKeyInput}
        setValue={setRotatingPubKeyInput}
      />
      <DebugInput label="Expiry Timestamp (ms)" value={expiryInput} setValue={setExpiryInput} />
      <DebugInput label="Signature" value={sigInput} setValue={setSigInput} />
      <DebugInput label="Gen Hash" value={genHashInput} setValue={setGenHashInput} />
      <DebugInput label="Version" value={versionInput} setValue={setVersionInput} />
      <DebugButton onClick={save}>Set Pro Config</DebugButton>
      {error?.message ? error.message : null}
    </div>
  );
}

function ProConfigManager({ forceUpdate }: { forceUpdate: () => void }) {
  const { isFetching } = useProBackendProDetails();
  const refetch = useProBackendRefetch();
  const [proConfig, setProConfig] = useState<ProConfig | null>(null);
  const getProConfig = useCallback(async () => {
    const config = await UserConfigWrapperActions.getProConfig();
    if (!config) {
      window?.log?.debug('pro config not found');
      return null;
    }
    return config;
  }, []);

  const initialState = useAsync(async () => {
    return getProConfig();
  }, []);

  const _forceUpdate = useCallback(async () => {
    setProConfig(await getProConfig());
    forceUpdate();
  }, [forceUpdate, getProConfig]);

  useEffect(() => {
    if (!isFetching) {
      void _forceUpdate();
    }
  }, [isFetching, _forceUpdate]);

  return initialState.loading ? (
    'Loading Pro Config...'
  ) : (
    <div style={{ width: '100%' }}>
      <h2>Pro Config Manager</h2>
      <DebugButton onClick={refetch}>Generate New Proof From Backend (refresh)</DebugButton>
      <i>Changing the pro config may result in an invalid pro config</i>
      <ProConfigForm proConfig={proConfig ?? initialState.value} forceUpdate={_forceUpdate} />
    </div>
  );
}

export const ProDebugSection = ({
  forceUpdate,
  setPage,
}: DebugMenuPageProps & { forceUpdate: () => void }) => {
  const dispatch = getAppDispatch();
  const mockExpiry = getDataFeatureFlagMemo('mockProAccessExpiry');
  const proAvailable = getFeatureFlagMemo('proAvailable');

  const resetPro = useCallback(async () => {
    await UserConfigWrapperActions.removeProConfig();
    await Storage.remove(SettingsKey.proDetails);
    await Storage.remove(SettingsKey.proExpiringSoonCTA);
    await Storage.remove(SettingsKey.proExpiredCTA);
    dispatch(proBackendDataActions.reset({ key: 'details' }));
  }, [dispatch]);

  const resetProMocking = useCallback(() => {
    window.sessionDataFeatureFlags = {
      ...window.sessionDataFeatureFlags,
      ...defaultProDataFeatureFlags,
    };
    window.sessionBooleanFeatureFlags = {
      ...window.sessionBooleanFeatureFlags,
      ...defaultProBooleanFeatureFlags,
    };
    forceUpdate();
    resetAllConversationUI();
  }, [forceUpdate]);

  const proExpiringSoonCTASetting = Storage.get(SettingsKey.proExpiringSoonCTA);
  const proExpiredCTASetting = Storage.get(SettingsKey.proExpiredCTA);

  const { handleSetExpiringSoonCTA, setExpiringSoonCTAString } = useMemo(() => {
    if (proExpiringSoonCTASetting === undefined) {
      return {
        handleSetExpiringSoonCTA: async () => Storage.put(SettingsKey.proExpiringSoonCTA, true),
        setExpiringSoonCTAString: 'Set Expiring Soon CTA to show',
      };
    }
    if (proExpiringSoonCTASetting) {
      return {
        handleSetExpiringSoonCTA: async () => Storage.put(SettingsKey.proExpiringSoonCTA, false),
        setExpiringSoonCTAString: 'Set Expiring Soon CTA as already shown',
      };
    }
    return {
      handleSetExpiringSoonCTA: async () => Storage.remove(SettingsKey.proExpiringSoonCTA),
      setExpiringSoonCTAString: 'Set Expiring Soon CTA as never shown',
    };
  }, [proExpiringSoonCTASetting]);

  const { handleSetExpiredCTA, setExpiredCTAString } = useMemo(() => {
    if (proExpiredCTASetting === undefined) {
      return {
        handleSetExpiredCTA: async () => Storage.put(SettingsKey.proExpiredCTA, true),
        setExpiredCTAString: 'Set Expired CTA to show',
      };
    }
    if (proExpiredCTASetting) {
      return {
        handleSetExpiredCTA: async () => Storage.put(SettingsKey.proExpiredCTA, false),
        setExpiredCTAString: 'Set Expired CTA as already shown',
      };
    }
    return {
      handleSetExpiredCTA: async () => Storage.remove(SettingsKey.proExpiredCTA),
      setExpiredCTAString: 'Set Expired CTA as never shown',
    };
  }, [proExpiredCTASetting]);

  if (!proAvailable && !isDebugMode()) {
    return null;
  }

  return (
    <DebugMenuSection title="Session Pro">
      <FlagToggle forceUpdate={forceUpdate} flag="proAvailable" label="Pro Beta Released" />
      {proAvailable ? (
        <DebugButton buttonColor={SessionButtonColor.Danger} onClick={resetPro}>
          Reset All Pro State
        </DebugButton>
      ) : null}
      {proAvailable ? (
        <DebugButton onClick={() => setPage(DEBUG_MENU_PAGE.Pro)}>Pro Playground</DebugButton>
      ) : null}
      {proAvailable ? (
        <DebugButton
          onClick={() => {
            if (!proAvailable) {
              return;
            }
            dispatch(proBackendDataActions.refreshGetProDetailsFromProBackend({}) as any);
          }}
        >
          Refresh Pro Details
        </DebugButton>
      ) : null}
      <FlagToggle
        forceUpdate={forceUpdate}
        flag="useTestProBackend"
        visibleWithBooleanFlag="proAvailable"
        label="Use Test Pro Backend"
      />
      <FlagToggle
        forceUpdate={forceUpdate}
        flag="proGroupsAvailable"
        visibleWithBooleanFlag="proAvailable"
        label="Pro Groups Released"
      />
      {proAvailable ? (
        <DebugButton buttonColor={SessionButtonColor.Danger} onClick={resetProMocking}>
          Reset Pro Mocking
        </DebugButton>
      ) : null}

      <FlagEnumDropdownInput
        label="Current Status"
        flag="mockProCurrentStatus"
        options={[
          { label: 'Never Had Pro', value: ProStatus.NeverBeenPro },
          { label: 'Active', value: ProStatus.Active },
          { label: 'Expired', value: ProStatus.Expired },
        ]}
        forceUpdate={forceUpdate}
        unsetOption={{ label: 'Select Current Status', value: null }}
        visibleWithBooleanFlag="proAvailable"
      />
      {proBooleanFlags.map(props => (
        <FlagToggle {...props} key={props.flag} forceUpdate={forceUpdate} />
      ))}
      <FlagEnumDropdownInput
        label="Payment Provider"
        flag="mockProPaymentProvider"
        options={[
          { label: 'Google Play', value: ProPaymentProvider.GooglePlayStore },
          { label: 'iOS App Store', value: ProPaymentProvider.iOSAppStore },
        ]}
        forceUpdate={forceUpdate}
        unsetOption={{ label: 'Select originating platform', value: null }}
        visibleWithBooleanFlag="proAvailable"
        visibleWithEnumFlag={{
          flag: 'mockProCurrentStatus',
          isVisible: v => v !== ProStatus.NeverBeenPro,
        }}
      />
      <FlagEnumDropdownInput
        label="Access Variant"
        flag="mockProAccessVariant"
        options={[
          { label: '1 Month', value: ProAccessVariant.OneMonth },
          { label: '3 Months', value: ProAccessVariant.ThreeMonth },
          { label: '12 Months', value: ProAccessVariant.TwelveMonth },
        ]}
        forceUpdate={forceUpdate}
        unsetOption={{ label: 'Select access variant', value: null }}
        visibleWithBooleanFlag="proAvailable"
        visibleWithEnumFlag={{
          flag: 'mockProCurrentStatus',
          isVisible: v => v !== ProStatus.NeverBeenPro,
        }}
      />
      <FlagEnumDropdownInput
        label="Expiry"
        flag="mockProAccessExpiry"
        options={[
          { label: '7 Days', value: MockProAccessExpiryOptions.P7D },
          { label: '29 Days', value: MockProAccessExpiryOptions.P29D },
          { label: '30 Days', value: MockProAccessExpiryOptions.P30D },
          { label: '30 Days 1 Second', value: MockProAccessExpiryOptions.P30DT1S },
          { label: '90 Days', value: MockProAccessExpiryOptions.P90D },
          { label: '300 Days', value: MockProAccessExpiryOptions.P300D },
          { label: '365 Days', value: MockProAccessExpiryOptions.P365D },
          { label: '24 Days 1 Minute', value: MockProAccessExpiryOptions.P24DT1M },
          { label: '24 Hours 1 Minute', value: MockProAccessExpiryOptions.PT24H1M },
          { label: '23 Hours 59 Minutes', value: MockProAccessExpiryOptions.PT23H59M },
          { label: '33 Minutes', value: MockProAccessExpiryOptions.PT33M },
          { label: '1 Minute', value: MockProAccessExpiryOptions.PT1M },
          { label: '10 Seconds', value: MockProAccessExpiryOptions.PT10S },
        ]}
        forceUpdate={forceUpdate}
        unsetOption={{ label: 'Select expiry', value: null }}
        visibleWithBooleanFlag="proAvailable"
        visibleWithEnumFlag={{
          flag: 'mockProCurrentStatus',
          isVisible: v => v === ProStatus.Active,
        }}
      />
      {mockExpiry ? (
        <i>Mocked expiry time does not tick, it will keep being set to now + mock_expiry.</i>
      ) : null}
      <FlagIntegerInput
        label="Longer Messages Sent"
        flag="mockProLongerMessagesSent"
        forceUpdate={forceUpdate}
        visibleWithBooleanFlag="proAvailable"
      />
      <FlagIntegerInput
        label="Pinned Conversations"
        flag="mockProPinnedConversations"
        forceUpdate={forceUpdate}
        visibleWithBooleanFlag="proAvailable"
      />
      <FlagIntegerInput
        label="Pro Badges Sent"
        flag="mockProBadgesSent"
        forceUpdate={forceUpdate}
        visibleWithBooleanFlag="proAvailable"
      />
      <FlagIntegerInput
        label="Groups Upgraded"
        flag="mockProGroupsUpgraded"
        forceUpdate={forceUpdate}
        visibleWithBooleanFlag="proAvailable"
      />
      {proBackendBooleanFlags.map(props => (
        <FlagToggle {...props} key={props.flag} forceUpdate={forceUpdate} />
      ))}
      <MessageProFeatures forceUpdate={forceUpdate} />
      <i>
        The CTAs will show when a conversation is next opened or the user settings modal is next
        closed
      </i>
      {proAvailable ? (
        <DebugButton
          onClick={async () => {
            await handleSetExpiringSoonCTA();
            forceUpdate();
          }}
        >
          {setExpiringSoonCTAString}
        </DebugButton>
      ) : null}
      {proAvailable ? (
        <DebugButton
          onClick={async () => {
            await handleSetExpiredCTA();
            forceUpdate();
          }}
        >
          {setExpiredCTAString}
        </DebugButton>
      ) : null}
      {proAvailable ? <ProConfigManager forceUpdate={forceUpdate} /> : null}
    </DebugMenuSection>
  );
};
