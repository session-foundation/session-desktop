import { MouseEvent, useEffect, useState } from 'react';
import { contextMenu } from 'react-contexify';
import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { getAppDispatch } from '../../state/dispatch';

import { CallManager, ToastUtils } from '../../session/utils';
import { InputItem } from '../../session/utils/calling/CallManager';
import { setFullScreenCall } from '../../state/ducks/call';
import { getHasOngoingCallWithPubkey } from '../../state/selectors/call';
import { DropDownAndToggleButton } from '../icon/DropDownAndToggleButton';
import { SessionContextMenuContainer } from '../SessionContextMenuContainer';
import { Menu, MenuItem } from '../menu/items/MenuItem';
import { SessionLucideIconButton } from '../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';
import { tr } from '../../localization/localeTools';
import { ScreenSharePicker } from './ScreenSharePicker';

/**
 * TODO(l10n): these strings are not in the session-localization project yet (it is a separate
 * repository/submodule). They are English-only until they go through the shared-scripts
 * generator. `fullScreenToggle` below already exists upstream and is localized.
 */
const SHARE_SCREEN_LABEL = 'Share Screen';
const STOP_SHARING_LABEL = 'Stop Sharing';
const EXIT_FULL_SCREEN_LABEL = 'Exit Full Screen (Esc)';
const ENTER_FULL_SCREEN_LABEL = 'Full Screen';

const VideoInputMenu = ({
  triggerId,
  camerasList,
}: {
  triggerId: string;
  camerasList: Array<InputItem>;
}) => {
  return (
    <SessionContextMenuContainer>
      <Menu id={triggerId}>
        {camerasList.map(m => {
          return (
            <MenuItem
              key={m.deviceId}
              onClick={() => {
                void CallManager.selectCameraByDeviceId(m.deviceId);
              }}
              iconType={null}
              isDangerAction={false}
            >
              {m.label.substring(0, 40)}
            </MenuItem>
          );
        })}
      </Menu>
    </SessionContextMenuContainer>
  );
};

const showVideoInputMenu = (
  currentConnectedCameras: Array<InputItem>,
  e: MouseEvent<HTMLDivElement>
) => {
  if (currentConnectedCameras.length === 0) {
    ToastUtils.pushNoCameraFound();
    return;
  }
  contextMenu.show({
    id: videoTriggerId,
    event: e,
  });
};

const videoTriggerId = 'video-menu-trigger-id';
const audioTriggerId = 'audio-menu-trigger-id';
const audioOutputTriggerId = 'audio-output-menu-trigger-id';

export const VideoInputButton = ({
  currentConnectedCameras,
  localStreamVideoIsMuted,
  isFullScreen = false,
}: {
  currentConnectedCameras: Array<InputItem>;
  localStreamVideoIsMuted: boolean;
  isFullScreen?: boolean;
}) => {
  return (
    <>
      <DropDownAndToggleButton
        iconType="camera"
        isMuted={localStreamVideoIsMuted}
        onMainButtonClick={() => {
          void handleCameraToggle(currentConnectedCameras, localStreamVideoIsMuted);
        }}
        onArrowClick={e => {
          showVideoInputMenu(currentConnectedCameras, e);
        }}
        isFullScreen={isFullScreen}
      />

      <VideoInputMenu triggerId={videoTriggerId} camerasList={currentConnectedCameras} />
    </>
  );
};

const AudioInputMenu = ({
  triggerId,
  audioInputsList,
}: {
  triggerId: string;
  audioInputsList: Array<InputItem>;
}) => {
  return (
    <SessionContextMenuContainer>
      <Menu id={triggerId}>
        {audioInputsList.map(m => {
          return (
            <MenuItem
              key={m.deviceId}
              onClick={() => {
                void CallManager.selectAudioInputByDeviceId(m.deviceId);
              }}
              iconType={null}
              isDangerAction={false}
            >
              {m.label.substring(0, 40)}
            </MenuItem>
          );
        })}
      </Menu>
    </SessionContextMenuContainer>
  );
};

const showAudioInputMenu = (
  currentConnectedAudioInputs: Array<any>,
  e: MouseEvent<HTMLDivElement>
) => {
  if (currentConnectedAudioInputs.length === 0) {
    ToastUtils.pushNoAudioInputFound();
    return;
  }
  contextMenu.show({
    id: audioTriggerId,
    event: e,
  });
};

