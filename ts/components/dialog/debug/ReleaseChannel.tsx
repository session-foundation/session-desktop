import { capitalize } from 'lodash';
import { useDispatch } from 'react-redux';
import useUpdate from 'react-use/lib/useUpdate';
import { localize } from '../../../localization/localeTools';
import { updateConfirmModal } from '../../../state/ducks/modalDialog';
import { Flex } from '../../basic/Flex';
import { SessionButtonColor } from '../../basic/SessionButton';
import { SessionRadioGroup } from '../../basic/SessionRadioGroup';
import { HintText } from '../../basic/Text';
import { ALPHA_CHANNEL, LATEST_CHANNEL, type ReleaseChannels } from '../../../updater/types';
import { Storage } from '../../../util/storage';

/**
 * Returns a function that can set the release channel to a provided value
 */
const useReleaseChannel = () => {
  const dispatch = useDispatch();
  const forceUpdate = useUpdate();

  return (channel: ReleaseChannels) => {
    window.log.debug(
      `[debugMenu] useReleaseChannel Setting release channel to ${channel}. It was ${Storage.get('releaseChannel') || 'not set'}`
    );
    dispatch(
      updateConfirmModal({
        title: localize('warning').toString(),
        i18nMessage: { token: 'settingsRestartDescription' },
        okTheme: SessionButtonColor.Danger,
        okText: localize('restart').toString(),
        onClickOk: async () => {
          try {
            await Storage.put('releaseChannel', channel);
          } catch (error) {
            window.log.warn(
              `[debugMenu] useReleaseChannel Something went wrong when setting the release channel to ${channel}. It was ${Storage.get('releaseChannel') || 'not set'}:`,
              error && error.stack ? error.stack : error
            );
          } finally {
            window.restart();
          }
        },
        onClickCancel: () => {
          dispatch(updateConfirmModal(null));
          forceUpdate();
        },
      })
    );
  };
};

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
  const releaseChannel = Storage.get('releaseChannel') as ReleaseChannels;

  const setReleaseChannel = useReleaseChannel();

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
