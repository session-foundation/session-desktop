import { isArrayBuffer } from 'lodash';
import { fromHexToArray } from '../../session/utils/String';
import { callUtilsWorker } from '../../webworker/workers/browser/util_worker_interface';
import { Data } from '../../data/data';
import { SettingsKey } from '../../data/settings-key';
import { getFeatureFlag } from '../../state/ducks/types/releasedFeaturesReduxTypes';

export const encryptAttachmentBufferRenderer = async (
  bufferIn: ArrayBuffer
): Promise<{ encryptedBufferWithHeader: Uint8Array } | null> => {
  if (!isArrayBuffer(bufferIn)) {
    throw new TypeError("'bufferIn' must be an array buffer");
  }
  if (getFeatureFlag('disableLocalAttachmentEncryption')) {
    return { encryptedBufferWithHeader: new Uint8Array(bufferIn) };
  }

  const key = (await Data.getItemById(SettingsKey.localAttachmentEncryptionKey))?.value as
    | string
    | undefined;
  if (!key) {
    throw new TypeError(
      "'encryptAttachmentBuffer' needs a key set in local_attachment_encrypted_key"
    );
  }
  const encryptingKey = fromHexToArray(key);
  return callUtilsWorker('encryptAttachmentBufferNode', encryptingKey, bufferIn);
};

export const decryptAttachmentBufferRenderer = async (
  bufferIn: ArrayBuffer
): Promise<Uint8Array> => {
  if (!isArrayBuffer(bufferIn)) {
    throw new TypeError("'bufferIn' must be an array buffer");
  }

  if (getFeatureFlag('disableLocalAttachmentEncryption')) {
    return new Uint8Array(bufferIn);
  }
  const key = (await Data.getItemById(SettingsKey.localAttachmentEncryptionKey))?.value as string;
  if (!key) {
    throw new TypeError(
      "'decryptAttachmentBuffer' needs a key set in local_attachment_encrypted_key"
    );
  }
  const encryptingKey = fromHexToArray(key);
  return callUtilsWorker('decryptAttachmentBufferNode', encryptingKey, bufferIn);
};