export const AudioInputButton = ({
  currentConnectedAudioInputs,
  isAudioMuted,
  isFullScreen = false,
}: {
  currentConnectedAudioInputs: Array<InputItem>;
  isAudioMuted: boolean;
  isFullScreen?: boolean;
}) => {
  return (
    <>
      <DropDownAndToggleButton
        iconType="microphone"
        isMuted={isAudioMuted}
        onMainButtonClick={() => {
          void handleMicrophoneToggle(currentConnectedAudioInputs, isAudioMuted);
        }}
        onArrowClick={e => {
          showAudioInputMenu(currentConnectedAudioInputs, e);
        }}
        isFullScreen={isFullScreen}
      />

      <AudioInputMenu triggerId={audioTriggerId} audioInputsList={currentConnectedAudioInputs} />
    </>
  );
};

const AudioOutputMenu = ({
  triggerId,
  audioOutputsList,
}: {
  triggerId: string;
  audioOutputsList: Array<InputItem>;
}) => {
  return (
    <SessionContextMenuContainer>
      <Menu id={triggerId}>
        {audioOutputsList.map(m => {
          return (
            <MenuItem
              key={m.deviceId}
              onClick={() => {
                void CallManager.selectAudioOutputByDeviceId(m.deviceId);
              }}
              iconType={null}
              isDangerAction={false}
            >
              {m.label.substring(0, 40)}
            </MenuItem>
          );
        })}
      </Menu>
    </SessionContextMenuContainer>
  );
};

const showAudioOutputMenu = (
  currentConnectedAudioOutputs: Array<any>,
  e: MouseEvent<HTMLDivElement>
) => {
  if (currentConnectedAudioOutputs.length === 0) {
    ToastUtils.pushNoAudioOutputFound();
    return;
  }
  contextMenu.show({
    id: audioOutputTriggerId,
    event: e,
  });
};

export const AudioOutputButton = ({
  currentConnectedAudioOutputs,
  isAudioOutputMuted,
  isFullScreen = false,
}: {
  currentConnectedAudioOutputs: Array<InputItem>;
  isAudioOutputMuted: boolean;
  isFullScreen?: boolean;
}) => {
  return (
    <>
      <DropDownAndToggleButton
        iconType="volume"
        isMuted={isAudioOutputMuted}
        onMainButtonClick={() => {
          void handleSpeakerToggle(currentConnectedAudioOutputs, isAudioOutputMuted);
        }}
        onArrowClick={e => {
          showAudioOutputMenu(currentConnectedAudioOutputs, e);
        }}
        isFullScreen={isFullScreen}
      />

      <AudioOutputMenu
        triggerId={audioOutputTriggerId}
        audioOutputsList={currentConnectedAudioOutputs}
      />
    </>
  );
};

const StyledCallActionButton = styled.div<{ $isFullScreen: boolean }>`
  .session-icon-button {
    background-color: var(--call-buttons-action-background-color);
    border-radius: 50%;
    transition-duration: var(--default-duration);
    ${props => props.$isFullScreen && 'opacity: 0.9;'}
    &:hover {
      background-color: var(--call-buttons-action-background-hover-color);
      ${props => props.$isFullScreen && 'opacity: 1;'}
    }
  }
`;

/**
 * A labelled call control. The icon alone was not discoverable: the caption is what makes
 * "how do I go full screen" answerable without guessing.
 */
const StyledLabelledButton = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
`;

const StyledButtonCaption = styled.span<{ $isFullScreen: boolean }>`
  font-size: var(--font-size-xs);
  color: var(--white-color);
  text-shadow: 0 1px 2px var(--black-color);
  margin-top: 2px;
  white-space: nowrap;
  user-select: none;
  opacity: ${props => (props.$isFullScreen ? 0.95 : 0.8)};
