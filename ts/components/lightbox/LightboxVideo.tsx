import type { CSSProperties, Ref, SyntheticEvent } from 'react';

import { SettingsKey } from '../../data/settings-key';

type Props = {
  renderedRef: Ref<HTMLVideoElement>;
  style: CSSProperties;
  urlToLoad: string | undefined;
};

const isValidVolume = (volume: unknown): volume is number =>
  typeof volume === 'number' && Number.isFinite(volume) && volume >= 0 && volume <= 1;

export const LightboxVideo = ({ renderedRef, style, urlToLoad }: Props) => {
  const handleLoadedMetadata = (event: SyntheticEvent<HTMLVideoElement>) => {
    const savedVolume = window.getSettingValue(SettingsKey.lightboxVideoVolume);
    if (isValidVolume(savedVolume)) {
      const video = event.currentTarget;
      video.volume = savedVolume;
    }
  };

  const handleVolumeChange = (event: SyntheticEvent<HTMLVideoElement>) => {
    void window.setSettingValue(SettingsKey.lightboxVideoVolume, event.currentTarget.volume);
  };

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
