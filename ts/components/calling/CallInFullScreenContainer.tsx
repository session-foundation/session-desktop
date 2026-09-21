import { useCallback, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';

import useKey from 'react-use/lib/useKey';
import styled from 'styled-components';
import { getAppDispatch } from '../../state/dispatch';
import { useVideoCallEventsListener } from '../../hooks/useVideoEventListener';
import { setFullScreenCall } from '../../state/ducks/call';
import {
  getCallIsInFullScreen,
  getHasOngoingCallWithFocusedConvo,
} from '../../state/selectors/call';
import { CallWindowControls } from './CallButtons';
import { StyledVideoElement } from './DraggableCallContainer';

const CallInFullScreenVisible = styled.div`
  position: absolute;
  z-index: 9;
  top: 0;
  bottom: 0;
  right: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  background-color: var(--black-color);
  border: var(--default-borders);
  opacity: 1;

  /*
   * When the element is the document's fullscreen element the browser sizes it to the display
   * itself, so the absolute inset above no longer applies.
   */
  &:fullscreen {
    width: 100vw;
    height: 100vh;
  }
`;

const StyledLocalVideoElement = styled.video<{ $isVideoMuted: boolean }>`
  height: 20%;
  width: 20%;
  bottom: 0;
  right: 0;
  position: absolute;
  opacity: ${props => (props.$isVideoMuted ? 0 : 1)};
`;

/**
 * A permanently visible hint in the corner of the full screen call. Full screen used to be a mode
 * you could fall into with no indication of how to leave it.
 */
const StyledExitHint = styled.div`
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  padding: 6px 14px;
  border-radius: 999px;
  background-color: rgba(0, 0, 0, 0.55);
  color: var(--white-color);
  font-size: var(--font-size-sm);
  white-space: nowrap;
  user-select: none;
  cursor: pointer;
`;

export const CallInFullScreenContainer = () => {
  const ongoingCallWithFocused = useSelector(getHasOngoingCallWithFocusedConvo);
  const hasOngoingCallFullScreen = useSelector(getCallIsInFullScreen);

  // Split the component so that the useKey('Escape')  hook is only mounted when we do have an ongoing call
  if (!ongoingCallWithFocused || !hasOngoingCallFullScreen) {
    return null;
  }
  return <CallInFullScreenContainerInner />;
};

const CallInFullScreenContainerInner = () => {
  const dispatch = getAppDispatch();

  const {
    remoteStream,
    remoteStreamVideoIsMuted,
    localStream,
    currentConnectedAudioInputs,
    currentConnectedAudioOutputs,
    currentConnectedCameras,
    isAudioMuted,
    isAudioOutputMuted,
    localStreamVideoIsMuted,
    isScreenSharing,
  } = useVideoCallEventsListener('CallInFullScreenContainer', true);

  const videoRefRemote = useRef<HTMLVideoElement>(null);
  const videoRefLocal = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullScreenOFF = useCallback(() => {
    dispatch(setFullScreenCall(false));
  }, [dispatch]);

  useKey('Escape', () => {
    toggleFullScreenOFF();
  });

  /**
   * Ask the OS/window for real full screen — the overlay on its own only ever filled the app
   * window. The element has to be mounted before requestFullscreen() can be called on it, which
   * is why this lives here and not in the button that dispatches setFullScreenCall(true).
   */
  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return undefined;
    }

    if (!document.fullscreenElement) {
      // Safari/older engines return undefined instead of a promise, hence the optional call
      void Promise.resolve(element.requestFullscreen?.()).catch(e => {
        // not fatal: the in-window overlay is still shown, it just does not cover the display
        window.log?.warn('requestFullscreen failed:', e?.message);
      });
    }

    /**
     * The browser exits DOM full screen on its own (Escape, the OS green button, another app
     * taking over the display) without telling React. Without this the app would keep believing
     * it is in full screen and the overlay would stay up in a windowed app.
     */
    const onFullScreenChange = () => {
      if (!document.fullscreenElement) {
        dispatch(setFullScreenCall(false));
      }
    };
    document.addEventListener('fullscreenchange', onFullScreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', onFullScreenChange);
      if (document.fullscreenElement) {
        void Promise.resolve(document.exitFullscreen?.()).catch(() => {
          /* leaving full screen must never throw on unmount */
        });
      }
    };
  }, [dispatch]);

  if (videoRefRemote?.current) {
    if (videoRefRemote.current.srcObject !== remoteStream) {
      videoRefRemote.current.srcObject = remoteStream;
    }
  }

  if (videoRefLocal?.current) {
    if (videoRefLocal.current.srcObject !== localStream) {
      videoRefLocal.current.srcObject = localStream;
    }
  }

  return (
    <CallInFullScreenVisible ref={containerRef}>
      {/*
        Note: there is deliberately no onClick={toggleFullScreenOFF} on this container. It used to
        be here, and it made every click inside the call — including the ones on the call control
        buttons — drop out of full screen, so full screen and screen sharing could not be used
        together at all.
      */}
      <StyledExitHint onClick={toggleFullScreenOFF}>Exit Full Screen (Esc)</StyledExitHint>
      <StyledVideoElement
        ref={videoRefRemote}
        autoPlay={true}
        $isVideoMuted={remoteStreamVideoIsMuted}
      />
      <StyledLocalVideoElement
        ref={videoRefLocal}
        autoPlay={true}
        muted={true}
        $isVideoMuted={localStreamVideoIsMuted}
      />
      <CallWindowControls
        currentConnectedAudioInputs={currentConnectedAudioInputs}
        currentConnectedAudioOutputs={currentConnectedAudioOutputs}
        currentConnectedCameras={currentConnectedCameras}
        isAudioMuted={isAudioMuted}
        isAudioOutputMuted={isAudioOutputMuted}
        localStreamVideoIsMuted={localStreamVideoIsMuted}
        isFullScreen={true}
        isScreenSharing={isScreenSharing}
      />
    </CallInFullScreenVisible>
  );
};
