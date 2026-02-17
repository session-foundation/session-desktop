/* eslint-disable @typescript-eslint/no-misused-promises */

import autoBind from 'auto-bind';
import useKey from 'react-use/lib/useKey';
import MicRecorder from 'mic-recorder-to-mp3';
import { Component } from 'react';
import styled, { keyframes } from 'styled-components';

import { Constants } from '../../session';
import { MAX_ATTACHMENT_FILESIZE_BYTES } from '../../session/constants';
import { ToastUtils } from '../../session/utils';
import { type SessionIconSize } from '../icon';
import { useFormattedDuration } from '../../hooks/useFormattedDuration';
import { SessionLucideIconButton } from '../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';
import { focusVisibleOutlineStr } from '../../styles/focusVisible';
import { isDeleteKey, isEnterKey, isEscapeKey, isSpaceKey } from '../../util/keyboardShortcuts';

interface Props {
  onExitVoiceNoteView: () => void;
  onLoadVoiceNoteView: () => void;
  sendVoiceMessage: (audioBlob: Blob) => Promise<void>;
}

interface State {
  recordDuration: number;
  isRecording: boolean;
  isPlaying: boolean;
  isPaused: boolean;

  actionHover: boolean;
  startTimestamp: number;
  nowTimestamp: number;
}

function getTimestamp() {
  return Date.now() / 1000;
}

interface StyledFlexWrapperProps {
  $marginHorizontal: string;
}

const sharedButtonProps = {
  iconColor: 'var(--chat-buttons-icon-color)',
  iconSize: 'large' satisfies SessionIconSize as SessionIconSize,
  backgroundColor: 'var(--chat-buttons-background-color)',
  padding: 'var(--margins-sm)',
};

const pulseColorAnimation = keyframes`
    0% {
      transform: scale(0.95);
      box-shadow: 0 0 0 0 rgba(var(--session-recording-pulse-color), 0.7);
    }

    70% {
      transform: scale(1);
      box-shadow: 0 0 0 10px rgba(var(--session-recording-pulse-color), 0);
    }

    100% {
      transform: scale(0.95);
      box-shadow: 0 0 0 0 rgba(var(--session-recording-pulse-color), 0);
    }
`;

const StyledRecordTimerLight = styled.div`
  height: var(--margins-sm);
  width: var(--margins-sm);
  border-radius: 50%;
  background-color: rgb(var(--session-recording-pulse-color));
  margin: 0 var(--margins-sm);
  animation: ${pulseColorAnimation} var(--duration-pulse) infinite;
`;

/**
 * Generic wrapper for quickly passing in theme constant values.
 */
const StyledFlexWrapper = styled.div<StyledFlexWrapperProps>`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--margins-xs);

  .session-button {
    margin: ${props => props.$marginHorizontal};
  }
`;

const StyledRecordingTimer = styled.div<{ $isRecording: boolean }>`
  display: inline-flex;
  align-items: center;
  font-family: var(--font-default);
  font-weight: bold;
  font-size: 14px;
  flex-shrink: 0;
  animation: fadein var(--default-duration);

  @media (-webkit-min-device-pixel-ratio: 1.6) {
    ${({ $isRecording }) => !$isRecording && 'margin-left: auto'};
  }
`;

function RecordingDurations({
  isRecording,
  displaySeconds,
  remainingSeconds,
}: {
  isRecording: boolean;
  displaySeconds: number;
  remainingSeconds: number;
}) {
  const displayTimeString = useFormattedDuration(displaySeconds, { forceHours: false });
  const remainingTimeString = useFormattedDuration(remainingSeconds, { forceHours: false });

  return (
    <StyledRecordingTimer $isRecording={isRecording}>
      {displayTimeString + (remainingTimeString ? ` / ${remainingTimeString}` : '')}
    </StyledRecordingTimer>
  );
}

function RecordingTimer({ displaySeconds }: { displaySeconds: number }) {
  const displayTimeString = useFormattedDuration(displaySeconds, { forceHours: false });

  return (
    <StyledRecordingTimer $isRecording={false}>
      {displayTimeString}
      <StyledRecordTimerLight />
    </StyledRecordingTimer>
  );
}

const StyledRecordingActions = styled.div`
  display: flex;
  align-items: center;
  width: var(--actions-element-size);
  height: var(--actions-element-size);
  border-radius: 50%;

  .session-button {
    animation: fadein var(--default-duration);
  }

  .session-icon-button {
    animation: fadein var(--default-duration);
    border-radius: 50%;
    width: var(--actions-element-size);
    height: var(--actions-element-size);
  }
`;

const StyledRecording = styled.div`
  height: var(--composition-container-height);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-grow: 1;
  outline: none;
  margin-left: var(--margins-md);
  margin-right: var(--margins-md);

  --actions-element-size: 30px;
`;

