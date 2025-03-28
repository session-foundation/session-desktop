import { useDispatch } from 'react-redux';
import useUpdate from 'react-use/lib/useUpdate';
import { localize } from '../../../../localization/localeTools';
import { Storage } from '../../../../util/storage';
import { updateConfirmModal } from '../../../../state/ducks/modalDialog';
import { SessionButtonColor } from '../../../basic/SessionButton';
import type { ReleaseChannels } from '../../../../updater/types';

/**
 * Hook to get and set the release updates channel
 */
export const useReleaseChannel = (): {
  releaseChannel: ReleaseChannels;
  setReleaseChannel: (channel: ReleaseChannels) => void;
} => {
  const releaseChannel = Storage.get('releaseChannel') as ReleaseChannels;
  const dispatch = useDispatch();
  const forceUpdate = useUpdate();

  return {
    releaseChannel,
    setReleaseChannel: (channel: ReleaseChannels) => {
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
    },
  };
};