`;

export const ShowInFullScreenButton = ({ isFullScreen }: { isFullScreen: boolean }) => {
  const dispatch = getAppDispatch();

  const showInFullScreen = (e?: MouseEvent<HTMLButtonElement>) => {
    // the control bar sits inside the call overlay: without this, the click also reaches the
    // overlay and any of its handlers
    e?.stopPropagation();
    dispatch(setFullScreenCall(!isFullScreen));
  };

  const label = isFullScreen ? EXIT_FULL_SCREEN_LABEL : ENTER_FULL_SCREEN_LABEL;

  return (
    <StyledLabelledButton>
      <StyledCallActionButton $isFullScreen={isFullScreen}>
        <SessionLucideIconButton
          iconSize={'max'}
          unicode={isFullScreen ? LUCIDE_ICONS_UNICODE.MINIMIZE : LUCIDE_ICONS_UNICODE.MAXIMIZE}
          onClick={showInFullScreen}
          iconColor="var(--black-color)"
          margin="10px"
          title={`${tr('fullScreenToggle')} — ${label}`}
          ariaLabel={label}
          dataTestId="toggle-full-screen"
        />
      </StyledCallActionButton>
      <StyledButtonCaption $isFullScreen={isFullScreen}>{label}</StyledButtonCaption>
    </StyledLabelledButton>
  );
};

/**
 * Screen sharing reuses the call's single video sender, so starting a share turns the camera off
 * and stopping it puts the camera back. See CallManager.startScreenShare.
 */
export const ScreenShareButton = ({
  isFullScreen,
  isScreenSharing,
}: {
  isFullScreen: boolean;
  isScreenSharing: boolean;
}) => {
  const [pickerOpen, setPickerOpen] = useState(false);

  const toggleScreenShare = (e?: MouseEvent<HTMLButtonElement>) => {
    // the control bar lives inside the call overlay; the click must not reach anything behind it
    e?.stopPropagation();
    if (isScreenSharing) {
      void CallManager.stopScreenShare();
      return;
    }
    setPickerOpen(true);
  };

  const label = isScreenSharing ? STOP_SHARING_LABEL : SHARE_SCREEN_LABEL;

  return (
    <StyledLabelledButton>
      {pickerOpen ? (
        <ScreenSharePicker
          onPicked={sourceId => {
            setPickerOpen(false);
            void CallManager.startScreenShare(sourceId);
          }}
          onCancel={() => {
            setPickerOpen(false);
          }}
        />
      ) : null}
      <StyledCallActionButton $isFullScreen={isFullScreen}>
        <SessionLucideIconButton
          iconSize={'max'}
          unicode={
            isScreenSharing
              ? LUCIDE_ICONS_UNICODE.SCREEN_SHARE_OFF
              : LUCIDE_ICONS_UNICODE.SCREEN_SHARE
          }
          onClick={toggleScreenShare}
          iconColor={isScreenSharing ? 'var(--danger-color)' : 'var(--black-color)'}
          margin="10px"
          title={label}
          ariaLabel={label}
          dataTestId="toggle-screen-share"
        />
      </StyledCallActionButton>
      <StyledButtonCaption $isFullScreen={isFullScreen}>{label}</StyledButtonCaption>
    </StyledLabelledButton>
  );
};

export const HangUpButton = ({ isFullScreen }: { isFullScreen: boolean }) => {
  const ongoingCallPubkey = useSelector(getHasOngoingCallWithPubkey);

  const handleEndCall = async () => {
    // call method to end call connection
    if (ongoingCallPubkey) {
      await CallManager.USER_hangup(ongoingCallPubkey);
    }
  };

  return (
    <StyledCallActionButton $isFullScreen={isFullScreen}>
      <SessionLucideIconButton
        iconSize="large"
        padding="10px"
        unicode={LUCIDE_ICONS_UNICODE.PHONE_OFF}
        iconColor="var(--black-color)"
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onClick={handleEndCall}
        margin="10px"
        dataTestId="end-call"
        backgroundColor="var(--danger-color)"
        style={{
          width: '60px',
          height: '60px',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />
    </StyledCallActionButton>
  );
};

const handleCameraToggle = async (
  currentConnectedCameras: Array<InputItem>,
  localStreamVideoIsMuted: boolean
) => {
  if (!currentConnectedCameras.length) {
    ToastUtils.pushNoCameraFound();

    return;
  }
  if (localStreamVideoIsMuted) {
    // select the first one
    await CallManager.selectCameraByDeviceId(currentConnectedCameras[0].deviceId);
  } else {
    await CallManager.selectCameraByDeviceId(CallManager.DEVICE_DISABLED_DEVICE_ID);
  }
};

const handleMicrophoneToggle = async (
  currentConnectedAudioInputs: Array<InputItem>,
  isAudioMuted: boolean
) => {
  if (!currentConnectedAudioInputs.length) {
    ToastUtils.pushNoAudioInputFound();

    return;
  }
  if (isAudioMuted) {
    // selects the first one
    await CallManager.selectAudioInputByDeviceId(currentConnectedAudioInputs[0].deviceId);
  } else {
    await CallManager.selectAudioInputByDeviceId(CallManager.DEVICE_DISABLED_DEVICE_ID);
  }
};

const handleSpeakerToggle = async (
  currentConnectedAudioOutputs: Array<InputItem>,
  isAudioOutputMuted: boolean
) => {
  if (!currentConnectedAudioOutputs.length) {
    ToastUtils.pushNoAudioOutputFound();

    return;
  }
  if (isAudioOutputMuted) {
    // selects the first one
    await CallManager.selectAudioOutputByDeviceId(currentConnectedAudioOutputs[0].deviceId);
  } else {
    await CallManager.selectAudioOutputByDeviceId(CallManager.DEVICE_DISABLED_DEVICE_ID);
  }
};

const StyledCallWindowControls = styled.div<{ $isFullScreen: boolean; $makeVisible: boolean }>`
  position: absolute;
  z-index: 10;

  bottom: 0px;
  width: 100%;
  height: 100%;
  align-items: flex-end;
  padding: 10px;
  border-radius: 10px;
  margin-left: auto;
  margin-right: auto;
  left: 0;
  right: 0;
  transition: all var(--default-duration) ease-in-out;

  display: flex;
  justify-content: center;
  opacity: ${props => (props.$makeVisible ? 1 : 0)};

  ${props =>
    props.$isFullScreen &&
    `
    opacity: 0.9;
    &:hover {
      opacity: 1;
    }
  `}
