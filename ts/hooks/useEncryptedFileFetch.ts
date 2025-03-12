import { useCallback, useEffect, useState } from 'react';

import { DecryptedAttachmentsManager } from '../session/crypto/DecryptedAttachmentsManager';

export const useEncryptedFileFetch = (
  /** undefined if the message is not visible yet, url is '' if something is broken */
  url: string | undefined,
  contentType: string,
  isAvatar: boolean
) => {
  /** undefined if the attachment is not decrypted yet, '' if the attachment fails to decrypt */
  const [urlToLoad, setUrlToLoad] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const alreadyDecrypted = url ? DecryptedAttachmentsManager.getAlreadyDecryptedMediaUrl(url) : '';

  const fetchUrl = useCallback(
    async (mediaUrl: string | undefined) => {
      if (alreadyDecrypted || !mediaUrl) {
        setUrlToLoad(alreadyDecrypted || '');
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const decryptedUrl = await DecryptedAttachmentsManager.getDecryptedMediaUrl(
          mediaUrl,
          contentType,
          isAvatar
        );
        setUrlToLoad(decryptedUrl);
      } catch (error) {
        setUrlToLoad('');
      } finally {
        setLoading(false);
      }
    },
    [alreadyDecrypted, contentType, isAvatar]
  );

  useEffect(() => {
    void fetchUrl(url);
  }, [fetchUrl, url]);

  return { urlToLoad, loading };
};