function RecordingActions({
  isPlaying,
  isPaused,
  isRecording,
  startTimestamp,
  nowTimestamp,
  pauseAudio,
  stopRecordingStream,
  audioElement,
  playAudio,
  onDeleteVoiceMessage,
  onSendVoiceMessage,
}: {
  isPlaying: boolean;
  isPaused: boolean;
  isRecording: boolean;
  startTimestamp: number;
  nowTimestamp: number;
  pauseAudio: () => void;
  stopRecordingStream: () => void;
  audioElement?: HTMLAudioElement | null;
  playAudio: () => void;
  onDeleteVoiceMessage: () => void;
  onSendVoiceMessage: () => void;
}) {
  const hasRecordingAndPaused = !isRecording && !isPlaying;
  const hasRecording = !!audioElement?.duration && audioElement?.duration > 0;
  const actionPauseAudio = !isRecording && !isPaused && isPlaying;
  const actionDefault = !isRecording && !hasRecordingAndPaused && !actionPauseAudio;

  // if we are recording, we base the time recording on our state values
  // if we are playing ( audioElement?.currentTime is !== 0, use that instead)
  // if we are not playing but we have an audioElement, display its duration
  // otherwise display 0
  const displayTimeMs = isRecording
    ? (nowTimestamp - startTimestamp) * 1000
    : (audioElement?.currentTime && (audioElement.currentTime * 1000 || audioElement?.duration)) ||
      0;

  const recordingDurationMs = audioElement?.duration ? audioElement.duration * 1000 : 1;

  const actionPauseFn = isPlaying ? pauseAudio : stopRecordingStream;

  useKey(
    (event: KeyboardEvent) => {
      return isEscapeKey(event) || isDeleteKey(event);
    },
    () => {
      void onDeleteVoiceMessage();
    }
  );

  useKey(
    (event: KeyboardEvent) => {
      return isSpaceKey(event);
    },
    () => {
      if (isRecording) {
        return;
      }
      if (isPlaying) {
        pauseAudio();
        return;
      }
      playAudio();
    }
  );

  useKey(
    (event: KeyboardEvent) => {
      return isEnterKey(event);
    },
    () => {
      if (isRecording) {
        void stopRecordingStream();
      } else {
        void onSendVoiceMessage();
      }
    }
  );

  return (
    <>
      <StyledRecordingActions>
        <StyledFlexWrapper $marginHorizontal="5px">
          {isRecording && (
            <SessionLucideIconButton
              iconColor={'var(--danger-color)'}
              unicode={LUCIDE_ICONS_UNICODE.SQUARE}
              onClick={actionPauseFn}
              iconSize={'large'}
              dataTestId="end-voice-message"
              focusVisibleEffect={focusVisibleOutlineStr()}
            />
          )}
          {actionPauseAudio && (
            <SessionLucideIconButton
              unicode={LUCIDE_ICONS_UNICODE.PAUSE}
              {...sharedButtonProps}
              onClick={actionPauseFn}
            />
          )}
          {hasRecordingAndPaused && (
            <SessionLucideIconButton
              unicode={LUCIDE_ICONS_UNICODE.PLAY}
              {...sharedButtonProps}
              onClick={playAudio}
            />
          )}
          {hasRecording && (
            <SessionLucideIconButton
              unicode={LUCIDE_ICONS_UNICODE.TRASH2}
              onClick={onDeleteVoiceMessage}
              {...sharedButtonProps}
            />
          )}
        </StyledFlexWrapper>

        {actionDefault && (
          <SessionLucideIconButton unicode={LUCIDE_ICONS_UNICODE.MIC} iconSize="large" />
        )}
      </StyledRecordingActions>

      {hasRecording && !isRecording ? (
        <RecordingDurations
          isRecording={isRecording}
          displaySeconds={Math.floor(displayTimeMs / 1000)}
          remainingSeconds={Math.floor(recordingDurationMs / 1000)}
        />
      ) : null}

      {isRecording ? <RecordingTimer displaySeconds={Math.floor(displayTimeMs / 1000)} /> : null}

      {!isRecording && (
        <div>
          <SessionLucideIconButton
            unicode={LUCIDE_ICONS_UNICODE.ARROW_UP}
            onClick={onSendVoiceMessage}
            dataTestId="send-message-button"
            {...sharedButtonProps}
          />
        </div>
      )}
    </>
  );
}

export class SessionRecording extends Component<Props, State> {
  private recorder?: typeof MicRecorder;
  private audioBlobMp3?: Blob;
  private audioElement?: HTMLAudioElement | null;
  private updateTimerInterval?: NodeJS.Timeout;

  constructor(props: Props) {
    super(props);
    autoBind(this);
    const now = getTimestamp();

    this.state = {
      recordDuration: 0,
      isRecording: true,
      isPlaying: false,
      isPaused: false,
      actionHover: false,
      startTimestamp: now,
      nowTimestamp: now,
    };
  }

  public componentDidMount() {
    // This turns on the microphone on the system. Later we need to turn it off.

    void this.initiateRecordingStream();
    // Callback to parent on load complete

    if (this.props.onLoadVoiceNoteView) {
      this.props.onLoadVoiceNoteView();
    }
    this.updateTimerInterval = global.setInterval(this.timerUpdate, 500);
  }

