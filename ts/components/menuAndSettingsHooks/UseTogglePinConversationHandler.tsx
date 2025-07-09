import { useSelector } from 'react-redux';
import { useIsProAvailable } from '../../hooks/useIsProAvailable';
import { useHasPro } from '../../hooks/useHasPro';
import { ConvoHub } from '../../session/conversations';
import { useIsPinned } from '../../hooks/useParamSelector';
import {
  SessionProInfoVariant,
  useShowSessionProInfoDialogCbWithVariant,
} from '../dialog/SessionProInfoModal';
import { Constants } from '../../session';
import { getPinnedConversationsCount } from '../../state/selectors/conversations';

export function useTogglePinConversationHandler(id: string) {
  const conversation = ConvoHub.use().get(id);
  const isPinned = useIsPinned(id);

  const pinnedConversationsCount = useSelector(getPinnedConversationsCount);
  const isProAvailable = useIsProAvailable();
  const hasPro = useHasPro();

  const handleShowProDialog = useShowSessionProInfoDialogCbWithVariant();

  if (
    isPinned ||
    !isProAvailable ||
    hasPro ||
    pinnedConversationsCount < Constants.CONVERSATION.MAX_PINNED_CONVERSATIONS_STANDARD
  ) {
    return () => conversation.togglePinned();
  }

  return () =>
    handleShowProDialog(
      pinnedConversationsCount > Constants.CONVERSATION.MAX_PINNED_CONVERSATIONS_STANDARD
        ? SessionProInfoVariant.PINNED_CONVERSATION_LIMIT_GRANDFATHERED
        : SessionProInfoVariant.PINNED_CONVERSATION_LIMIT
    );
}
