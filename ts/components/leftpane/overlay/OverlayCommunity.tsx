/* eslint-disable @typescript-eslint/no-misused-promises */
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import useKey from 'react-use/lib/useKey';

import { SessionJoinableRooms } from './SessionJoinableDefaultRooms';

import {
  joinOpenGroupV2WithUIEvents,
  JoinSogsRoomUICallbackArgs,
} from '../../../session/apis/open_group_api/opengroupV2/JoinOpenGroupV2';
import { openGroupV2CompleteURLRegex } from '../../../session/apis/open_group_api/utils/OpenGroupUtils';
import { SessionButton, SessionButtonColor } from '../../basic/SessionButton';
import { SessionSpinner } from '../../loading';

import {
  markConversationInitialLoadingInProgress,
  openConversationWithMessages,
} from '../../../state/ducks/conversations';
import { useLeftOverlayMode } from '../../../state/selectors/section';
import { Spacer2XL } from '../../basic/Text';
import { StyledLeftPaneOverlay } from './OverlayMessage';
import LIBSESSION_CONSTANTS from '../../../session/utils/libsession/libsession_constants';
import { sectionActions } from '../../../state/ducks/section';
import { SimpleSessionTextarea } from '../../inputs/SessionInput';
import { localize } from '../../../localization/localeTools';

async function joinOpenGroup(
  serverUrl: string,
  errorHandler: (error: string) => void,
  uiCallback?: (args: JoinSogsRoomUICallbackArgs) => void
) {
  // guess if this is an open
  if (serverUrl.match(openGroupV2CompleteURLRegex)) {
    const groupCreated = await joinOpenGroupV2WithUIEvents(
      serverUrl,
      false,
      uiCallback,
      errorHandler
    );
    return groupCreated;
  }
  throw new Error(localize('communityEnterUrlErrorInvalid').toString());
}

export const OverlayCommunity = () => {
  const dispatch = useDispatch();

  const [groupUrl, setGroupUrl] = useState('');
  const [groupUrlError, setGroupUrlError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const overlayModeIsCommunity = useLeftOverlayMode() === 'open-group';

  function closeOverlay() {
    dispatch(sectionActions.resetLeftOverlayMode());
  }

  async function onTryJoinRoom(completeUrl?: string) {
    try {
      if (loading) {
        return;
      }
      setGroupUrlError(undefined);
      const url = (completeUrl && completeUrl.trim()) || (groupUrl && groupUrl.trim());
      await joinOpenGroup(url, setGroupUrlError, joinSogsUICallback);
    } catch (e) {
      setGroupUrlError(e.message);
      window.log.warn(e);
    } finally {
      setLoading(false);
    }
  }

  function joinSogsUICallback(args: JoinSogsRoomUICallbackArgs) {
    setLoading(args.loadingState === 'started');
    if (args.conversationKey) {
      dispatch(
        markConversationInitialLoadingInProgress({
          conversationKey: args.conversationKey,
          isInitialFetchingInProgress: true,
        })
      );
    }
    if (args.loadingState === 'finished' && overlayModeIsCommunity && args.conversationKey) {
      closeOverlay();
      void openConversationWithMessages({ conversationKey: args.conversationKey, messageId: null }); // open to last unread for a session run sogs
    }
  }

  useKey('Escape', closeOverlay);

  return (
    <StyledLeftPaneOverlay
      $container={true}
      $flexDirection={'column'}
      $flexGrow={1}
      $alignItems={'center'}
      padding={'var(--margins-md)'}
    >
      <SimpleSessionTextarea
        // not monospaced. This is a plain text input for a community url
        autoFocus={true}
        placeholder={localize('communityEnterUrl').toString()}
        value={groupUrl}
        onValueChanged={setGroupUrl}
        singleLine={true}
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onEnterPressed={onTryJoinRoom}
        providedError={groupUrlError}
        disabled={loading}
        // - 1 for null terminator
        maxLength={LIBSESSION_CONSTANTS.COMMUNITY_FULL_URL_MAX_LENGTH - 1}
        textSize="md"
        inputDataTestId="join-community-conversation"
        errorDataTestId="error-message"
      />
      <Spacer2XL />
      <SessionButton
        text={localize('join').toString()}
        disabled={!groupUrl || loading}
        onClick={onTryJoinRoom}
        dataTestId="join-community-button"
        buttonColor={SessionButtonColor.PrimaryDark}
      />
      {!loading ? <Spacer2XL /> : null}
      <SessionSpinner loading={loading} />
      <SessionJoinableRooms onJoinClick={onTryJoinRoom} alreadyJoining={loading} />
    </StyledLeftPaneOverlay>
  );
};
