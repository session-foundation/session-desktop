import { useDispatch, useSelector } from 'react-redux';
import { OpenGroupData } from '../../data/opengroups';
import { findCachedBlindedMatchOrLookItUp } from '../../session/apis/open_group_api/sogsv3/knownBlindedkeys';
import { ConvoHub } from '../../session/conversations';
import { getSodiumRenderer } from '../../session/crypto';
import { KeyPrefixType } from '../../session/types';
import { updateUserProfileModal } from '../../state/ducks/modalDialog';
import {
    useSelectedConversationKey,
    getSelectedCanWrite,
    useSelectedIsPublic,
} from '../../state/selectors/selectedConversation';
import { Data } from '../../data/data';

export function useOnMessageAvatarClickCb() {
  const dispatch = useDispatch();
  const selectedConvoKey = useSelectedConversationKey();

  const isTypingEnabled = useSelector(getSelectedCanWrite);
  const isPublic = useSelectedIsPublic();

  return async ({ messageId }: { messageId: string }) => {
    const msgModel = await Data.getMessageById(messageId);
    if (!msgModel) {
      return;
    }
    const sender = msgModel.getSource();

    if (!sender || !selectedConvoKey) {
      return;
    }
    if (isPublic && !isTypingEnabled) {
      window.log.info('onMessageAvatarClick: typing is disabled...');
      return;
    }

    if (sender.startsWith(KeyPrefixType.blinded25)) {
      throw new Error('onMessageAvatarClick: blinded25 convo click are disabled currently...');
    }
    const convoOpen = ConvoHub.use().get(selectedConvoKey);
    const room = OpenGroupData.getV2OpenGroupRoom(convoOpen.id);
    if (room?.serverPublicKey) {
      const foundRealSessionId = await findCachedBlindedMatchOrLookItUp(
        sender,
        room.serverPublicKey,
        await getSodiumRenderer()
      );

      const privateConvoToOpen = foundRealSessionId || sender;
      if (!privateConvoToOpen.startsWith(KeyPrefixType.standard)) {
        await ConvoHub.use()
          .get(privateConvoToOpen)
          .setOriginConversationID(selectedConvoKey, true);
      }
    }

    //  open user details dialog for the user to do what he wants
    // Note: if we have the sessionId from a blindedId, we still open the blinded user details dialog (but it will have a different content)
    dispatch(
      updateUserProfileModal({
        conversationId: sender,
      })
    );
  };
}
