import type { ConfirmPush, MergeSingle } from 'libsession_util_nodejs';
import type { ConfigWrapperUser } from '../libsession_worker_functions';
import { UserGenericWrapperActions } from '../libsession_worker_interface';

export function createUserBaseActionsFor(
  wrapperType: ConfigWrapperUser,
  modifiedCb: (() => Promise<void>) | null
) {
  return {
    /* Reuse the UserConfigWrapperActions with the UserConfig argument */
    init: async (ed25519Key: Uint8Array, dump: Uint8Array | null) => {
      await UserGenericWrapperActions.init(wrapperType, ed25519Key, dump);
      await modifiedCb?.();
    },
    free: async () => UserGenericWrapperActions.free(wrapperType),
    confirmPushed: async (pushed: ConfirmPush) =>
      UserGenericWrapperActions.confirmPushed(wrapperType, pushed),
    dump: async () => UserGenericWrapperActions.dump(wrapperType),
    makeDump: async () => UserGenericWrapperActions.makeDump(wrapperType),
    needsDump: async () => UserGenericWrapperActions.needsDump(wrapperType),
    needsPush: async () => UserGenericWrapperActions.needsPush(wrapperType),
    push: async () => UserGenericWrapperActions.push(wrapperType),
    activeHashes: async () => UserGenericWrapperActions.activeHashes(wrapperType),
    merge: async (toMerge: Array<MergeSingle>) => {
      const merged = await UserGenericWrapperActions.merge(wrapperType, toMerge);
      await modifiedCb?.();

      return merged;
    },
    storageNamespace: async () => UserGenericWrapperActions.storageNamespace(wrapperType),
  };
}
