import { UserUtils } from '..';

function isUserProfileToStoreInWrapper(convoId: string) {
  try {
    return convoId === UserUtils.getOurPubKeyStrFromCache();
  } catch (e) {
    return false;
  }
}

export const SessionUtilUserProfile = {
  isUserProfileToStoreInWrapper,
};
