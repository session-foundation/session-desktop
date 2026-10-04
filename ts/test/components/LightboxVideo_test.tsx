/* eslint-disable import/no-extraneous-dependencies */
import { fireEvent } from '@testing-library/react';
import { expect } from 'chai';
import { createRef } from 'react';
import Sinon from 'sinon';

import { LightboxVideo, saveLightboxVideoVolume } from '../../components/lightbox/LightboxVideo';
import { SettingsKey } from '../../data/settings-key';
import { findAllByTagName, renderComponent } from './renderComponent';

describe('LightboxVideo', () => {
  const getSettingValue = Sinon.stub();
  const setSettingValue = Sinon.stub().resolves();
  const originalGetSettingValue = window.getSettingValue;
  const originalSetSettingValue = window.setSettingValue;
  let clock: Sinon.SinonFakeTimers;

  beforeEach(() => {
    clock = Sinon.useFakeTimers();
    getSettingValue.reset();
    setSettingValue.resetHistory();
    window.getSettingValue = getSettingValue;
    window.setSettingValue = setSettingValue;
  });

  afterEach(() => {
    saveLightboxVideoVolume.cancel();
    clock.restore();
    window.getSettingValue = originalGetSettingValue;
    window.setSettingValue = originalSetSettingValue;
  });

  const renderVideo = () => {
    const result = renderComponent(
      <LightboxVideo renderedRef={createRef()} style={{}} urlToLoad="attachment.mp4" />
    );
    const [video] = findAllByTagName<HTMLVideoElement>(result, 'video');
    return { result, video };
  };

  it('restores the saved volume when the video metadata loads', () => {
    getSettingValue.withArgs(SettingsKey.lightboxVideoVolume).returns(0.35);
    const { result, video } = renderVideo();

    fireEvent.loadedMetadata(video);

    expect(video.volume).to.equal(0.35);
    result.unmount();
  });

  it('ignores an invalid saved volume', () => {
    getSettingValue.withArgs(SettingsKey.lightboxVideoVolume).returns(2);
    const { result, video } = renderVideo();

    fireEvent.loadedMetadata(video);

    expect(video.volume).to.equal(1);
    result.unmount();
  });

  it('saves only the last volume of a burst, once the burst settles', () => {
    const { result, video } = renderVideo();

    [0.8, 0.6, 0.42].forEach(volume => {
      video.volume = volume;
      fireEvent.volumeChange(video);
      clock.tick(100);
    });
    expect(setSettingValue.called).to.equal(false);

    clock.tick(500);
    expect(setSettingValue.callCount).to.equal(1);
    expect(setSettingValue.calledWithExactly(SettingsKey.lightboxVideoVolume, 0.42)).to.equal(true);
    result.unmount();
  });

  it('saves a pending volume change when the lightbox closes', () => {
    const { result, video } = renderVideo();
    video.volume = 0.42;
    fireEvent.volumeChange(video);

    result.unmount();

    expect(setSettingValue.callCount).to.equal(1);
    expect(setSettingValue.calledWithExactly(SettingsKey.lightboxVideoVolume, 0.42)).to.equal(true);
  });

  it('does not save anything on close when the volume was not changed', () => {
    const { result } = renderVideo();

    result.unmount();

    expect(setSettingValue.called).to.equal(false);
  });
});
