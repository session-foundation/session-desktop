import { isArray, isBoolean } from 'lodash';
import type { SessionFlagsKeys } from '../../../state/ducks/types/releasedFeaturesReduxTypes';
import { Flex } from '../../basic/Flex';
import { SessionToggle } from '../../basic/SessionToggle';
import { HintText, SpacerSM, SpacerXS } from '../../basic/Text';
import { DEBUG_FEATURE_FLAGS } from './constants';
import { ConvoHub } from '../../../session/conversations';
import { isDebugMode } from '../../../shared/env_vars';
import { ProMessageFeature } from '../../../models/proMessageFeature';

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

  if (flag === 'proAvailable' || flag === 'mockCurrentUserHasPro' || flag === 'mockOthersHavePro') {
    ConvoHub.use()
      .getConversations()
      .forEach(convo => {
        convo.triggerUIRefresh();
      });
  }
};

export const FlagToggle = ({
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

type FlagValues = boolean | object | string;

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
          (!isDebugMode() && DEBUG_FEATURE_FLAGS.DEV.includes(flag)) ||
          DEBUG_FEATURE_FLAGS.UNSUPPORTED.includes(flag)
        ) {
          return null;
        }

        if (isBoolean(value)) {
          return <FlagToggle forceUpdate={forceUpdate} flag={flag} value={value} />;
        }
        if (isArray(value) && flag === 'mockMessageProFeatures') {
          const rotateMsgProFeat = () => {
            if (value.length === 0) {
              window.sessionFeatureFlags.mockMessageProFeatures = [ProMessageFeature.PRO_BADGE];
            } else if (value.length === 1) {
              if (value[0] === ProMessageFeature.PRO_BADGE) {
                window.sessionFeatureFlags.mockMessageProFeatures = [
                  ProMessageFeature.PRO_ANIMATED_DISPLAY_PICTURE,
                ];
              } else if (value[0] === ProMessageFeature.PRO_ANIMATED_DISPLAY_PICTURE) {
                window.sessionFeatureFlags.mockMessageProFeatures = [
                  ProMessageFeature.PRO_INCREASED_MESSAGE_LENGTH,
                ];
              } else if (value[0] === ProMessageFeature.PRO_INCREASED_MESSAGE_LENGTH) {
                window.sessionFeatureFlags.mockMessageProFeatures = [
                  ProMessageFeature.PRO_BADGE,
                  ProMessageFeature.PRO_ANIMATED_DISPLAY_PICTURE,
                  ProMessageFeature.PRO_INCREASED_MESSAGE_LENGTH,
                ];
              }
            } else if (value.length === 3) {
              window.sessionFeatureFlags.mockMessageProFeatures = [];
            }
            forceUpdate();
          };
          return (
            <Flex
              $container={true}
              $alignItems="center"
              $flexDirection="row"
              style={{ cursor: 'pointer', gap: 'var(--margins-xs)' }}
              onClick={rotateMsgProFeat}
            >
              <div>{flag}</div>
              <pre style={{ overflow: 'hidden' }}>{JSON.stringify(value)}</pre>
            </Flex>
          );
        }
        throw new Error('Feature flag is not a boolean or array');
      })}
      <SpacerSM />
    </Flex>
  );
};
