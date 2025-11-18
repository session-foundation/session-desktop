import { isNil } from 'lodash';
import { Dispatch, useMemo, type ReactNode } from 'react';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import type { CSSProperties } from 'styled-components';
import {
  type SessionProInfoState,
  updateSessionProInfoModal,
  userSettingsModal,
  UserSettingsModalState,
} from '../../state/ducks/modalDialog';
import {
  SessionWrapperModal,
  WrapperModalWidth,
  ModalActionsContainer,
} from '../SessionWrapperModal';
import {
  SessionButton,
  SessionButtonColor,
  type SessionButtonProps,
  SessionButtonShape,
  SessionButtonType,
} from '../basic/SessionButton';
import { SpacerSM, SpacerXL } from '../basic/Text';
import { LucideIcon } from '../icon/LucideIcon';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';
import { MergedLocalizerTokens, tr } from '../../localization/localeTools';
import { FileIcon } from '../icon/FileIcon';
import { SessionButtonShiny } from '../basic/SessionButtonShiny';
import { useIsProAvailable } from '../../hooks/useIsProAvailable';
import {
  useCurrentUserHasExpiredPro,
  useCurrentUserHasPro,
  useProAccessDetails,
} from '../../hooks/useHasPro';
import { ProIconButton } from '../buttons/ProButton';
import { assertUnreachable } from '../../types/sqlSharedTypes';
import { Localizer } from '../basic/Localizer';
import { CONVERSATION } from '../../session/constants';
import { formatNumber } from '../../util/i18n/formatting/generics';
import { Storage } from '../../util/storage';
import { SettingsKey } from '../../data/settings-key';

export enum ProCTAVariant {
  GENERIC = 0,
  // Feature - has expired sub variants
  MESSAGE_CHARACTER_LIMIT = 1,
  ANIMATED_DISPLAY_PICTURE = 2,
  ANIMATED_DISPLAY_PICTURE_ACTIVATED = 3,
  PINNED_CONVERSATION_LIMIT = 4,
  PINNED_CONVERSATION_LIMIT_GRANDFATHERED = 5,
  // Groups
  GROUP_NON_ADMIN = 6,
  GROUP_ADMIN = 7,
  GROUP_ACTIVATED = 8,
  // Special
  EXPIRING_SOON = 9,
  EXPIRED = 10,
}

const StyledContentContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--margins-xl);
`;

const StyledScrollDescriptionContainer = styled.div`
  text-align: center;
  font-size: var(--font-size-lg);
  line-height: var(--font-size-xl);
  color: var(--text-secondary-color);
`;

const StyledCTAImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: right center;
  background-color: var(--primary-color);

  mask-image: linear-gradient(to bottom, black 66%, transparent 97%);
  mask-size: 100% 100%;
`;

const StyledAnimationImage = styled.img`
  position: absolute;
`;

const StyledAnimatedCTAImageContainer = styled.div<{ noColor?: boolean }>`
  position: relative;
  ${props => (props.noColor ? 'filter: grayscale(100%);' : '')}
`;

function AnimatedCTAImage({
  ctaLayerSrc,
  animatedLayerSrc,
  animationStyle,
  noColor,
}: {
  ctaLayerSrc: string;
  animatedLayerSrc: string;
  animationStyle: CSSProperties;
  noColor?: boolean;
}) {
  return (
    <StyledAnimatedCTAImageContainer noColor={noColor}>
      <StyledCTAImage src={ctaLayerSrc} />
      <StyledAnimationImage src={animatedLayerSrc} style={animationStyle} />
    </StyledAnimatedCTAImageContainer>
  );
}

const StyledCTATitle = styled.span<{ reverseDirection: boolean }>`
  font-size: var(--font-size-h4);
  font-weight: bold;
  line-height: normal;
  display: inline-flex;
  flex-direction: ${props => (props.reverseDirection ? 'row-reverse' : 'row')};
  align-items: center;
  gap: var(--margins-xs);
  padding: 3px;
`;

const StyledFeatureList = styled.ul`
  list-style: none;
  padding-inline-start: 0;
  text-align: start;
  display: grid;
  font-size: var(--font-size-lg);
  grid-row-gap: var(--margins-md);
  margin-block: 0;
`;

