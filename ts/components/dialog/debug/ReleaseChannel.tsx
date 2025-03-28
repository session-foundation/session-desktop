import { capitalize } from 'lodash';
import { Flex } from '../../basic/Flex';
import { SessionRadioGroup } from '../../basic/SessionRadioGroup';
import { HintText } from '../../basic/Text';
import { ALPHA_CHANNEL, LATEST_CHANNEL } from '../../../updater/types';
import { useReleaseChannel } from './hooks/useReleaseChannel';

const items = [
  {
    label: 'Stable',
    value: LATEST_CHANNEL,
    inputDataTestId: `input-releases-${LATEST_CHANNEL}` as const,
    labelDataTestId: `label-releases-${LATEST_CHANNEL}` as const,
  },
  {
    label: capitalize(ALPHA_CHANNEL),
    value: ALPHA_CHANNEL,
    inputDataTestId: `input-releases-${ALPHA_CHANNEL}` as const,
    labelDataTestId: `label-releases-${ALPHA_CHANNEL}` as const,
  },
];

export const ReleaseChannel = () => {
  const { releaseChannel, setReleaseChannel } = useReleaseChannel();

  if (!window.sessionFeatureFlags.useReleaseChannels) {
    return null;
  }

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
        <h2>Release Channel</h2>
        <HintText>Experimental</HintText>
      </Flex>
      <SessionRadioGroup
        group="release_channel"
        initialItem={releaseChannel}
        items={items}
        onClick={value => {
          if (value === LATEST_CHANNEL || value === ALPHA_CHANNEL) {
            setReleaseChannel(value);
          }
        }}
        style={{ margin: 0 }}
      />
    </Flex>
  );
};
