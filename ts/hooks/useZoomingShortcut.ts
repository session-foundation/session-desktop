import useKey from 'react-use/lib/useKey';
import { ZOOM_FACTOR } from '../session/constants';

const changeZoom = async (
  change: { typeOfChange: 'delta'; delta: number } | { typeOfChange: 'reset' }
) => {
  let value: number = await window.getSettingValue('zoom-factor-setting');
  if (typeof value !== 'number') {
    value = ZOOM_FACTOR.DEFAULT;
  }
  if (change.typeOfChange === 'reset') {
    await window.setSettingValue('zoom-factor-setting', value);
    window.updateZoomFactor();
    return;
  }
  value = Math.min(Math.max(value + change.delta, ZOOM_FACTOR.MIN), ZOOM_FACTOR.MAX);
  await window.setSettingValue('zoom-factor-setting', value);
  window.updateZoomFactor();
};

export function useZoomShortcuts() {
  useKey(
    event =>
      // macos and users in general are used to be able to press the non-numeric += to zoom in and -_ to zoom out (without shift being pressed)
      (event.ctrlKey || event.metaKey) && (event.key === '+' || event.key === '='),
    event => {
      event.preventDefault();
      void changeZoom({ typeOfChange: 'delta', delta: ZOOM_FACTOR.STEP });
    }
  );

  useKey(
    // macos and users in general are used to be able to press the non-numeric += to zoom in and -_ to zoom out (without shift being pressed)
    event => (event.ctrlKey || event.metaKey) && (event.key === '-' || event.key === '_'),
    event => {
      event.preventDefault();
      void changeZoom({ typeOfChange: 'delta', delta: -ZOOM_FACTOR.STEP });
    }
  );

  useKey(
    event => (event.ctrlKey || event.metaKey) && event.key === '0',
    event => {
      event.preventDefault();
      void changeZoom({ typeOfChange: 'reset' });
    }
  );
}