const StyledListItem = styled.li`
  display: inline-flex;
  gap: var(--margins-sm);
  align-items: end;
  line-height: normal;
`;

function FeatureListItem({
  children,
  customIconSrc,
}: {
  children: ReactNode;
  customIconSrc?: string;
}) {
  return (
    <StyledListItem>
      {customIconSrc ? (
        <FileIcon iconSize={'var(--font-size-xl)'} src={customIconSrc} />
      ) : (
        <LucideIcon
          unicode={LUCIDE_ICONS_UNICODE.CIRCLE_CHECK}
          iconSize={'medium'}
          iconColor={'var(--primary-color)'}
        />
      )}
      {children}
    </StyledListItem>
  );
}

function isVariantWithActionButton(variant: ProCTAVariant): boolean {
  return ![
    ProCTAVariant.GROUP_NON_ADMIN,
    ProCTAVariant.GROUP_ACTIVATED,
    ProCTAVariant.ANIMATED_DISPLAY_PICTURE_ACTIVATED,
  ].includes(variant);
}

// These CTAS have "Upgrade to" and "Renew" titles.
const variantsForNonGroupFeatures = [
  ProCTAVariant.MESSAGE_CHARACTER_LIMIT,
  ProCTAVariant.ANIMATED_DISPLAY_PICTURE,
  ProCTAVariant.PINNED_CONVERSATION_LIMIT,
  ProCTAVariant.PINNED_CONVERSATION_LIMIT_GRANDFATHERED,
  ProCTAVariant.GENERIC,
] as const;

type VariantForNonGroupFeature = (typeof variantsForNonGroupFeatures)[number];

function isFeatureVariant(variant: ProCTAVariant): variant is VariantForNonGroupFeature {
  return variantsForNonGroupFeatures.includes(variant as any);
}

const variantsWithoutFeatureList = [
  ProCTAVariant.GROUP_NON_ADMIN,
  ProCTAVariant.GROUP_ACTIVATED,
  ProCTAVariant.ANIMATED_DISPLAY_PICTURE_ACTIVATED,
] as const;

type VariantWithoutFeatureList = (typeof variantsWithoutFeatureList)[number];
type VariantWithFeatureList = Exclude<ProCTAVariant, VariantWithoutFeatureList>;

function isProFeatureListCTA(variant: ProCTAVariant): variant is VariantWithFeatureList {
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
    case ProCTAVariant.MESSAGE_CHARACTER_LIMIT:
      return [ProFeatureKey.LONGER_MESSAGES, ProFeatureKey.MORE_PINNED_CONVOS];

    case ProCTAVariant.ANIMATED_DISPLAY_PICTURE:
      return [ProFeatureKey.ANIMATED_DP, ProFeatureKey.LONGER_MESSAGES];

    case ProCTAVariant.PINNED_CONVERSATION_LIMIT:
    case ProCTAVariant.PINNED_CONVERSATION_LIMIT_GRANDFATHERED:
      return [ProFeatureKey.MORE_PINNED_CONVOS, ProFeatureKey.LONGER_MESSAGES];

    case ProCTAVariant.GENERIC: // yes generic has the same as above, reversed...
      return [ProFeatureKey.LONGER_MESSAGES, ProFeatureKey.MORE_PINNED_CONVOS];

    case ProCTAVariant.EXPIRING_SOON:
    case ProCTAVariant.EXPIRED:
      return [
        ProFeatureKey.LONGER_MESSAGES,
        ProFeatureKey.MORE_PINNED_CONVOS,
        ProFeatureKey.ANIMATED_DP,
      ];

    case ProCTAVariant.GROUP_ADMIN:
      return [ProFeatureKey.LARGER_GROUPS, ProFeatureKey.LONGER_MESSAGES];

    default:
      assertUnreachable(variant, 'getFeatureList unreachable case');
      throw new Error('unreachable');
  }
}

