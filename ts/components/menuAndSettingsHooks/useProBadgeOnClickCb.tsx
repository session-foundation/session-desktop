import { useIsProAvailable } from '../../hooks/useIsProAvailable';
import { assertUnreachable } from '../../types/sqlSharedTypes';
import type { ContactNameContext } from '../conversation/ContactName/ContactNameContext';
import {
  SessionProInfoVariant,
  useShowSessionProInfoDialogCbWithVariant,
} from '../dialog/SessionProInfoModal';

type WithUserHasPro = { userHasPro: boolean };
type WithMessageSentWithProFeat = { messageSentWithProFeat: Array<ProFeatures> | null };
type WithCurrentUserHasPro = { currentUserHasPro: boolean };

type WithIsMe = { isMe: boolean };
type WithContactNameContext = { contactNameContext: ContactNameContext };
type WithIsGroupV2 = { isGroupV2: boolean };
type WithIsBlinded = { isBlinded: boolean };
type WithShowConversationSettingsCb = { showConversationSettingsCb: (() => void) | null };

export type ProBadgeContext =
  | { context: 'edit-profile-pic'; args: WithUserHasPro }
  | { context: 'show-our-profile-dialog'; args: WithCurrentUserHasPro }
  | {
      context: 'conversation-title-dialog'; // the title in the conversation settings ConversationSettingsHeader/UserProfileDialog
      args: WithUserHasPro & WithCurrentUserHasPro & WithIsMe & WithIsGroupV2;
    }
  | { context: 'character-count'; args: WithCurrentUserHasPro }
  | { context: 'conversation-header-title'; args: WithUserHasPro & WithIsMe } // the title in the conversation header (i.e. title of the main screen of the app)
  | {
      context: 'message-info-sent-with-pro';
      args: WithCurrentUserHasPro & WithMessageSentWithProFeat;
    }
  | {
      context: 'contact-name';
      args: WithUserHasPro &
        WithIsMe &
        WithCurrentUserHasPro &
        WithContactNameContext &
        WithIsBlinded &
        WithShowConversationSettingsCb;
    };

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

export enum ProFeatures {
  PRO_BADGE = 'pro-badge',
  PRO_INCREASED_MESSAGE_LENGTH = 'pro-increased-message-length',
  PRO_ANIMATED_DISPLAY_PICTURE = 'pro-animated-display-picture',
}

function proFeatureToVariant(proFeature: ProFeatures): SessionProInfoVariant {
  switch (proFeature) {
    case ProFeatures.PRO_INCREASED_MESSAGE_LENGTH:
      return SessionProInfoVariant.MESSAGE_CHARACTER_LIMIT;
    case ProFeatures.PRO_BADGE:
    case ProFeatures.PRO_ANIMATED_DISPLAY_PICTURE:
      return SessionProInfoVariant.GENERIC;
    default:
      assertUnreachable(proFeature, 'ProFeatureToVariant: unknown case');
      throw new Error('unreachable');
  }
}

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
  if (context === 'show-our-profile-dialog') {
    return args.currentUserHasPro ? showNoCb : doNotShow;
  }

  if (context === 'message-info-sent-with-pro') {
    // if no pro features were used for this message, we do not show the pro badge here,
    // even if the user that sent it has pro
    if (!args.messageSentWithProFeat || !args.messageSentWithProFeat?.length) {
      return doNotShow;
    }
    const { messageSentWithProFeat } = args;
    const multiProFeatUsed = messageSentWithProFeat.length > 1;

    // if a pro feature was used for this message, we show the badge but it only opens a CTA
    // when we do not have pro ourself
    return args.currentUserHasPro
      ? showNoCb
      : {
          show: true,
          cb: () => {
            handleShowProInfoModal(
              multiProFeatUsed
                ? SessionProInfoVariant.GENERIC
                : proFeatureToVariant(messageSentWithProFeat[0])
            );
          },
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

    // starting here, the user shown has pro.
    if (args.isGroupV2) {
      // if this is a groupv2, the badge should open the "groupv2 activated" modal onclick
      return {
        show: true,
        cb: () => handleShowProInfoModal(SessionProInfoVariant.GROUP_ACTIVATED),
      };
    }

    // here, the user shown has pro.
    if (args.currentUserHasPro) {
      // if we also have pro and this is a private conversation, clicking on the badge doesn't do anything
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

    if (args.contactNameContext === 'message-info-author') {
      if (args.currentUserHasPro) {
        return showNoCb;
      }
      if (args.isBlinded) {
        // we want to show the conversation modal here, not the pro dialog
        return { show: true, cb: args.showConversationSettingsCb };
      }
      return { show: true, cb: () => handleShowProInfoModal(SessionProInfoVariant.GENERIC) };
    }
    return showNoCb;
  }

  assertUnreachable(context, 'useProBadgeOnClickCb: context not handled');

  return doNotShow;
}
