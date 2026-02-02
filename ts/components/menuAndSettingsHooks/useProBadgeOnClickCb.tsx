import { getAppDispatch } from '../../state/dispatch';
import { getIsProAvailableMemo } from '../../hooks/useIsProAvailable';
import { ProMessageFeature } from '../../models/proMessageFeature';
import { SessionCTAState, updateSessionCTA } from '../../state/ducks/modalDialog';
import { assertUnreachable } from '../../types/sqlSharedTypes';
import type { ContactNameContext } from '../conversation/ContactName/ContactNameContext';
import { useShowSessionCTACbWithVariant } from '../dialog/SessionCTA';
import { CTAVariant } from '../dialog/cta/types';

type WithUserHasPro = { userHasPro: boolean };
type WithMessageSentWithProFeat = { messageSentWithProFeat: Array<ProMessageFeature> | null };
type WithCurrentUserHasPro = { currentUserHasPro: boolean };
type WithCurrentUserHasExpiredPro = { currentUserHasExpiredPro: boolean };

type WithIsMe = { isMe: boolean };
type WithContactNameContext = { contactNameContext: ContactNameContext };
type WithIsGroupV2 = { isGroupV2: boolean };
type WithIsBlinded = { isBlinded: boolean };
type WithProvidedCb = { providedCb: (() => void) | null };
type WithProCTA = { cta: SessionCTAState };

type ProBadgeContext =
  | { context: 'edit-profile-pic'; args: WithProCTA }
  | {
      context: 'show-our-profile-dialog';
      args: WithCurrentUserHasPro & WithCurrentUserHasExpiredPro & WithProvidedCb;
    }
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
        WithIsBlinded;
    };

/**
 * The type returned if the badge should be shown and linked to the provided callback.
 */
type ShowTagWithCb = {
  show: true;
  cb: () => void;
};

/**
 * The type returned if the badge should be shown it should not be clickable.
 */
type ShowTagNoCb = {
  show: true;
  cb: null;
};

/**
 * The type returned if the badge should not be shown.
 */
type DoNotShowTag = {
  show: false;
  cb?: undefined;
};

/**
 * The object returned if the badge should not be shown.
 */
const doNotShow: DoNotShowTag = { show: false };

/** The object returned if the badge should not be shown at all. */
const showNoCb: ShowTagNoCb = { show: true, cb: null };

/**
 * Returns true if the contact name context is one of the ones we do not want to show the badge for.
 */
function isContactNameNoShowContext(context: ContactNameContext) {
  switch (context) {
    case 'react-list-modal':
    case 'message-search-result-from': // no pro badge when showing the sender of a message in the search results
    case 'member-list-item-mention-row': // we don't want the pro badge when mentioning someone (from the composition box)
      return true;
    case 'contact-list-row':
    case 'message-search-result-conversation': // show the pro badge when showing the conversation name in the search results
    case 'quoted-message-composition':
    case 'message-info-author':
    case 'member-list-item':
    case 'quote-author':
    case 'message-author':
    case 'conversation-list-item':
    case 'conversation-list-item-search':
      return false;
    default:
      assertUnreachable(context, 'isContactNameNoShowContext: context not handled');
      throw new Error('isContactNameNoShowContext: context not handled');
  }
}

function proFeatureToVariant(proFeature: ProMessageFeature): CTAVariant {
  switch (proFeature) {
    case ProMessageFeature.PRO_INCREASED_MESSAGE_LENGTH:
      return CTAVariant.PRO_MESSAGE_CHARACTER_LIMIT;
    case ProMessageFeature.PRO_ANIMATED_DISPLAY_PICTURE:
      return CTAVariant.PRO_ANIMATED_DISPLAY_PICTURE;
    case ProMessageFeature.PRO_BADGE:
      return CTAVariant.PRO_GENERIC;
    default:
      assertUnreachable(proFeature, 'ProFeatureToVariant: unknown case');
      throw new Error('unreachable');
  }
}

/**
 * This function is used to know if, depending on the context, we should show the pro badge or not.
 * If yes, it can optionally return a callback that should be linked to the Pro badge `onClick()`.
 *
 * Depending on the context provided, different arguments are needed.
 *
 */
