import { isBoolean } from 'lodash';
import { useEffect, useState } from 'react';
import { clipboard } from 'electron';
import {
  getDataFeatureFlag,
  getFeatureFlag,
  MockProAccessExpiryOptions,
  SessionDataFeatureFlags,
  useDataFeatureFlag,
  type SessionDataFeatureFlagKeys,
  type SessionBooleanFeatureFlagKeys,
  useFeatureFlag,
} from '../../../state/ducks/types/releasedFeaturesReduxTypes';
import { Flex } from '../../basic/Flex';
import { SessionToggle } from '../../basic/SessionToggle';
import { HintText, SpacerXS } from '../../basic/Text';
import { DEBUG_FEATURE_FLAGS } from './constants';
import { ConvoHub } from '../../../session/conversations';
import { isDebugMode } from '../../../shared/env_vars';
import { ProMessageFeature } from '../../../models/proMessageFeature';
import { SessionButtonShiny } from '../../basic/SessionButtonShiny';
import { SessionButtonColor, SessionButtonShape } from '../../basic/SessionButton';
import { ToastUtils } from '../../../session/utils';
import { DebugMenuSection } from './DebugMenuModal';
import {
  ProAccessVariant,
  ProPaymentProvider,
  ProStatus,
} from '../../../session/apis/pro_backend_api/types';

type FeatureFlagToggleType = {
  forceUpdate: () => void;
  flag: SessionBooleanFeatureFlagKeys;
  parentFlag?: SessionBooleanFeatureFlagKeys;
};

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

  ConvoHub.use()
    .getConversations()
    .forEach(convo => {
      convo.triggerUIRefresh();
    });
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

  ConvoHub.use()
    .getConversations()
    .forEach(convo => {
      convo.triggerUIRefresh();
    });
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
};

export const FlagIntegerInput = ({
  flag,
  forceUpdate,
  visibleWithBooleanFlag,
  label,
}: FlagIntegerInputProps) => {
  const currentValue = useDataFeatureFlag(flag);
  const key = `feature-flag-integer-input-${flag}`;
  const [value, setValue] = useState<number>(() => {
    const initValue = window.sessionDataFeatureFlags[flag];
    return typeof initValue === 'number' && Number.isFinite(initValue) ? initValue : 0;
  });

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
          min={0}
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
  .concat(['proAvailable', 'proGroupsAvailable']);

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
        if (
          (!isDebugMode() && DEBUG_FEATURE_FLAGS.DEV.includes(flag)) ||
          DEBUG_FEATURE_FLAGS.UNSUPPORTED.includes(flag)
        ) {
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
  if (!isDebugMode()) {
    return null;
  }
  return (
    <DebugMenuSection title="Debug Feature Flags">
      {debugFeatureFlags.map(props => (
        <FlagToggle {...props} forceUpdate={forceUpdate} />
      ))}
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

      ConvoHub.use()
        .getConversations()
        .forEach(convo => {
          convo.triggerUIRefresh();
        });
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
  const proIsAvailable = useFeatureFlag('proAvailable');
  const value = useDataFeatureFlag('mockMessageProFeatures') ?? [];

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
export const ProDebugSection = ({ forceUpdate }: { forceUpdate: () => void }) => {
  const mockExpiry = useDataFeatureFlag('mockProAccessExpiry');
  return (
    <DebugMenuSection title="Session Pro">
      <FlagToggle forceUpdate={forceUpdate} flag="proAvailable" label="Pro Beta Released" />
      <FlagToggle
        forceUpdate={forceUpdate}
        flag="proGroupsAvailable"
        visibleWithBooleanFlag="proAvailable"
        label="Pro Groups Released"
      />
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
    </DebugMenuSection>
  );
};
