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
import { tr } from '../../localization/localeTools';
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

const StyledExitHint = styled.button`
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
  border: 0;
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
    isRemoteScreenSharing,
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

  // requestFullscreen() needs the element mounted, so it cannot be called from the button.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return undefined;
    }

    if (!document.fullscreenElement) {
      void Promise.resolve(element.requestFullscreen?.()).catch(e => {
        // not fatal: the in-window overlay is still shown, it just does not cover the display
        window.log?.warn('requestFullscreen failed:', e?.message);
      });
    }

    // Electron leaves DOM full screen by itself on Escape or the OS controls; follow it.
    const onFullScreenChange = () => {
      if (!document.fullscreenElement) {
        dispatch(setFullScreenCall(false));
      }
    };
    document.addEventListener('fullscreenchange', onFullScreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', onFullScreenChange);
      if (document.fullscreenElement === element) {
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
      <StyledExitHint
        type="button"
        data-testid="exit-full-screen-call"
        onClick={toggleFullScreenOFF}
      >
        {tr('callsFullScreenExit')} <kbd>Esc</kbd>
      </StyledExitHint>
      <StyledVideoElement
        ref={videoRefRemote}
        autoPlay={true}
        $isVideoMuted={remoteStreamVideoIsMuted}
        $screenShare={isRemoteScreenSharing}
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