export function useProBadgeOnClickCb(
  opts: ProBadgeContext
): ShowTagWithCb | ShowTagNoCb | DoNotShowTag {
  const dispatch = getAppDispatch();
  const handleShowProInfoModal = useShowSessionCTACbWithVariant();
  const isProAvailable = getIsProAvailableMemo();

  if (!isProAvailable) {
    // if pro is globally disabled, we never show the badge.
    return doNotShow;
  }

  const { context, args } = opts;

  if (context === 'edit-profile-pic') {
    return {
      show: true,
      cb: () => dispatch(updateSessionCTA(args.cta)),
    };
  }

  if (context === 'show-our-profile-dialog') {
    if (args.currentUserHasPro || args.currentUserHasExpiredPro) {
      // if the current user already has or had pro, we want to show the badge, but use a custom callback
      // i.e. it won't open the CTA but allow to edit our name
      return { show: true, cb: args.providedCb };
    }
    return doNotShow;
  }

  if (context === 'message-info-sent-with-pro') {
    // if no pro features were used for this message, we do not show the pro badge here,
    // even if the user that sent it has pro
    if (!args.messageSentWithProFeat || !args.messageSentWithProFeat?.length) {
      return doNotShow;
    }
    const { messageSentWithProFeat } = args;
    const multiProFeatUsed = messageSentWithProFeat.length > 1;

    // If a pro feature was used for this message, we show the badge but the callback is quite custom:
    // - if we do have pro too, it is not clickable.
    // - else:
    //   - if a single pro feature was used with this message: open the CTA corresponding to that one
    //   - if multiple pro features were used with this message: open the GENERIC CTA
    return args.currentUserHasPro
      ? showNoCb
      : {
          show: true,
          cb: () => {
            handleShowProInfoModal(
              multiProFeatUsed
                ? CTAVariant.PRO_GENERIC
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

    // from here, the user shown has pro.
    if (args.isGroupV2) {
      // if this is a groupv2, the badge should open the "groupv2 activated" modal onclick
      return {
        show: true,
        cb: () => handleShowProInfoModal(CTAVariant.PRO_GROUP_ACTIVATED),
      };
    }

    if (args.currentUserHasPro) {
      // if we also have pro and this is a private conversation, clicking on the badge doesn't do anything
      return showNoCb;
    }
    // FOMO: user shown has pro but we don't: show CTA on click
    return { show: true, cb: () => handleShowProInfoModal(CTAVariant.PRO_GENERIC) };
  }

  if (context === 'character-count') {
    // if we already have pro, there is no point showing the `Upgrade to do more with Pro`
    if (args.currentUserHasPro) {
      return doNotShow;
    }
    // FOMO
    return {
      show: true,
      cb: () => handleShowProInfoModal(CTAVariant.PRO_MESSAGE_CHARACTER_LIMIT),
    };
  }

  // ContactName is a component used across the app to render a contact name based on the context.
  // The pro badge is also shown or not depending on that same context, and this is what we do here
  if (context === 'contact-name') {
    if (!args.userHasPro) {
      return doNotShow;
    }
    if (args.isMe) {
      if (
        args.contactNameContext === 'quoted-message-composition' ||
        args.contactNameContext === 'quote-author'
      ) {
        // in the quote composition screen and when quoting ourselves, the badge should be shown when we have pro
        return showNoCb;
      }
      return doNotShow;
    }
    if (isContactNameNoShowContext(args.contactNameContext)) {
      // in some context, we do not want to show the pro badge even if the user has pro.
      return doNotShow;
    }

    if (args.contactNameContext === 'message-info-author') {
      // in the message info screen, the badge should be shown if the corresponding user has pro and
      // - not be clickable if we also have pro
      // - be clickable if we do not have pro and open the generic CTA
      if (args.currentUserHasPro) {
        return showNoCb;
      }

      return { show: true, cb: () => handleShowProInfoModal(CTAVariant.PRO_GENERIC) };
    }
    return showNoCb;
  }

  assertUnreachable(context, 'useProBadgeOnClickCb: context not handled');
  return doNotShow;
}
