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

const items = [
  {
    label: capitalize(LATEST_CHANNEL),
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
  const forceUpdate = useUpdate();
  const releaseChannel = Storage.get('releaseChannel') as ReleaseChannels;

  const dispatch = useDispatch();

  const changeReleaseChannel = (channel: ReleaseChannels) => {
    window.log.debug(
      `WIP: [debugMenu] release channel to ${channel} was ${Storage.get('releaseChannel') || 'not set'}`
    );
    if (Storage.get('releaseChannel') === channel) {
      return;
    }
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
              `[debugMenu] Something went wrong when changing the release channel to ${channel}  was ${Storage.get('releaseChannel') || 'not set'}:`,
              error && error.stack ? error.stack : error
            );
          } finally {
            window.restart();
          }
        },
        onClickCancel: () => {
          window.inboxStore?.dispatch(updateConfirmModal(null));
          forceUpdate();
        },
      })
    );
  };

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
        <h2>Release Channel</h2>
        <HintText>Experimental</HintText>
      </Flex>
      <SessionRadioGroup
        group="release_channel"
        initialItem={releaseChannel}
        items={items}
        onClick={value => {
          if (value === LATEST_CHANNEL || value === ALPHA_CHANNEL) {
            changeReleaseChannel(value);
          }
        }}
        style={{ margin: 0 }}
      />
    </Flex>
  );
};
