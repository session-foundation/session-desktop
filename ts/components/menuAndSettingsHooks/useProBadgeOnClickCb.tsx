import { useIsProAvailable } from '../../hooks/useIsProAvailable';
import { assertUnreachable } from '../../types/sqlSharedTypes';
import type { ContactNameContext } from '../conversation/ContactName/ContactNameContext';
import {
  SessionProInfoVariant,
  useShowSessionProInfoDialogCbWithVariant,
} from '../dialog/SessionProInfoModal';

type WithUserHasPro = { userHasPro: boolean };
type WithCurrentUserHasPro = { currentUserHasPro: boolean };

type WithIsMe = { isMe: boolean };
type WithContactNameContext = { contactNameContext: ContactNameContext };

export type ProBadgeContext =
  | { context: 'edit-profile-pic'; args: WithUserHasPro }
  | {
      context: 'conversation-title-dialog'; // the title in the conversation settings
      args: WithUserHasPro & WithCurrentUserHasPro & WithIsMe;
    }
  | { context: 'character-count'; args: WithCurrentUserHasPro }
  | { context: 'conversation-header-title'; args: WithUserHasPro & WithIsMe } // the title in the conversation header (i.e. title of the main screen of the app)
  | { context: 'contact-name'; args: WithUserHasPro & WithIsMe & WithContactNameContext };

type ShowTagWithCb = {
  show: true;
  cb: () => void;
};

type ShowTagNoCb = {
  show: true;
  cb: null;
};

type DoNotShowTag = {
  show: false;
  cb?: undefined;
};

const doNotShow: DoNotShowTag = { show: false };
const showNoCb: ShowTagNoCb = { show: true, cb: null };

const contactNameContextNoShow: Array<ContactNameContext> = [
  'react-list-modal',
  'message-search-result',
];

export function useProBadgeOnClickCb(
  opts: ProBadgeContext
): ShowTagWithCb | ShowTagNoCb | DoNotShowTag {
  const handleShowProInfoModal = useShowSessionProInfoDialogCbWithVariant();
  const isProAvailable = useIsProAvailable();

  const { context, args } = opts;

  if (!isProAvailable) {
    return doNotShow;
  }

  if (context === 'edit-profile-pic') {
    return {
      show: true,
      cb: () =>
        handleShowProInfoModal(
          args.userHasPro
            ? SessionProInfoVariant.ALREADY_PRO_PROFILE_PICTURE_ANIMATED
            : SessionProInfoVariant.PROFILE_PICTURE_ANIMATED
        ),
    };
  }

  if (context === 'conversation-header-title') {
    // in the conversation header or the list item, we want to show the badge
    // only if the user has pro and is not us
    if (args.userHasPro && !args.isMe) {
      return showNoCb;
    }
    return doNotShow;
  }

  if (context === 'conversation-title-dialog') {
    // if the user shown doesn't have pro, hide the badge
    if (!args.userHasPro) {
      return doNotShow;
    }
    // we never show the badge for ourselves in the title dialog
    if (args.isMe) {
      return doNotShow;
    }

    // the user shown has pro.
    if (args.currentUserHasPro) {
      // if we also have pro, clicking on the badge doesn't do anything
      return showNoCb;
    }
    // FOMO: user shown has pro but we don't: show CTA on click
    return { show: true, cb: () => handleShowProInfoModal(SessionProInfoVariant.GENERIC) };
  }

  if (context === 'character-count') {
    if (args.currentUserHasPro) {
      return doNotShow;
    }
    // FOMO
    return {
      show: true,
      cb: () => handleShowProInfoModal(SessionProInfoVariant.MESSAGE_CHARACTER_LIMIT),
    };
  }

  if (context === 'contact-name') {
    if (!args.userHasPro || args.isMe) {
      return doNotShow;
    }
    if (contactNameContextNoShow.includes(args.contactNameContext)) {
      return doNotShow;
    }
    return showNoCb;
  }

  assertUnreachable(context, 'useProBadgeOnClickCb: context not handled');

  return doNotShow;
}
