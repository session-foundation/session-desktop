import { useSyncExternalStore } from 'react';
import { NoticeBanner } from './NoticeBanner';
import {
  dismissUnsupportedBanner,
  getUnsupportedBannerState,
  subscribeToUnsupportedBanner,
} from '../session/unsupported_messages/banner';
import { tr } from '../localization';
import { NetworkTime } from '../util/NetworkTime';

export const UnsupportedMessageBanner = () => {
  const state = useSyncExternalStore(subscribeToUnsupportedBanner, getUnsupportedBannerState);

  if (state === 'hidden') {
    return null;
  }

  return (
    <NoticeBanner
      text={tr(
        state === 'otherDevice'
          ? 'messageUnsupportedBannerLinkedDevice'
          : 'messageUnsupportedBanner'
      )}
      dataTestId="unsupported-message-banner"
      dismissDataTestId="unsupported-message-banner-dismiss"
      onDismiss={() => {
        void dismissUnsupportedBanner(NetworkTime.now());
      }}
    />
  );
};
