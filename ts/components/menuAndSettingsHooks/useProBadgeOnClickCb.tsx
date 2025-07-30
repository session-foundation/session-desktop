import { useIsProAvailable } from '../../hooks/useIsProAvailable';
import { assertUnreachable } from '../../types/sqlSharedTypes';
import {
  SessionProInfoVariant,
  useShowSessionProInfoDialogCbWithVariant,
} from '../dialog/SessionProInfoModal';

type WithUserHasPro = { userHasPro: boolean };
type WithCurrentUserHasPro = { currentUserHasPro: boolean };

export type ProBadgeContext =
  | { context: 'edit-profile-pic'; args: WithUserHasPro }
  | { context: 'conversation-title-dialog'; args: WithUserHasPro & WithCurrentUserHasPro }
  | { context: 'character-count'; args: WithCurrentUserHasPro };

/**
 * Returns null if, based on the context, the Pro badge should not be shown.
 * Otherwise, returns the onClick function to add to the Pro badge being shown
 */
export function useProBadgeOnClickCb(opts: ProBadgeContext): (() => void) | null {
  const handleShowProInfoModal = useShowSessionProInfoDialogCbWithVariant();
  const isProAvailable = useIsProAvailable();

  const { context, args } = opts;

  if (!isProAvailable) {
    return null;
  }

  if (context === 'edit-profile-pic') {
    return () =>
      handleShowProInfoModal(
        args.userHasPro
          ? SessionProInfoVariant.ALREADY_PRO_PROFILE_PICTURE_ANIMATED
          : SessionProInfoVariant.PROFILE_PICTURE_ANIMATED
      );
  }

  if (context === 'conversation-title-dialog') {
    // if the user shown doesn't have pro, hide the badge altogether
    if (!args.userHasPro) {
      return null;
    }

    // the user shown has pro.
    if (args.currentUserHasPro) {
      // if we also have pro, clicking on the badge doesn't do anything
      return () => {};
    }
    // FOMO: user shown has pro but we don't, show CTA on click
    return () => handleShowProInfoModal(SessionProInfoVariant.GENERIC);
  }

  if (context === 'character-count') {
    if (args.currentUserHasPro) {
      return null;
    }
    // FOMO
    return () => handleShowProInfoModal(SessionProInfoVariant.MESSAGE_CHARACTER_LIMIT);
  }

  assertUnreachable(context, 'useProBadgeOnClickCb: context not handled');

  return null;
}
