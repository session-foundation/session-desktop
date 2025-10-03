import { ipcRenderer } from 'electron';
import { isArrayBuffer, isEmpty, isString, isUndefined, omit } from 'lodash';
import { ConversationAttributes } from '../models/conversationAttributes';
import { createDeleter, getAttachmentsPath } from '../shared/attachments/shared_attachments';
import {
  createAbsolutePathGetter,
  createReader,
  createWriterForNew,
} from '../util/attachment/attachments_files';
import {
  captureDimensionsAndScreenshot,
  deleteData,
  deleteDataSuccessful,
  loadData,
  replaceUnicodeV2,
} from './attachments/migrations';

// NOTE I think this is only used on the renderer side, but how?!
export const deleteExternalMessageFiles = async ({
  attachments,
  preview,
}: Readonly<{
  attachments?: Array<any> | undefined;
  preview?: Array<any> | undefined;
}>) => {
  let anyChanges = false;

  if (attachments && attachments.length) {
    await Promise.all(attachments.map(deleteData));
    anyChanges = true;

    // test that the files were deleted successfully
    try {
      let results = await Promise.allSettled(attachments.map(deleteDataSuccessful));
      results = results.filter(result => result.status === 'rejected');

      if (results.length) {
        throw new Error('deleteDataSuccessful: failed to delete anything');
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[deleteExternalMessageFiles]: Failed to delete attachments for', {
        attachments,
        preview,
      });
    }
  }

  if (preview && preview.length) {
    await Promise.all(
      preview.map(async (_item: { image: any }) => {
        const item = _item;
        const { image } = item;

        if (image && image.path) {
          await deleteOnDisk(image.path);
        }

        item.image = undefined;
        anyChanges = true;

        return image;
      })
    );
  }
  return anyChanges;
};

let attachmentsPath: string | undefined;

let internalReadAttachmentData: ((relativePath: string) => Promise<ArrayBufferLike>) | undefined;
let internalGetAbsoluteAttachmentPath: ((relativePath: string) => string) | undefined;
let internalDeleteOnDisk: ((relativePath: string) => Promise<void>) | undefined;
let internalWriteNewAttachmentData: ((arrayBuffer: ArrayBuffer) => Promise<string>) | undefined;

// userDataPath must be app.getPath('userData');
export async function initializeAttachmentLogic() {
  const userDataPath = ipcRenderer.sendSync('get-user-data-path');

  if (attachmentsPath) {
    throw new Error('attachmentsPath already initialized');
  }

  if (!userDataPath || userDataPath.length <= 10) {
    throw new Error('userDataPath cannot have length <= 10');
  }
  attachmentsPath = getAttachmentsPath(userDataPath);
  internalReadAttachmentData = createReader(attachmentsPath);
  internalGetAbsoluteAttachmentPath = createAbsolutePathGetter(attachmentsPath);
  internalDeleteOnDisk = createDeleter(attachmentsPath);
  internalWriteNewAttachmentData = createWriterForNew(attachmentsPath);
}

export const getAttachmentPath = () => {
  if (!attachmentsPath) {
    throw new Error('attachmentsPath not init');
  }
  return attachmentsPath;
};

export const loadAttachmentData = loadData;

export const loadPreviewData = async (preview: any): Promise<Array<any>> => {
  if (!preview || !preview.length || isEmpty(preview[0])) {
    return [];
  }

  const firstPreview = preview[0];
  if (!firstPreview.image) {
    return [firstPreview];
  }

  return [
    {
      ...firstPreview,
      image: await loadAttachmentData(firstPreview.image),
    },
  ];
};

/**
 * Any `data: ArrayBuffer` provided here must first have been oriented to the
 * right orientation using one of the ImageProcessor functions.
 */
export const processNewAttachment = async (attachment: {
  fileName?: string;
  contentType: string;
  data: ArrayBuffer;
  digest?: string;
  path?: string;
  isRaw?: boolean;
}) => {
  const fileName = attachment.fileName ? replaceUnicodeV2(attachment.fileName) : '';

  const onDiskAttachmentPath = await migrateDataToFileSystem(attachment.data);
  const attachmentWithoutData = omit({ ...attachment, fileName, path: onDiskAttachmentPath }, [
    'data',
  ]);

  const finalAttachment = await captureDimensionsAndScreenshot({
    contentType: attachment.contentType,
    data: attachment.data,
  });

  return {
    ...attachmentWithoutData,
    ...finalAttachment,
    fileName,
    size: attachment.data.byteLength,
  };
};

export const readAttachmentData = async (relativePath: string): Promise<ArrayBufferLike> => {
  if (!internalReadAttachmentData) {
    throw new Error('attachment logic not initialized');
  }
  return internalReadAttachmentData(relativePath);
};

export const getAbsoluteAttachmentPath = (relativePath?: string): string => {
  if (!internalGetAbsoluteAttachmentPath) {
    throw new Error('attachment logic not initialized');
  }
  return internalGetAbsoluteAttachmentPath(relativePath || '');
};

export const deleteOnDisk = async (relativePath: string): Promise<void> => {
  if (!internalDeleteOnDisk) {
    throw new Error('attachment logic not initialized');
  }
  return internalDeleteOnDisk(relativePath);
};

export const writeNewAttachmentData = async (arrayBuffer: ArrayBuffer): Promise<string> => {
  if (!internalWriteNewAttachmentData) {
    throw new Error('attachment logic not initialized');
  }
  return internalWriteNewAttachmentData(arrayBuffer);
};

const migrateDataToFileSystem = async (data?: ArrayBuffer) => {
  const hasDataField = !isUndefined(data);

  if (!hasDataField) {
    throw new Error('attachment has no data in migrateDataToFileSystem');
  }

  const isValidData = isArrayBuffer(data);
  if (!isValidData) {
    throw new TypeError(`Expected ${data} to be an array buffer got: ${typeof data}`);
  }

  const path = await writeNewAttachmentData(data);

  return path;
};

export async function deleteExternalFilesOfConversation(
  conversationAttributes: Readonly<
    Pick<ConversationAttributes, 'avatarInProfile' | 'fallbackAvatarInProfile'>
  >
) {
  if (!conversationAttributes) {
    return;
  }

  const { avatarInProfile, fallbackAvatarInProfile } = conversationAttributes;

  const filesToDelete = [];

  if (isString(avatarInProfile) && avatarInProfile.length) {
    filesToDelete.push(avatarInProfile);
  }
  if (isString(fallbackAvatarInProfile) && fallbackAvatarInProfile.length) {
    filesToDelete.push(fallbackAvatarInProfile);
  }

  if (filesToDelete.length) {
    await Promise.all(filesToDelete.map(deleteOnDisk));
  }
}
