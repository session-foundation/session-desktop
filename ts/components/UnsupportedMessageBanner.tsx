import { useSyncExternalStore } from 'react';
import { NoticeBanner } from './NoticeBanner';
import {
  dismissUnsupportedBanner,
  getUnsupportedBannerState,
  subscribeToUnsupportedBanner,
  UNSUPPORTED_BANNER_TEXT,
} from '../session/unsupported_messages/banner';
import { NetworkTime } from '../util/NetworkTime';

export const UnsupportedMessageBanner = () => {
  const state = useSyncExternalStore(subscribeToUnsupportedBanner, getUnsupportedBannerState);

  if (state === 'hidden') {
    return null;
  }

  return (
    <NoticeBanner
      text={UNSUPPORTED_BANNER_TEXT[state]}
      dataTestId="unsupported-message-banner"
      dismissDataTestId="unsupported-message-banner-dismiss"
      onDismiss={() => {
        void dismissUnsupportedBanner(NetworkTime.now());
      }}
    />
  );
};
