import { useMemo } from 'react';
import { useCurrentUserHasExpiredPro } from '../../hooks/useHasPro';
import { StyledCTATitle } from './SessionCTA';
import { Localizer } from '../basic/Localizer';
import { assertUnreachable } from '../../types/sqlSharedTypes';
import { ProIconButton } from '../buttons/ProButton';
import { CTAVariant, isProCTAFeatureVariant, type ProCTAVariant } from './cta/types';

export function ProCTATitle({ variant }: { variant: ProCTAVariant }) {
  const userHasExpiredPro = useCurrentUserHasExpiredPro();

  const titleText = useMemo(() => {
    if (isProCTAFeatureVariant(variant)) {
      return <Localizer token={userHasExpiredPro ? 'renew' : 'upgradeTo'} />;
    }

    switch (variant) {
      // TODO: Group CTA titles arent finalised and need to be implemneted later
      case CTAVariant.PRO_GROUP_NON_ADMIN:
        return <Localizer token="upgradeTo" />;

      case CTAVariant.PRO_GROUP_ADMIN:
        return <Localizer token={userHasExpiredPro ? 'renew' : 'upgradeTo'} />;

      case CTAVariant.PRO_ANIMATED_DISPLAY_PICTURE_ACTIVATED:
        return <Localizer token="proActivated" />;

      case CTAVariant.PRO_GROUP_ACTIVATED:
        return <Localizer token="proGroupActivated" />;

      case CTAVariant.PRO_EXPIRING_SOON:
        return <Localizer token="proExpiringSoon" />;

      case CTAVariant.PRO_EXPIRED:
        return <Localizer token="proExpired" />;

      default:
        assertUnreachable(variant, 'CtaTitle');
        throw new Error('unreachable');
    }
  }, [variant, userHasExpiredPro]);

  const isTitleDirectionReversed = useMemo(() => {
    return [
      CTAVariant.PRO_ANIMATED_DISPLAY_PICTURE_ACTIVATED,
      CTAVariant.PRO_GROUP_ACTIVATED,
      CTAVariant.PRO_EXPIRING_SOON,
      CTAVariant.PRO_EXPIRED,
    ].includes(variant);
  }, [variant]);

  return (
    <StyledCTATitle reverseDirection={isTitleDirectionReversed}>
      {titleText}
      <ProIconButton
        iconSize={'huge'}
        dataTestId="invalid-data-testid"
        onClick={undefined}
        noColors={variant === CTAVariant.PRO_EXPIRED}
      />
    </StyledCTATitle>
  );
}
