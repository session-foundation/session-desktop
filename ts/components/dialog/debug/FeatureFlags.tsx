import { isBoolean } from 'lodash';
import useUpdate from 'react-use/lib/useUpdate';
import type { SessionFeatureFlagsKeys } from '../../../window';
import { Flex } from '../../basic/Flex';
import { SessionToggle } from '../../basic/SessionToggle';
import { HintText, SpacerXS } from '../../basic/Text';

const unsupportedFlags = ['useTestNet'];
const untestedFlags = ['useOnionRequests', 'useClosedGroupV3', 'replaceLocalizedStringsWithKeys'];

const handleFeatureFlagToggle = async (
  forceUpdate: () => void,
  flag: SessionFeatureFlagsKeys,
  parentFlag?: SessionFeatureFlagsKeys
) => {
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
  forceUpdate,
  flag,
  value,
  parentFlag,
}: {
  forceUpdate: () => void;
  flag: SessionFeatureFlagsKeys;
  value: any;
  parentFlag?: SessionFeatureFlagsKeys;
}) => {
  const key = `feature-flag-toggle${parentFlag ? `-${parentFlag}` : ''}-${flag}`;
  return (
    <Flex
      key={key}
      id={key}
      container={true}
      width="100%"
      alignItems="center"
      justifyContent="space-between"
    >
      <span>
        {flag}
        {untestedFlags.includes(flag) ? <HintText>Untested</HintText> : null}
      </span>
      <SessionToggle
        active={value}
        onClick={() => void handleFeatureFlagToggle(forceUpdate, flag, parentFlag)}
      />
    </Flex>
  );
};

export const FeatureFlags = ({ flags }: { flags: Record<string, any> }) => {
  const forceUpdate = useUpdate();
  return (
    <Flex
      container={true}
      width={'100%'}
      flexDirection="column"
      justifyContent="flex-start"
      alignItems="flex-start"
      flexGap="var(--margins-xs)"
    >
      <Flex container={true} alignItems="center">
        <h2>Feature Flags</h2>
        <HintText>Experimental</HintText>
      </Flex>
      <i>
        Changes are temporary. You can clear them by reloading the window or restarting the app.
      </i>
      <SpacerXS />
      {Object.entries(flags).map(([key, value]) => {
        const flag = key as SessionFeatureFlagsKeys;
        if (unsupportedFlags.includes(flag)) {
          return null;
        }

        if (!isBoolean(value)) {
          return (
            <>
              <h3>{flag}</h3>
              {Object.entries(value).map(([k, v]: [string, any]) => {
                const nestedFlag = k as SessionFeatureFlagsKeys;
                return (
                  <FlagToggle
                    forceUpdate={forceUpdate}
                    flag={nestedFlag}
                    value={v}
                    parentFlag={flag}
                  />
                );
              })}
            </>
          );
        }
        return <FlagToggle forceUpdate={forceUpdate} flag={flag} value={value} />;
      })}
    </Flex>
  );
};
