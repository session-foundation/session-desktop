import { isArray, isBoolean } from 'lodash';
import { ReactNode, useEffect, useState } from 'react';
import { clipboard } from 'electron';
import {
  getFeatureFlag,
  MockProAccessExpiryOptions,
  SessionFeatureFlagKeys,
  useDataFeatureFlag,
  type SessionFeatureFlagWithDataKeys,
  type SessionFlagsKeys,
} from '../../../state/ducks/types/releasedFeaturesReduxTypes';
import { Flex } from '../../basic/Flex';
import { SessionToggle } from '../../basic/SessionToggle';
import { HintText, SpacerSM, SpacerXS } from '../../basic/Text';
import { DEBUG_FEATURE_FLAGS } from './constants';
import { ConvoHub } from '../../../session/conversations';
import { isDebugMode } from '../../../shared/env_vars';
import { ProMessageFeature } from '../../../models/proMessageFeature';
import { ProAccessVariant, ProOriginatingPlatform } from '../../../hooks/useHasPro';
import { PanelButtonGroup } from '../../buttons';
import { SessionButtonShiny } from '../../basic/SessionButtonShiny';
import { SessionButtonColor, SessionButtonShape } from '../../basic/SessionButton';
import { ToastUtils } from '../../../session/utils';

type FeatureFlagToggleType = {
  forceUpdate: () => void;
  flag: SessionFlagsKeys;
  parentFlag?: SessionFlagsKeys;
};

const handleSetFeatureFlag = ({
  flag,
  parentFlag,
  forceUpdate,
  value,
}: FeatureFlagToggleType & { value: boolean }) => {
  if (parentFlag) {
    (window as any).sessionFeatureFlags[parentFlag][flag] = value;
    window.log.debug(`[debugMenu] toggled ${parentFlag}.${flag} to ${value}`);
  } else {
    (window as any).sessionFeatureFlags[flag] = value;
    window.log.debug(`[debugMenu] toggled ${flag} to ${value}`);
  }

  forceUpdate();

  if (
    flag === 'proAvailable' ||
    flag === 'mockCurrentUserHasPro' ||
    flag === 'mockOthersHavePro' ||
    flag === 'mockCurrentUserHasProExpired'
  ) {
    ConvoHub.use()
      .getConversations()
      .forEach(convo => {
        convo.triggerUIRefresh();
      });
  }
};

const handleFeatureFlagToggle = ({ flag, parentFlag, forceUpdate }: FeatureFlagToggleType) => {
  const currentValue = parentFlag
    ? (window as any).sessionFeatureFlags[parentFlag][flag]
    : (window as any).sessionFeatureFlags[flag];
  handleSetFeatureFlag({ flag, parentFlag, forceUpdate, value: !currentValue });
};

export const FlagToggle = ({
  flag,
  value,
  forceUpdate,
  parentFlag,
  label,
  visibleOnlyWithBooleanFlag,
  hiddenAndDisabledWhenKeyEnabled,
}: FeatureFlagToggleType & {
  value: any;
  label?: string;
  visibleOnlyWithBooleanFlag?: SessionFeatureFlagKeys;
  hiddenAndDisabledWhenKeyEnabled?: SessionFeatureFlagKeys;
}) => {
  const key = `feature-flag-toggle-${flag}`;
  const visibleFlag = visibleOnlyWithBooleanFlag
    ? getFeatureFlag(visibleOnlyWithBooleanFlag)
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

  return visibleFlag ? (
    <Flex
      key={key}
      id={key}
      $container={true}
      width="100%"
      $alignItems="center"
      $justifyContent="flex-start"
      $flexGap="var(--margins-sm)"
      style={{ display: visibleFlag ? undefined : 'hidden' }}
    >
      <SessionToggle
        active={value}
        onClick={() => void handleFeatureFlagToggle({ flag, parentFlag, forceUpdate })}
      />
      <span>
        {label || flag}
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
  flag: SessionFeatureFlagWithDataKeys;
  value: any;
  forceUpdate: () => void;
}) => {
  window.sessionFeatureFlagsWithData[flag] = value;
  forceUpdate();

  ConvoHub.use()
    .getConversations()
    .forEach(convo => {
      convo.triggerUIRefresh();
    });
};