`;

export const CallWindowControls = ({
  currentConnectedCameras,
  currentConnectedAudioInputs,
  currentConnectedAudioOutputs,
  isAudioMuted,
  isAudioOutputMuted,
  localStreamVideoIsMuted,
  isFullScreen,
  isScreenSharing,
}: {
  isAudioMuted: boolean;
  isAudioOutputMuted: boolean;
  localStreamVideoIsMuted: boolean;
  currentConnectedAudioInputs: Array<InputItem>;
  currentConnectedAudioOutputs: Array<InputItem>;
  currentConnectedCameras: Array<InputItem>;
  isFullScreen: boolean;
  isScreenSharing: boolean;
}) => {
  const [makeVisible, setMakeVisible] = useState(true);

  const setMakeVisibleTrue = () => {
    setMakeVisible(true);
  };
  const setMakeVisibleFalse = () => {
    setMakeVisible(false);
  };

  useEffect(() => {
    setMakeVisibleTrue();
    document.addEventListener('mouseenter', setMakeVisibleTrue);
    document.addEventListener('mouseleave', setMakeVisibleFalse);

    return () => {
      document.removeEventListener('mouseenter', setMakeVisibleTrue);
      document.removeEventListener('mouseleave', setMakeVisibleFalse);
    };
  }, [isFullScreen]);
  return (
    <StyledCallWindowControls $isFullScreen={isFullScreen} $makeVisible={makeVisible}>
      {/*
        Always rendered. It used to be hidden unless the *remote* peer was sending video, which
        meant the only way into full screen disappeared exactly when you wanted to present your
        own screen to someone whose camera is off.
      */}
      <ShowInFullScreenButton isFullScreen={isFullScreen} />
      <ScreenShareButton isFullScreen={isFullScreen} isScreenSharing={isScreenSharing} />

      <VideoInputButton
        currentConnectedCameras={currentConnectedCameras}
        localStreamVideoIsMuted={localStreamVideoIsMuted}
        isFullScreen={isFullScreen}
      />
      <AudioInputButton
        currentConnectedAudioInputs={currentConnectedAudioInputs}
        isAudioMuted={isAudioMuted}
        isFullScreen={isFullScreen}
      />
      <AudioOutputButton
        currentConnectedAudioOutputs={currentConnectedAudioOutputs}
        isAudioOutputMuted={isAudioOutputMuted}
        isFullScreen={isFullScreen}
      />
      <HangUpButton isFullScreen={isFullScreen} />
    </StyledCallWindowControls>
  );
};
