import { debounce } from 'lodash';
import type { CSSProperties, Ref, SyntheticEvent } from 'react';
import useUnmount from 'react-use/lib/useUnmount';

import { SettingsKey } from '../../data/settings-key';

type Props = {
  renderedRef: Ref<HTMLVideoElement>;
  style: CSSProperties;
  urlToLoad: string | undefined;
};

const isValidVolume = (volume: unknown): volume is number =>
  typeof volume === 'number' && Number.isFinite(volume) && volume >= 0 && volume <= 1;

// Dragging the volume slider fires a volumechange per step, and each save is a database write.
export const saveLightboxVideoVolume = debounce(
  (volume: number) => {
    void window.setSettingValue(SettingsKey.lightboxVideoVolume, volume);
  },
  500,
  { leading: false, trailing: true }
);

export const LightboxVideo = ({ renderedRef, style, urlToLoad }: Props) => {
  const handleLoadedMetadata = (event: SyntheticEvent<HTMLVideoElement>) => {
    const savedVolume = window.getSettingValue(SettingsKey.lightboxVideoVolume);
    if (isValidVolume(savedVolume)) {
      const video = event.currentTarget;
      video.volume = savedVolume;
    }
  };

  const handleVolumeChange = (event: SyntheticEvent<HTMLVideoElement>) => {
    saveLightboxVideoVolume(event.currentTarget.volume);
  };

  useUnmount(() => {
    saveLightboxVideoVolume.flush();
  });

  return (
    <video
      role="button"
      ref={renderedRef}
      controls={true}
      style={style}
      onLoadedMetadata={handleLoadedMetadata}
      onVolumeChange={handleVolumeChange}
    >
      <source src={urlToLoad} />
    </video>
  );
};