type FlagDropdownInputProps = {
  forceUpdate: () => void;
  flag: SessionFeatureFlagWithDataKeys;
  options: Array<{ label: string; value: number | string | null }>;
  unsetOption: { label: string; value: number | string | null };
  visibleOnlyWithBooleanFlag?: SessionFeatureFlagKeys;
  label: string;
};

export const FlagEnumDropdownInput = ({
  flag,
  options,
  forceUpdate,
  unsetOption,
  visibleOnlyWithBooleanFlag,
  label,
}: FlagDropdownInputProps) => {
  const key = `feature-flag-dropdown-${flag}`;
  const [selected, setSelected] = useState<number | string | null>(() => {
    const initValue = window.sessionFeatureFlagsWithData[flag];
    return typeof initValue === 'string' || Number.isFinite(initValue)
      ? initValue
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

  const visibleFlag = visibleOnlyWithBooleanFlag
    ? getFeatureFlag(visibleOnlyWithBooleanFlag)
    : true;

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
          marginBottom: 'var(--margins-xxs)',
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
  flag: SessionFeatureFlagWithDataKeys;
  visibleOnlyWithBooleanFlag?: SessionFeatureFlagKeys;
  label: string;
};

export const FlagIntegerInput = ({
  flag,
  forceUpdate,
  visibleOnlyWithBooleanFlag,
  label,
}: FlagIntegerInputProps) => {
  const currentValue = useDataFeatureFlag(flag);
  const key = `feature-flag-integer-input-${flag}`;
  const [value, setValue] = useState<number>(() => {
    const initValue = window.sessionFeatureFlagsWithData[flag];
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

  const visibleFlag = visibleOnlyWithBooleanFlag
    ? getFeatureFlag(visibleOnlyWithBooleanFlag)
    : true;

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
          marginBottom: 'var(--margins-xxs)',
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

type FlagValues = boolean | object | string;

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

  window.sessionFeatureFlags.mockMessageProFeatures = proFeatureCycle[nextIndex];

  forceUpdate();
}

const proBooleanFlags: Array<{
  label: string;
  key: SessionFeatureFlagKeys;
  visibleWithParentKey?: SessionFeatureFlagKeys;
  hiddenAndDisabledWhenKeyEnabled?: SessionFeatureFlagKeys;
}> = [
  { label: 'Pro Available', key: 'proAvailable' },
  {
    label: 'Backend Loading',
    key: 'mockProBackendLoading',
    visibleWithParentKey: 'proAvailable',
    hiddenAndDisabledWhenKeyEnabled: 'mockProBackendError',
  },
  {
    label: 'Backend Error',
    key: 'mockProBackendError',
    visibleWithParentKey: 'proAvailable',
    hiddenAndDisabledWhenKeyEnabled: 'mockProBackendLoading',
  },
  {
    label: 'Recover always succeeds',
    key: 'mockProRecoverButtonAlwaysSucceed',
    visibleWithParentKey: 'proAvailable',
    hiddenAndDisabledWhenKeyEnabled: 'mockProRecoverButtonAlwaysFail',
  },
  {
    label: 'Recover always fails',
    key: 'mockProRecoverButtonAlwaysFail',
    visibleWithParentKey: 'proAvailable',
    hiddenAndDisabledWhenKeyEnabled: 'mockProRecoverButtonAlwaysSucceed',
  },
  {
    label: 'Pro Groups Available',
    key: 'proGroupsAvailable',
    visibleWithParentKey: 'proAvailable',
  },
  {
    label: 'Has Access',
    key: 'mockCurrentUserHasPro',
    visibleWithParentKey: 'proAvailable',
    hiddenAndDisabledWhenKeyEnabled: 'mockCurrentUserHasProExpired',
  },
  {
    label: 'Access Expired',
    key: 'mockCurrentUserHasProExpired',
    visibleWithParentKey: 'proAvailable',
    hiddenAndDisabledWhenKeyEnabled: 'mockCurrentUserHasPro',
  },
  {
    label: 'Platform Refund Expired',
    key: 'mockCurrentUserHasProPlatformRefundExpired',
    visibleWithParentKey: 'mockCurrentUserHasPro',
  },
  {
    label: 'Cancelled',
    key: 'mockCurrentUserHasProCancelled',
    visibleWithParentKey: 'mockCurrentUserHasPro',
  },
  {
    label: 'In Grace Period',
    key: 'mockCurrentUserHasProInGracePeriod',
    visibleWithParentKey: 'mockCurrentUserHasPro',
    hiddenAndDisabledWhenKeyEnabled: 'mockCurrentUserHasProCancelled',
  },
];

const proBooleanFlagKeys = proBooleanFlags.map(({ key }) => key);

export const FeatureFlags = ({
  flags: _flags,
  forceUpdate,
}: {
  flags: Record<string, FlagValues>;
  forceUpdate: () => void;
}) => {
  const flags = Object.fromEntries(
    Object.entries(_flags).filter(
      ([key]) => !proBooleanFlagKeys.includes(key as SessionFeatureFlagKeys)
    )
  );
  return (
    <Flex
      $container={true}
      width={'100%'}
      $flexDirection="column"
      $justifyContent="flex-start"
      $alignItems="flex-start"
      $flexGap="var(--margins-xs)"
    >
      <Flex $container={true} $alignItems="center">
        <h2>Feature Flags</h2>
        <HintText>Experimental</HintText>
      </Flex>
      <i>
        Changes are temporary. You can clear them by reloading the window or restarting the app.
      </i>
      <SpacerXS />
      <SpacerXS />
      {Object.entries(flags).map(([key, value]) => {
        const flag = key as SessionFlagsKeys;
        if (
          (!isDebugMode() && DEBUG_FEATURE_FLAGS.DEV.includes(flag)) ||
          DEBUG_FEATURE_FLAGS.UNSUPPORTED.includes(flag)
        ) {
          return null;
        }

        if (isBoolean(value)) {
          return <FlagToggle forceUpdate={forceUpdate} flag={flag} value={value} />;
        }
        if (isArray(value) && flag === 'mockMessageProFeatures') {
          return (
            <Flex
              $container={true}
              $alignItems="center"
              $flexDirection="row"
              style={{ cursor: 'pointer', gap: 'var(--margins-xs)' }}
              onClick={() => rotateMsgProFeat(value, forceUpdate)}
            >
              <div style={{ flexShrink: 0 }}>{flag}</div>
              <pre style={{ overflow: 'hidden' }}>{JSON.stringify(value)}</pre>
            </Flex>
          );
        }
        throw new Error('Feature flag is not a boolean or array');
      })}
      <SpacerSM />
      <FeatureFlagDumper forceUpdate={forceUpdate} />
      <SpacerSM />
    </Flex>
  );
};

function FeatureFlagDumper({ forceUpdate }: { forceUpdate: () => void }) {
  const [value, setValue] = useState<string>('');

  const handleCopyOnClick = () => {
    const json = JSON.stringify(
      {
        sessionFeatureFlags: window.sessionFeatureFlags,
        sessionFeatureFlagsWithData: window.sessionFeatureFlagsWithData,
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
        keys[0] !== 'sessionFeatureFlags' &&
        keys[1] !== 'sessionFeatureFlagsWithData'
      ) {
        throw new Error(`Invalid keys in object: ${keys}`);
      }

      if (typeof json.sessionFeatureFlags !== 'object') {
        throw new Error('sessionFeatureFlags is not an object!');
      }

      if (typeof json.sessionFeatureFlagsWithData !== 'object') {
        throw new Error('sessionFeatureFlagsWithData is not an object!');
      }

      window.sessionFeatureFlags = json.sessionFeatureFlags;
      window.sessionFeatureFlagsWithData = json.sessionFeatureFlagsWithData;

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
    <DebugMenuSection>
      <Flex $container={true} $alignItems="center">
        <h2>Feature Flag Dumper</h2>
      </Flex>
      <div style={{ display: 'flex', gap: 'var(--margins-sm)' }}>
        {' '}
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

function DebugMenuSection({ children }: { children: ReactNode }) {
  return (
    <PanelButtonGroup
      containerStyle={{
        paddingBlock: 'var(--margins-md)',
        paddingInline: 'var(--margins-lg)',
        gap: 'var(--margins-sm)',
      }}
    >
      {children}
    </PanelButtonGroup>
  );
}

export const ProDebugSection = ({ forceUpdate }: { forceUpdate: () => void }) => {
  const mockExpiry = useDataFeatureFlag('mockProAccessExpiry');
  return (
    <DebugMenuSection>
      <Flex $container={true} $alignItems="center">
        <h2>Session Pro</h2>
      </Flex>
      {proBooleanFlags.map(
        ({ label, key, visibleWithParentKey, hiddenAndDisabledWhenKeyEnabled }) => (
          <FlagToggle
            forceUpdate={forceUpdate}
            flag={key}
            value={window.sessionFeatureFlags[key]}
            label={label}
            visibleOnlyWithBooleanFlag={visibleWithParentKey}
            hiddenAndDisabledWhenKeyEnabled={hiddenAndDisabledWhenKeyEnabled}
          />
        )
      )}
      <FlagEnumDropdownInput
        label="Originating Platform"
        flag="mockProOriginatingPlatform"
        options={[
          { label: 'Google Play', value: ProOriginatingPlatform.GooglePlayStore },
          { label: 'iOS App Store', value: ProOriginatingPlatform.iOSAppStore },
        ]}
        forceUpdate={forceUpdate}
        unsetOption={{ label: 'Select originating platform', value: null }}
        visibleOnlyWithBooleanFlag="mockCurrentUserHasPro"
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
        visibleOnlyWithBooleanFlag="mockCurrentUserHasPro"
      />
      <FlagEnumDropdownInput
        label="Expiry"
        flag="mockProAccessExpiry"
        options={[
          { label: 'Soon', value: MockProAccessExpiryOptions.SOON },
          { label: 'Today', value: MockProAccessExpiryOptions.TODAY },
          { label: 'Tomorrow', value: MockProAccessExpiryOptions.TOMORROW },
          { label: '1 Week', value: MockProAccessExpiryOptions.WEEK },
          { label: '1 Month', value: MockProAccessExpiryOptions.MONTH },
          { label: '3 Months', value: MockProAccessExpiryOptions.THREE_MONTH },
          { label: '1 Year', value: MockProAccessExpiryOptions.YEAR },
          { label: '24 Days 1 Minute', value: MockProAccessExpiryOptions.P24DT1M },
          { label: '24 Hours 1 Minute', value: MockProAccessExpiryOptions.PT24H1M },
          { label: '23 Hours 59 Minutes', value: MockProAccessExpiryOptions.PT23H59M },
          { label: '33 Minutes', value: MockProAccessExpiryOptions.PT33M },
          { label: '1 Minute', value: MockProAccessExpiryOptions.PT1M },
          { label: '10 Seconds', value: MockProAccessExpiryOptions.PT10S },
        ]}
        forceUpdate={forceUpdate}
        unsetOption={{ label: 'Select expiry', value: null }}
        visibleOnlyWithBooleanFlag="mockCurrentUserHasPro"
      />
      {mockExpiry ? (
        <i>Mocked expiry time does not tick, it will keep being set to now + mock_expiry.</i>
      ) : null}
      <SpacerSM />
      <FlagIntegerInput
        label="Longer Messages Sent"
        flag="mockProLongerMessagesSent"
        forceUpdate={forceUpdate}
        visibleOnlyWithBooleanFlag="proAvailable"
      />
      <FlagIntegerInput
        label="Pinned Conversations"
        flag="mockProPinnedConversations"
        forceUpdate={forceUpdate}
        visibleOnlyWithBooleanFlag="proAvailable"
      />
      <FlagIntegerInput
        label="Pro Badges Sent"
        flag="mockProBadgesSent"
        forceUpdate={forceUpdate}
        visibleOnlyWithBooleanFlag="proAvailable"
      />
      <FlagIntegerInput
        label="Groups Upgraded"
        flag="mockProGroupsUpgraded"
        forceUpdate={forceUpdate}
        visibleOnlyWithBooleanFlag="proAvailable"
      />
      <SpacerSM />
    </DebugMenuSection>
  );
};
