import useInterval from 'react-use/lib/useInterval';
import { useDispatch, useSelector } from 'react-redux';
import { DURATION } from '../session/constants';
import { updateLegacyGroupDeprecationTimestampUpdatedAt } from '../state/ducks/releasedFeatures';
import { NetworkTime } from '../util/NetworkTime';
import { PubKey } from '../session/types';
import { areLegacyGroupsReadOnly } from '../state/selectors/releasedFeatures';
import { useSelectedConversationKey } from '../state/selectors/selectedConversation';
import type { StateType } from '../state/reducer';
import { ConversationTypeEnum } from '../models/types';

export function useRefreshReleasedFeaturesTimestamp() {
  const dispatch = useDispatch();

  useInterval(() => {
    const nowFromNetwork = NetworkTime.now();
    dispatch(updateLegacyGroupDeprecationTimestampUpdatedAt(nowFromNetwork));
  }, 1 * DURATION.SECONDS);
}

export function getDisableLegacyGroupDeprecatedActions(state: StateType, convoId?: string) {
  if (!convoId || !PubKey.is05Pubkey(convoId)) {
    return false;
  }
  const selectedConvoIsGroup =
    state.conversations.conversationLookup[convoId]?.type === ConversationTypeEnum.GROUP;
  if (!selectedConvoIsGroup) {
    return false;
  }
  const legacyGroupDeprecated = areLegacyGroupsReadOnly();
  // here we have
  // - a valid convoId
  // - that starts with 05
  // - that is a group (i.e. a legacy group)
  // - and legacy group deprecation date has been hit
  return legacyGroupDeprecated;
}

export function useDisableLegacyGroupDeprecatedActions(convoId?: string) {
  return useSelector((state: StateType) => getDisableLegacyGroupDeprecatedActions(state, convoId));
}

export function useSelectedDisableLegacyGroupDeprecatedActions() {
  const convoId = useSelectedConversationKey();
  return useDisableLegacyGroupDeprecatedActions(convoId);
}
