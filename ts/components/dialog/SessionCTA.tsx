import { isNil } from 'lodash';
import { Dispatch, useMemo, type ReactNode } from 'react';
import styled from 'styled-components';
import type { CSSProperties } from 'styled-components';
import { getAppDispatch } from '../../state/dispatch';
import {
  type SessionCTAState,
  updateSessionCTA,
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
import type { MergedLocalizerTokens } from '../../localization/localeTools';
import { SessionButtonShiny } from '../basic/SessionButtonShiny';
import { getIsProAvailableMemo } from '../../hooks/useIsProAvailable';
import { useCurrentUserHasPro } from '../../hooks/useHasPro';
import { assertUnreachable } from '../../types/sqlSharedTypes';
import { Storage } from '../../util/storage';
import { SettingsKey } from '../../data/settings-key';
import { ProCTADescription } from './ProCTADescription';
import { ProCTATitle } from './ProCTATitle';
import {
  CTAVariant,
  type CTAVariantExcludingProCTAs,
  isProCTAVariant,
  type ProCTAVariant,
  isProCTAFeatureVariant,
} from './cta/types';
import { getFeatureFlag } from '../../state/ducks/types/releasedFeaturesReduxTypes';
import { showLinkVisitWarningDialog } from './OpenUrlModal';
import { APP_URL, DURATION } from '../../session/constants';
import { Data } from '../../data/data';
import { getUrlInteractionsForUrl, URLInteraction } from '../../util/urlHistory';
import { Localizer } from '../basic/Localizer';
import {
  CTAInteraction,
  getCtaInteractionsForCta,
  registerCtaInteraction,
} from '../../util/ctaHistory';

let donateCTAShown = false;

function useIsProCTAVariant(v: CTAVariant): v is ProCTAVariant {
  return useMemo(() => isProCTAVariant(v), [v]);
}

const StyledContentContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--margins-xl);
`;

export const StyledScrollDescriptionContainer = styled.div`
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

const StyledAnimatedCTAImageContainer = styled.div<{ $noColor?: boolean }>`
  position: relative;
  ${props => (props.$noColor ? 'filter: grayscale(100%) brightness(0.8);' : '')}
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
    <StyledAnimatedCTAImageContainer $noColor={noColor}>
      <StyledCTAImage src={ctaLayerSrc} />
      <StyledAnimationImage src={animatedLayerSrc} style={animationStyle} />
    </StyledAnimatedCTAImageContainer>
  );
}

export const StyledCTATitle = styled.span<{ $reverseDirection?: boolean }>`
  font-size: var(--font-size-h4);
  font-weight: bold;
  line-height: normal;
  display: inline-flex;
  flex-direction: ${props => (props.$reverseDirection ? 'row-reverse' : 'row')};
  align-items: center;
  gap: var(--margins-xs);
  padding: 3px;