function FeatureList({ variant }: { variant: ProCTAVariant }) {
  const featureList = useMemo(() => {
    if (!isProFeatureListCTA(variant)) {
      return [];
    }
    const features = getBaseFeatureList(variant).map(token => (
      <FeatureListItem>{tr(token)}</FeatureListItem>
    ));

    // Expiry related CTAs dont show the "more" feature item
    if (variant !== ProCTAVariant.EXPIRED && variant !== ProCTAVariant.EXPIRING_SOON) {
      features.push(
        <FeatureListItem customIconSrc={'images/sparkle-animated.svg'}>
          {tr('proFeatureListLoadsMore')}
        </FeatureListItem>
      );
    }
    return features;
  }, [variant]);

  return featureList.length ? <StyledFeatureList>{featureList}</StyledFeatureList> : null;
}

function ProExpiringSoonDescription() {
  const { data } = useProAccessDetails();
  return <Localizer token="proExpiringSoonDescription" time={data.expiryTimeRelativeString} />;
}

function getDescription(variant: ProCTAVariant, userHasProExpired: boolean): ReactNode {
  switch (variant) {
    case ProCTAVariant.PINNED_CONVERSATION_LIMIT:
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

    case ProCTAVariant.PINNED_CONVERSATION_LIMIT_GRANDFATHERED:
      return (
        <Localizer
          token={
            userHasProExpired
              ? 'proRenewPinMoreConversations'
              : 'proCallToActionPinnedConversations'
          }
        />
      );

    case ProCTAVariant.ANIMATED_DISPLAY_PICTURE:
      return (
        <Localizer
          token={
            userHasProExpired
              ? 'proRenewAnimatedDisplayPicture'
              : 'proAnimatedDisplayPictureCallToActionDescription'
          }
        />
      );

    case ProCTAVariant.ANIMATED_DISPLAY_PICTURE_ACTIVATED:
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

    case ProCTAVariant.MESSAGE_CHARACTER_LIMIT:
      return (
        <Localizer
          token={userHasProExpired ? 'proRenewLongerMessages' : 'proCallToActionLongerMessages'}
        />
      );

    case ProCTAVariant.GENERIC:
      return (
        <Localizer
          token={userHasProExpired ? 'proRenewMaxPotential' : 'proUserProfileModalCallToAction'}
        />
      );

    case ProCTAVariant.EXPIRING_SOON:
      return <ProExpiringSoonDescription />;

    case ProCTAVariant.EXPIRED:
      return <Localizer token="proExpiredDescription" />;

    // TODO: Group CTA string dont all exist yet and need to be implemented later
    case ProCTAVariant.GROUP_ADMIN:
    case ProCTAVariant.GROUP_NON_ADMIN:
    case ProCTAVariant.GROUP_ACTIVATED:
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

function getImage(variant: ProCTAVariant): ReactNode {
  switch (variant) {
    case ProCTAVariant.PINNED_CONVERSATION_LIMIT:
    case ProCTAVariant.PINNED_CONVERSATION_LIMIT_GRANDFATHERED:
      return <StyledCTAImage src="images/cta/pro-pinned.webp" />;

    case ProCTAVariant.ANIMATED_DISPLAY_PICTURE:
    case ProCTAVariant.ANIMATED_DISPLAY_PICTURE_ACTIVATED:
      return (
        <AnimatedCTAImage
          ctaLayerSrc="images/cta/pro-animated-profile.webp"
          animatedLayerSrc="images/cta/pro-animated-profile-animation.webp"
          animationStyle={{ width: '13%', top: '28.5%', left: '45%' }}
        />
      );

    case ProCTAVariant.MESSAGE_CHARACTER_LIMIT:
      return <StyledCTAImage src="images/cta/pro-higher-character-limit.webp" />;

    // TODO: Group CTA images dont exist yet and need to be implemented later
    case ProCTAVariant.GROUP_ADMIN:
    case ProCTAVariant.GROUP_NON_ADMIN:
    case ProCTAVariant.GROUP_ACTIVATED:
      return <StyledCTAImage src="images/cta_hero_group_activated_admin.webp" />;

    case ProCTAVariant.GENERIC:
    case ProCTAVariant.EXPIRING_SOON:
    case ProCTAVariant.EXPIRED:
      return (
        <AnimatedCTAImage
          ctaLayerSrc="images/cta/pro-generic.webp"
          animatedLayerSrc="images/cta/pro-animated-profile-animation.webp"
          animationStyle={{ width: '8%', top: '59.2%', left: '85.5%' }}
          noColor={variant === ProCTAVariant.EXPIRED}
        />
      );

    default:
      assertUnreachable(variant, 'getImage');
      throw new Error('unreachable');
  }
}

function CtaTitle({ variant }: { variant: ProCTAVariant }) {
  const userHasExpiredPro = useCurrentUserHasExpiredPro();

  const titleText = useMemo(() => {
    if (isFeatureVariant(variant)) {
      return <Localizer token={userHasExpiredPro ? 'renew' : 'upgradeTo'} />;
    }

    switch (variant) {
      // TODO: Group CTA titles arent finalised and need to be implemneted later
      case ProCTAVariant.GROUP_NON_ADMIN:
        return <Localizer token="upgradeTo" />;

      case ProCTAVariant.GROUP_ADMIN:
        return <Localizer token={userHasExpiredPro ? 'renew' : 'upgradeTo'} />;

      case ProCTAVariant.ANIMATED_DISPLAY_PICTURE_ACTIVATED:
        return <Localizer token="proActivated" />;

      case ProCTAVariant.GROUP_ACTIVATED:
        return <Localizer token="proGroupActivated" />;

      case ProCTAVariant.EXPIRING_SOON:
        return <Localizer token="proExpiringSoon" />;

      case ProCTAVariant.EXPIRED:
        return <Localizer token="proExpired" />;

      default:
        assertUnreachable(variant, 'CtaTitle');
        throw new Error('unreachable');
    }
  }, [variant, userHasExpiredPro]);

  const isTitleDirectionReversed = useMemo(() => {
    return [
      ProCTAVariant.ANIMATED_DISPLAY_PICTURE_ACTIVATED,
      ProCTAVariant.GROUP_ACTIVATED,
      ProCTAVariant.EXPIRING_SOON,
      ProCTAVariant.EXPIRED,
    ].includes(variant);
  }, [variant]);

  return (
    <StyledCTATitle reverseDirection={isTitleDirectionReversed}>
      {titleText}
      <ProIconButton
        iconSize={'huge'}
        dataTestId="invalid-data-testid"
        onClick={undefined}
        noColors={variant === ProCTAVariant.EXPIRED}
      />
    </StyledCTATitle>
  );
}

// TODO: we might want to make this a specific button preset. As its used for all pro/sesh stuff
export const proButtonProps = {
  buttonShape: SessionButtonShape.Square,
  buttonType: SessionButtonType.Solid,
  fontWeight: 400,
  style: {
    height: '46px',
    width: '100%',
  },
} satisfies SessionButtonProps;

function Buttons({
  variant,
  onClose,
  afterActionButtonCallback,
  actionButtonNextModalAfterCloseCallback,
}: {
  variant: ProCTAVariant;
  onClose: () => void;
  afterActionButtonCallback?: () => void;
  actionButtonNextModalAfterCloseCallback?: () => void;
}) {
  const dispatch = useDispatch();

  const actionButton = useMemo(() => {
    if (!isVariantWithActionButton(variant)) {
      return null;
    }

    let settingsModalProps: UserSettingsModalState = {
      userSettingsPage: 'pro',
      hideBackButton: true,
      fromCTA: true,
      centerAlign: true,
      afterCloseAction: actionButtonNextModalAfterCloseCallback,
    };

    let buttonTextKey: MergedLocalizerTokens = 'theContinue';

    if (variant === ProCTAVariant.EXPIRED || variant === ProCTAVariant.EXPIRING_SOON) {
      settingsModalProps = {
        userSettingsPage: 'proNonOriginating',
        nonOriginatingVariant: variant === ProCTAVariant.EXPIRED ? 'renew' : 'update',
        hideBackButton: true,
        centerAlign: true,
        afterCloseAction: actionButtonNextModalAfterCloseCallback,
      };

      buttonTextKey = variant === ProCTAVariant.EXPIRED ? 'renew' : 'update';
    }

    return (
      <SessionButtonShiny
        {...proButtonProps}
        shinyContainerStyle={{
          width: '100%',
        }}
        onClick={() => {
          onClose();
          dispatch(userSettingsModal(settingsModalProps));
          afterActionButtonCallback?.();
        }}
        dataTestId="modal-session-pro-confirm-button"
      >
        {tr(buttonTextKey)}
      </SessionButtonShiny>
    );
  }, [
    variant,
    dispatch,
    onClose,
    actionButtonNextModalAfterCloseCallback,
    afterActionButtonCallback,
  ]);

  return (
    <ModalActionsContainer
      buttonType={SessionButtonType.Simple}
      maxWidth="unset"
      style={{
        display: 'grid',
        alignItems: 'center',
        justifyItems: 'center',
        gridTemplateColumns: actionButton ? '1fr 1fr' : '1fr',
        columnGap: 'var(--margins-sm)',
        paddingInline: 'var(--margins-md)',
        marginBottom: 'var(--margins-md)',
        height: 'unset',
      }}
    >
      {actionButton}
      <SessionButton
        {...proButtonProps}
        buttonColor={SessionButtonColor.Tertiary}
        onClick={onClose}
        dataTestId="modal-session-pro-cancel-button"
        style={!actionButton ? { ...proButtonProps.style, width: '50%' } : proButtonProps.style}
      >
        {tr(actionButton && variant !== ProCTAVariant.EXPIRING_SOON ? 'cancel' : 'close')}
      </SessionButton>
    </ModalActionsContainer>
  );
}

export function SessionProInfoModal(props: SessionProInfoState) {
  const dispatch = useDispatch();
  const hasPro = useCurrentUserHasPro();
  const userHasExpiredPro = useCurrentUserHasExpiredPro();

  function onClose() {
    dispatch(updateSessionProInfoModal(null));
  }

  // NOTE: Feature CTAs shouldnt show for users with pro
  if (isNil(props?.variant) || (hasPro && isFeatureVariant(props.variant))) {
    return null;
  }

  return (
    <SessionWrapperModal
      modalId="sessionProInfoModal"
      onClose={onClose}
      shouldOverflow={true}
      $contentMinWidth={WrapperModalWidth.normal}
      $contentMaxWidth={WrapperModalWidth.normal}
      style={{ backgroundColor: 'var(--background-primary-color)' }}
      moveHeaderIntoScrollableBody={true}
      removeScrollbarGutter={true}
      headerChildren={getImage(props.variant)}
      buttonChildren={
        <Buttons
          variant={props.variant}
          onClose={onClose}
          afterActionButtonCallback={props?.afterActionButtonCallback}
          actionButtonNextModalAfterCloseCallback={props?.actionButtonNextModalAfterCloseCallback}
        />
      }
    >
      <SpacerSM />
      <CtaTitle variant={props.variant} />
      <SpacerXL />
      <StyledContentContainer>
        <StyledScrollDescriptionContainer>
          {getDescription(props.variant, userHasExpiredPro)}
        </StyledScrollDescriptionContainer>
        <FeatureList variant={props.variant} />
      </StyledContentContainer>
      <SpacerXL />
    </SessionWrapperModal>
  );
}

export const showSessionProInfoDialog = (variant: ProCTAVariant, dispatch: Dispatch<any>) => {
  dispatch(
    updateSessionProInfoModal({
      variant,
    })
  );
};

export const useShowSessionProInfoDialogCb = (variant: ProCTAVariant) => {
  const dispatch = useDispatch();

  // TODO: remove once pro is released
  const isProAvailable = useIsProAvailable();
  if (!isProAvailable) {
    return () => null;
  }

  return () => showSessionProInfoDialog(variant, dispatch);
};

export const useShowSessionProInfoDialogCbWithVariant = () => {
  const dispatch = useDispatch();

  // TODO: remove once pro is released
  const isProAvailable = useIsProAvailable();
  if (!isProAvailable) {
    return (_: ProCTAVariant) => null;
  }

  return (variant: ProCTAVariant) => showSessionProInfoDialog(variant, dispatch);
};

export async function handleProTriggeredCTAs(dispatch: Dispatch<any>) {
  if (Storage.get(SettingsKey.proExpiringSoonCTA)) {
    dispatch(
      updateSessionProInfoModal({
        variant: ProCTAVariant.EXPIRING_SOON,
      })
    );
    await Storage.put(SettingsKey.proExpiringSoonCTA, false);
  } else if (Storage.get(SettingsKey.proExpiredCTA)) {
    dispatch(
      updateSessionProInfoModal({
        variant: ProCTAVariant.EXPIRED,
      })
    );
    await Storage.put(SettingsKey.proExpiredCTA, false);
  }
}
