import { ReactNode, useMemo } from 'react';
import { useCurrentUserHasExpiredPro, useProAccessDetails } from '../../hooks/useHasPro';
import { Localizer } from '../basic/Localizer';
import { CTADescriptionListItem, StyledCTADescriptionList } from './CTADescriptionList';
import { StyledScrollDescriptionContainer } from './SessionCTA';
import { tr } from '../../localization/localeTools';
import { CONVERSATION } from '../../session/constants';
import { formatNumber } from '../../util/i18n/formatting/generics';
import { assertUnreachable } from '../../types/sqlSharedTypes';
import { ProIconButton } from '../buttons/ProButton';
import { CTAVariant, type ProCTAVariant } from './cta/types';

const variantsWithoutFeatureList = [
  CTAVariant.PRO_GROUP_NON_ADMIN,
  CTAVariant.PRO_GROUP_ACTIVATED,
  CTAVariant.PRO_ANIMATED_DISPLAY_PICTURE_ACTIVATED,
] as const;

type VariantWithoutFeatureList = (typeof variantsWithoutFeatureList)[number];
type VariantWithFeatureList = Exclude<ProCTAVariant, VariantWithoutFeatureList>;

function isProFeatureListCTA(variant: CTAVariant): variant is VariantWithFeatureList {
  return !variantsWithoutFeatureList.includes(variant as any);
}

enum ProFeatureKey {
  LONGER_MESSAGES = 'proFeatureListLongerMessages',
  MORE_PINNED_CONVOS = 'proFeatureListPinnedConversations',
  ANIMATED_DP = 'proFeatureListAnimatedDisplayPicture',
  LARGER_GROUPS = 'proFeatureListLargerGroups',
}

function getBaseFeatureList(variant: VariantWithFeatureList) {
  switch (variant) {
    case CTAVariant.PRO_MESSAGE_CHARACTER_LIMIT:
      return [ProFeatureKey.LONGER_MESSAGES, ProFeatureKey.MORE_PINNED_CONVOS];

    case CTAVariant.PRO_ANIMATED_DISPLAY_PICTURE:
      return [ProFeatureKey.ANIMATED_DP, ProFeatureKey.LONGER_MESSAGES];

    case CTAVariant.PRO_PINNED_CONVERSATION_LIMIT:
    case CTAVariant.PRO_PINNED_CONVERSATION_LIMIT_GRANDFATHERED:
      return [ProFeatureKey.MORE_PINNED_CONVOS, ProFeatureKey.LONGER_MESSAGES];

    case CTAVariant.PRO_GENERIC: // yes generic has the same as above, reversed...
      return [ProFeatureKey.LONGER_MESSAGES, ProFeatureKey.MORE_PINNED_CONVOS];

    case CTAVariant.PRO_EXPIRING_SOON:
    case CTAVariant.PRO_EXPIRED:
      return [
        ProFeatureKey.LONGER_MESSAGES,
        ProFeatureKey.MORE_PINNED_CONVOS,
        ProFeatureKey.ANIMATED_DP,
      ];

    case CTAVariant.PRO_GROUP_ADMIN:
      return [ProFeatureKey.LARGER_GROUPS, ProFeatureKey.LONGER_MESSAGES];

    default:
      assertUnreachable(variant, 'getFeatureList unreachable case');
      throw new Error('unreachable');
  }
}

function FeatureList({ variant }: { variant: CTAVariant }) {
  const featureList = useMemo(() => {
    if (!isProFeatureListCTA(variant)) {
      return [];
    }

    const features = getBaseFeatureList(variant).map((token, i) => (
      <CTADescriptionListItem key={token} index={i}>
        {tr(token)}
      </CTADescriptionListItem>
    ));

    // Expiry related CTAs dont show the "more" feature item
    if (variant !== CTAVariant.PRO_EXPIRED && variant !== CTAVariant.PRO_EXPIRING_SOON) {
      features.push(
        <CTADescriptionListItem
          key={'proFeatureListLoadsMore'}
          index={features.length}
          customIconSrc={'images/sparkle-animated.svg'}
        >
          {tr('proFeatureListLoadsMore')}
        </CTADescriptionListItem>
      );
    }
    return features;
  }, [variant]);

  return featureList.length ? (
    <StyledCTADescriptionList>{featureList}</StyledCTADescriptionList>
  ) : null;
}

function ProExpiringSoonDescription() {
  const { data } = useProAccessDetails();
  return <Localizer token="proExpiringSoonDescription" time={data.expiryTimeRelativeString} />;
}

function getDescription(variant: ProCTAVariant, userHasProExpired: boolean): ReactNode {
  switch (variant) {
    case CTAVariant.PRO_PINNED_CONVERSATION_LIMIT:
      return (
        <Localizer
          token={
            userHasProExpired
              ? 'proRenewPinFiveConversations'
              : 'proCallToActionPinnedConversationsMoreThan'
          }
          limit={formatNumber(CONVERSATION.MAX_PINNED_CONVERSATIONS_STANDARD)}
        />
      );

    case CTAVariant.PRO_PINNED_CONVERSATION_LIMIT_GRANDFATHERED:
      return (
        <Localizer
          token={
            userHasProExpired
              ? 'proRenewPinMoreConversations'
              : 'proCallToActionPinnedConversations'
          }
        />
      );

    case CTAVariant.PRO_ANIMATED_DISPLAY_PICTURE:
      return (
        <Localizer
          token={
            userHasProExpired
              ? 'proRenewAnimatedDisplayPicture'
              : 'proAnimatedDisplayPictureCallToActionDescription'
          }
        />
      );

    case CTAVariant.PRO_ANIMATED_DISPLAY_PICTURE_ACTIVATED:
      return (
        <>
          <span>
            <Localizer token="proAlreadyPurchased" />{' '}
            <ProIconButton
              iconSize={'small'}
              dataTestId="invalid-data-testid"
              onClick={undefined}
            />
          </span>
          <br />
          <Localizer token="proAnimatedDisplayPicture" />
        </>
      );

    case CTAVariant.PRO_MESSAGE_CHARACTER_LIMIT:
      return (
        <Localizer
          token={userHasProExpired ? 'proRenewLongerMessages' : 'proCallToActionLongerMessages'}
        />
      );

    case CTAVariant.PRO_GENERIC:
      return (
        <Localizer
          token={userHasProExpired ? 'proRenewMaxPotential' : 'proUserProfileModalCallToAction'}
        />
      );

    case CTAVariant.PRO_EXPIRING_SOON:
      return <ProExpiringSoonDescription />;

    case CTAVariant.PRO_EXPIRED:
      return <Localizer token="proExpiredDescription" />;

    // TODO: Group CTA string dont all exist yet and need to be implemented later
    case CTAVariant.PRO_GROUP_ADMIN:
    case CTAVariant.PRO_GROUP_NON_ADMIN:
    case CTAVariant.PRO_GROUP_ACTIVATED:
      return (
        <span>
          <Localizer token="proGroupActivatedDescription" />{' '}
          <ProIconButton iconSize={'small'} dataTestId="invalid-data-testid" onClick={undefined} />
        </span>
      );

    default:
      assertUnreachable(variant, 'getDescription unreachable case');
      throw new Error('unreachable');
  }
}

export function ProCTADescription({ variant }: { variant: ProCTAVariant }) {
  const userHasExpiredPro = useCurrentUserHasExpiredPro();
  return (
    <>
      <StyledScrollDescriptionContainer data-testid="cta-body">
        {getDescription(variant, userHasExpiredPro)}
      </StyledScrollDescriptionContainer>
      <FeatureList variant={variant} />
    </>
  );
}
