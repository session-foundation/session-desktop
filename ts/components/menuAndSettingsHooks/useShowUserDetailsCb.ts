import { useDispatch } from 'react-redux';
import { getCachedNakedKeyFromBlindedNoServerPubkey } from '../../session/apis/open_group_api/sogsv3/knownBlindedkeys';
import { ConvoHub } from '../../session/conversations';
import { KeyPrefixType, PubKey } from '../../session/types';
import { updateUserProfileModal } from '../../state/ducks/modalDialog';
import { Data } from '../../data/data';
import type { WithMessageId } from '../../session/types/with';
import { useIsMe, useIsPrivate } from '../../hooks/useParamSelector';
import { useSelectedConversationKey } from '../../state/selectors/selectedConversation';

/**
 * Show the user details modal for a given message in the currently selected conversation.
 */
export function useShowUserDetailsCbFromMessage() {
  const dispatch = useDispatch();

  const selectedConvoKey = useSelectedConversationKey();

  if (!selectedConvoKey) {
    throw new Error('useShowUserDetailsCbFromMessage: no selected convo key');
  }

  return async (opts: WithMessageId) => {
    const msgModel = await Data.getMessageById(opts.messageId);
    if (!msgModel) {
      return;
    }
    const sender = msgModel.getSource();

    if (!sender) {
      return;
    }

    if (sender.startsWith(KeyPrefixType.blinded25)) {
      throw new Error(
        'useShowUserDetailsCbFromMessage: blinded25 convo click are disabled currently...'
      );
    }

    const resolvedNakedId = getCachedNakedKeyFromBlindedNoServerPubkey(sender);
    const foundRealSessionId = resolvedNakedId !== sender ? resolvedNakedId : undefined;

    if (foundRealSessionId && foundRealSessionId.startsWith(KeyPrefixType.standard)) {
      await ConvoHub.use().get(sender).setOriginConversationID(selectedConvoKey, true);
    }

    // open user details dialog for the user to do what he wants
    // Note: if we have the sessionId from a blindedId, we still open the blinded user details dialog (but it will have a different content)
    dispatch(
      updateUserProfileModal({
        conversationId: sender,
        realSessionId: foundRealSessionId ?? null,
      })
    );
  };
}

/**
 * Show the user details modal for a given conversation.
 * Note: this is only a valid action for private chats (blinded or not, friends or not)
 */
export function useShowUserDetailsCbFromConversation(conversationId?: string) {
  const dispatch = useDispatch();

  const isPrivate = useIsPrivate(conversationId);

  const isMe = useIsMe(conversationId);

  if (!conversationId || isMe) {
    return null;
  }

  if (conversationId.startsWith(KeyPrefixType.blinded25)) {
    throw new Error(
      'useShowUserDetailsCbFromConversation: blinded25 convo click are disabled currently...'
    );
  }

  return !isPrivate
    ? null
    : () => {
        const convo = ConvoHub.use().get(conversationId);
        if (!convo || convo.isPublic() || convo.isGroup()) {
          return;
        }

        const realSessionId = PubKey.isBlinded(conversationId)
          ? getCachedNakedKeyFromBlindedNoServerPubkey(conversationId)
          : undefined;
        dispatch(
          updateUserProfileModal({
            conversationId,
            realSessionId: realSessionId || null,
          })
        );
      };
}
