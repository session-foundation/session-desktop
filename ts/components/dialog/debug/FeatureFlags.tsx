import { isBoolean } from 'lodash';
import type { SessionFlagsKeys } from '../../../state/ducks/types/releasedFeaturesReduxTypes';
import { Flex } from '../../basic/Flex';
import { SessionToggle } from '../../basic/SessionToggle';
import { HintText, SpacerSM, SpacerXS } from '../../basic/Text';
import { DEBUG_FEATURE_FLAGS } from './constants';

type FeatureFlagToggleType = {
  forceUpdate: () => void;
  flag: SessionFlagsKeys;
  parentFlag?: SessionFlagsKeys;
};

const handleFeatureFlagToggle = ({ flag, parentFlag, forceUpdate }: FeatureFlagToggleType) => {
  const currentValue = parentFlag
    ? (window as any).sessionFeatureFlags[parentFlag][flag]
    : (window as any).sessionFeatureFlags[flag];

  if (parentFlag) {
    (window as any).sessionFeatureFlags[parentFlag][flag] = !currentValue;
    window.log.debug(`[debugMenu] toggled ${parentFlag}.${flag} to ${!currentValue}`);
  } else {
    (window as any).sessionFeatureFlags[flag] = !currentValue;
    window.log.debug(`[debugMenu] toggled ${flag} to ${!currentValue}`);
  }

  forceUpdate();
};

const FlagToggle = ({
  flag,
  value,
  forceUpdate,
  parentFlag,
}: FeatureFlagToggleType & {
  value: any;
}) => {
  const key = `feature-flag-toggle-${flag}`;
  return (
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
        active={value}
        onClick={() => void handleFeatureFlagToggle({ flag, parentFlag, forceUpdate })}
      />
      <span>
        {flag}
        {DEBUG_FEATURE_FLAGS.DEV.includes(flag) ? <HintText>Experimental</HintText> : null}
        {DEBUG_FEATURE_FLAGS.UNTESTED.includes(flag) ? <HintText>Untested</HintText> : null}
      </span>
    </Flex>
  );
};

type FlagValues = boolean | object;

export const FeatureFlags = ({
  flags,
  forceUpdate,
}: {
  flags: Record<string, FlagValues>;
  forceUpdate: () => void;
}) => {
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
      {Object.entries(flags).map(([key, value]) => {
        const flag = key as SessionFlagsKeys;
        if (
          (!process.env.SESSION_DEV && DEBUG_FEATURE_FLAGS.DEV.includes(flag)) ||
          DEBUG_FEATURE_FLAGS.UNSUPPORTED.includes(flag)
        ) {
          return null;
        }

        if (!isBoolean(value)) {
          return (
            <>
              <h3>{flag}</h3>
              {Object.entries(value).map(([k, v]: [string, FlagValues]) => {
                const nestedFlag = k as SessionFlagsKeys;
                return (
                  <FlagToggle
                    flag={nestedFlag}
                    value={v}
                    parentFlag={flag}
                    forceUpdate={forceUpdate}
                  />
                );
              })}
            </>
          );
        }
        return <FlagToggle forceUpdate={forceUpdate} flag={flag} value={value} />;
      })}
      <SpacerSM />
    </Flex>
  );
};