  public componentWillUnmount() {
    if (this.updateTimerInterval) {
      clearInterval(this.updateTimerInterval);
    }
    void this.stopRecordingStream();
  }

  public render() {
    const { isPlaying, isPaused, isRecording, startTimestamp, nowTimestamp } = this.state;

    return (
      <StyledRecording role="main">
        <RecordingActions
          isPlaying={isPlaying}
          isPaused={isPaused}
          isRecording={isRecording}
          startTimestamp={startTimestamp}
          nowTimestamp={nowTimestamp}
          pauseAudio={this.pauseAudio}
          stopRecordingStream={this.stopRecordingStream}
          audioElement={this.audioElement}
          playAudio={this.playAudio}
          onDeleteVoiceMessage={this.onDeleteVoiceMessage}
          onSendVoiceMessage={this.onSendVoiceMessage}
        />
      </StyledRecording>
    );
  }

  private async timerUpdate() {
    const { nowTimestamp, startTimestamp } = this.state;
    const elapsedTime = nowTimestamp - startTimestamp;

    // Prevent voice messages exceeding max length.
    if (elapsedTime >= Constants.CONVERSATION.MAX_VOICE_MESSAGE_DURATION) {
      await this.stopRecordingStream();
    }

    this.setState({
      nowTimestamp: getTimestamp(),
    });
  }

  private stopRecordingState() {
    this.setState({
      isRecording: false,
      isPaused: true,
    });
  }

  private async playAudio() {
    // Generate audio element if it doesn't exist
    const { recordDuration } = this.state;

    if (!this.audioBlobMp3) {
      return;
    }

    if (this.audioElement) {
      window?.log?.info('Audio element already init');
    } else {
      const audioURL = window.URL.createObjectURL(this.audioBlobMp3);
      this.audioElement = new Audio(audioURL);

      this.audioElement.loop = false;
      this.audioElement.onended = () => {
        this.pauseAudio();
      };

      this.audioElement.oncanplaythrough = async () => {
        const duration = recordDuration;

        if (duration && this.audioElement && this.audioElement.currentTime < duration) {
          await this.audioElement?.play();
        }
      };
    }

    this.setState({
      isRecording: false,
      isPaused: false,
      isPlaying: true,
    });

    await this.audioElement.play();
  }

  private pauseAudio() {
    if (this.audioElement) {
      this.audioElement.pause();
    }
    this.setState({
      isPlaying: false,
      isPaused: true,
    });
  }

  private async onDeleteVoiceMessage() {
    this.pauseAudio();
    await this.stopRecordingStream();
    this.audioBlobMp3 = undefined;
    this.audioElement = null;
    this.props.onExitVoiceNoteView();
  }

  /**
   * Sends the recorded voice message
   */
  private async onSendVoiceMessage() {
    if (!this.audioBlobMp3 || !this.audioBlobMp3.size) {
      window?.log?.info('Empty audio blob');
      return;
    }

    // Is the audio file > attachment filesize limit
    if (this.audioBlobMp3.size > MAX_ATTACHMENT_FILESIZE_BYTES) {
      ToastUtils.pushFileSizeErrorAsByte();
      return;
    }

    void this.props.sendVoiceMessage(this.audioBlobMp3);
  }

  private async initiateRecordingStream() {
    // Start recording. Browser will request permission to use your microphone.
    if (this.recorder) {
      await this.stopRecordingStream();
    }

    this.recorder = new MicRecorder({
      bitRate: 128,
    });
    // eslint-disable-next-line more/no-then
    this.recorder
      .start()
      .then(() => {
        // something else
      })
      .catch((e: any) => {
        window?.log?.error(e);
      });
  }

  /**
   * Stops recording audio, sets recording state to stopped.
   */
  private async stopRecordingStream() {
    if (!this.recorder) {
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_, blob] = await this.recorder.stop().getMp3();
    this.recorder = undefined;

    this.audioBlobMp3 = blob;
    this.updateAudioElementAndDuration();

    // Stop recording
    this.stopRecordingState();
  }

  /**
   * Creates an audio element using the recorded audio blob.
   * Updates the duration for displaying audio duration.
   */
  private updateAudioElementAndDuration() {
    // init audio element
    if (!this.audioBlobMp3) {
      return;
    }
    const audioURL = window.URL.createObjectURL(this.audioBlobMp3);
    this.audioElement = new Audio(audioURL);

    this.setState({
      recordDuration: this.audioElement.duration,
    });

    this.audioElement.loop = false;
    this.audioElement.onended = () => {
      this.pauseAudio();
    };

    this.audioElement.oncanplaythrough = async () => {
      const duration = this.state.recordDuration;

      if (duration && this.audioElement && this.audioElement.currentTime < duration) {
        await this.audioElement?.play();
      }
    };
  }
}