`;

function isVariantWithActionButton(variant: CTAVariant): boolean {
  return ![
    CTAVariant.PRO_GROUP_NON_ADMIN,
    CTAVariant.PRO_GROUP_ACTIVATED,
    CTAVariant.PRO_ANIMATED_DISPLAY_PICTURE_ACTIVATED,
  ].includes(variant);
}

function getImage(variant: CTAVariant): ReactNode {
  switch (variant) {
    case CTAVariant.PRO_PINNED_CONVERSATION_LIMIT:
    case CTAVariant.PRO_PINNED_CONVERSATION_LIMIT_GRANDFATHERED:
      return <StyledCTAImage src="images/cta/pro-pinned.webp" />;

    case CTAVariant.PRO_ANIMATED_DISPLAY_PICTURE:
    case CTAVariant.PRO_ANIMATED_DISPLAY_PICTURE_ACTIVATED:
      return (
        <AnimatedCTAImage
          ctaLayerSrc="images/cta/pro-animated-profile.webp"
          animatedLayerSrc="images/cta/pro-animated-profile-animation.webp"
          animationStyle={{ width: '13%', top: '28.5%', left: '45%' }}
        />
      );

    case CTAVariant.PRO_MESSAGE_CHARACTER_LIMIT:
      return <StyledCTAImage src="images/cta/pro-higher-character-limit.webp" />;

    // TODO: Group CTA images dont exist yet and need to be implemented later
    case CTAVariant.PRO_GROUP_ADMIN:
    case CTAVariant.PRO_GROUP_NON_ADMIN:
    case CTAVariant.PRO_GROUP_ACTIVATED:
      return <StyledCTAImage src="images/cta_hero_group_activated_admin.webp" />;

    case CTAVariant.PRO_GENERIC:
    case CTAVariant.PRO_EXPIRING_SOON:
    case CTAVariant.PRO_EXPIRED:
      return (
        <AnimatedCTAImage
          ctaLayerSrc="images/cta/pro-generic.webp"
          animatedLayerSrc="images/cta/pro-animated-profile-animation.webp"
          animationStyle={{ width: '8%', top: '59.2%', left: '85.5%' }}
          noColor={variant === CTAVariant.PRO_EXPIRED}
        />
      );

    case CTAVariant.DONATE_GENERIC:
      return <StyledCTAImage src="images/cta/donate.webp" />;

    default:
      assertUnreachable(variant, 'getImage');
      throw new Error('unreachable');
  }
}

function getTitle(variant: CTAVariantExcludingProCTAs) {
  switch (variant) {
    case CTAVariant.DONATE_GENERIC:
      return <Localizer token="donateSessionHelp" />;
    default:
      assertUnreachable(variant, 'CtaTitle');
      throw new Error('unreachable');
  }
}

function CtaTitle({ variant }: { variant: CTAVariant }) {
  const isProCTA = useIsProCTAVariant(variant);
  if (isProCTA) {
    return <ProCTATitle variant={variant} />;
  }

  return <StyledCTATitle data-testid="cta-heading">{getTitle(variant)}</StyledCTATitle>;
}

function getDescription(variant: CTAVariantExcludingProCTAs) {
  switch (variant) {
    case CTAVariant.DONATE_GENERIC:
      return <Localizer token="donateSessionDescription" />;

    default:
      assertUnreachable(variant, 'CtaTitle');
      throw new Error('unreachable');
  }
}

function CTADescription({ variant }: { variant: CTAVariant }) {
  const isProCTA = useIsProCTAVariant(variant);
  if (isProCTA) {
    return <ProCTADescription variant={variant} />;
  }

  return (
    <StyledScrollDescriptionContainer data-testid="cta-body">
      {getDescription(variant)}
    </StyledScrollDescriptionContainer>
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
  variant: CTAVariant;
  onClose: () => void;
  afterActionButtonCallback?: () => void;
  actionButtonNextModalAfterCloseCallback?: () => void;
}) {
  const dispatch = getAppDispatch();

  const actionButton = useMemo(() => {
    if (!isVariantWithActionButton(variant)) {
      return null;
    }

    if (variant === CTAVariant.DONATE_GENERIC) {
      return (
        <SessionButtonShiny
          {...proButtonProps}
          shinyContainerStyle={{
            width: '100%',
          }}
          onClick={() => {
            void registerCtaInteraction(variant, CTAInteraction.ACTION);
            showLinkVisitWarningDialog(APP_URL.DONATE, dispatch);
            onClose();
          }}
          dataTestId="cta-confirm-button"
        >
          <Localizer token="donate" />
        </SessionButtonShiny>
      );
    }

    let settingsModalProps: UserSettingsModalState = {
      userSettingsPage: 'pro',
      hideBackButton: true,
      fromCTA: true,
      centerAlign: true,
      afterCloseAction: actionButtonNextModalAfterCloseCallback,
    };

    let buttonTextKey: MergedLocalizerTokens = 'theContinue';

    if (variant === CTAVariant.PRO_EXPIRED || variant === CTAVariant.PRO_EXPIRING_SOON) {
      settingsModalProps = {
        userSettingsPage: 'proNonOriginating',
        nonOriginatingVariant: variant === CTAVariant.PRO_EXPIRED ? 'renew' : 'update',
        hideBackButton: true,
        centerAlign: true,
        afterCloseAction: actionButtonNextModalAfterCloseCallback,
      };

      buttonTextKey = variant === CTAVariant.PRO_EXPIRED ? 'renew' : 'update';
    }

    return (
      <SessionButtonShiny
        {...proButtonProps}
        shinyContainerStyle={{
          width: '100%',
        }}
        onClick={() => {
          void registerCtaInteraction(variant, CTAInteraction.ACTION);
          onClose();
          dispatch(userSettingsModal(settingsModalProps));
          afterActionButtonCallback?.();
        }}
        dataTestId="cta-confirm-button"
      >
        <Localizer token={buttonTextKey} />
      </SessionButtonShiny>
    );
  }, [
    variant,
    dispatch,
    onClose,
    actionButtonNextModalAfterCloseCallback,
    afterActionButtonCallback,
  ]);

  const closeButtonToken: MergedLocalizerTokens = useMemo(() => {
    if (variant === CTAVariant.DONATE_GENERIC) {
      return 'maybeLater';
    }
    return actionButton && variant !== CTAVariant.PRO_EXPIRING_SOON ? 'cancel' : 'close';
  }, [variant, actionButton]);

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
        dataTestId="cta-cancel-button"
        style={!actionButton ? { ...proButtonProps.style, width: '50%' } : proButtonProps.style}
      >
        <Localizer token={closeButtonToken} />
      </SessionButton>
    </ModalActionsContainer>
  );
}

export function SessionCTA(props: SessionCTAState) {
  const dispatch = getAppDispatch();
  const hasPro = useCurrentUserHasPro();

  function onClose() {
    if (props?.variant) {
      void registerCtaInteraction(props.variant, CTAInteraction.CLOSE);
    }
    dispatch(updateSessionCTA(null));
  }

  const variant = props?.variant;

  // NOTE: Feature CTAs shouldnt show for users with pro
  if (isNil(variant) || (hasPro && isProCTAFeatureVariant(variant))) {
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
      headerChildren={getImage(variant)}
      buttonChildren={
        <Buttons
          variant={variant}
          onClose={onClose}
          afterActionButtonCallback={props?.afterActionButtonCallback}
          actionButtonNextModalAfterCloseCallback={props?.actionButtonNextModalAfterCloseCallback}
        />
      }
    >
      <SpacerSM />
      <CtaTitle variant={variant} />
      <SpacerXL />
      <StyledContentContainer>
        <CTADescription variant={variant} />
      </StyledContentContainer>
      <SpacerXL />
    </SessionWrapperModal>
  );
}

export const showSessionCTA = (variant: CTAVariant, dispatch: Dispatch<any>) => {
  dispatch(
    updateSessionCTA({
      variant,
    })
  );
};

export const useShowSessionCTACb = (variant: CTAVariant) => {
  const dispatch = getAppDispatch();
  const isProAvailable = getIsProAvailableMemo();
  const isProCTA = useIsProCTAVariant(variant);
  if (isProCTA && !isProAvailable) {
    return () => null;
  }

  return () => showSessionCTA(variant, dispatch);
};

export const useShowSessionCTACbWithVariant = () => {
  const dispatch = getAppDispatch();
  const isProAvailable = getIsProAvailableMemo();

  return (variant: CTAVariant) => {
    if (isProCTAVariant(variant) && !isProAvailable) {
      return;
    }
    showSessionCTA(variant, dispatch);
  };
};

export async function handleTriggeredCTAs(dispatch: Dispatch<any>, fromAppStart: boolean) {
  const proAvailable = getFeatureFlag('proAvailable');

  if (Storage.get(SettingsKey.proExpiringSoonCTA)) {
    if (!proAvailable) {
      return;
    }
    dispatch(
      updateSessionCTA({
        variant: CTAVariant.PRO_EXPIRING_SOON,
      })
    );
    await Storage.put(SettingsKey.proExpiringSoonCTA, false);
  } else if (Storage.get(SettingsKey.proExpiredCTA)) {
    if (!proAvailable) {
      return;
    }
    dispatch(
      updateSessionCTA({
        variant: CTAVariant.PRO_EXPIRED,
      })
    );
    await Storage.put(SettingsKey.proExpiredCTA, false);
  } else {
    if (!fromAppStart) {
      // we only want to show the DonateCTA when the app starts, if needed
      return;
    }
    const dbCreationTimestampMs = await Data.getDBCreationTimestampMs();
    if (dbCreationTimestampMs && dbCreationTimestampMs + 7 * DURATION.DAYS < Date.now()) {
      const donateUrlInteractions = getUrlInteractionsForUrl(APP_URL.DONATE);
      if (
        !donateUrlInteractions.includes(URLInteraction.COPY) &&
        !donateUrlInteractions.includes(URLInteraction.OPEN) &&
        !donateCTAShown
      ) {
        const donateCtaInteractions = getCtaInteractionsForCta(CTAVariant.DONATE_GENERIC);
        if (donateCtaInteractions?.open && donateCtaInteractions.open < 4) {
          dispatch(updateSessionCTA({ variant: CTAVariant.DONATE_GENERIC }));
          donateCTAShown = true;
        }
      }
    }
  }
}
