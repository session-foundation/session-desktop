import { capitalize } from 'lodash';
import { Flex } from '../../basic/Flex';
import { SessionRadioGroup } from '../../basic/SessionRadioGroup';
import { HintText, SpacerSM } from '../../basic/Text';
import { ALPHA_CHANNEL, isReleaseChannel, STABLE_CHANNEL } from '../../../updater/types';
import { useReleaseChannel } from './hooks/useReleaseChannel';
import { ToastUtils } from '../../../session/utils';
import { DebugMenuSection } from './DebugMenuModal';

const items = [
  {
    label: capitalize(STABLE_CHANNEL),
    value: STABLE_CHANNEL,
    inputDataTestId: `input-releases-${STABLE_CHANNEL}` as const,
    labelDataTestId: `label-releases-${STABLE_CHANNEL}` as const,
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

  return (
    <DebugMenuSection>
      <Flex $container={true} $alignItems="center">
        <h2>Release Channel</h2>
        <HintText>Experimental</HintText>
      </Flex>
      <SessionRadioGroup
        group="release_channel"
        initialItem={releaseChannel}
        items={items}
        onClick={value => {
          if (isReleaseChannel(value)) {
            setReleaseChannel(value);
          } else {
            ToastUtils.pushToastError('ReleaseChannel', 'Invalid release channel!');
          }
        }}
        style={{ margin: 0 }}
      />
      <SpacerSM />
    </DebugMenuSection>
  );
};
