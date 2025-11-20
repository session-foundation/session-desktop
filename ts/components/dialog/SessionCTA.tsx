import { isNil } from 'lodash';
import { Dispatch, useMemo, type ReactNode } from 'react';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import type { CSSProperties } from 'styled-components';
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
import { MergedLocalizerTokens, tr } from '../../localization/localeTools';
import { SessionButtonShiny } from '../basic/SessionButtonShiny';
import { useIsProAvailable } from '../../hooks/useIsProAvailable';
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
import { APP_URL } from '../../session/constants';

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

const StyledAnimatedCTAImageContainer = styled.div<{ noColor?: boolean }>`
  position: relative;
  ${props => (props.noColor ? 'filter: grayscale(100%) brightness(0.8);' : '')}
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

export const StyledCTATitle = styled.span<{ reverseDirection?: boolean }>`
  font-size: var(--font-size-h4);
  font-weight: bold;
  line-height: normal;
  display: inline-flex;
  flex-direction: ${props => (props.reverseDirection ? 'row-reverse' : 'row')};
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
    case CTAVariant.DONATE_GENERIC:
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

    case CTAVariant.NIL:
      return null;

    default:
      assertUnreachable(variant, 'getImage');
      throw new Error('unreachable');
  }
}

function getTitle(variant: CTAVariantExcludingProCTAs) {
  switch (variant) {
    case CTAVariant.DONATE_GENERIC:
      // FIXME: replace with localised string
      return 'Session Needs Your Help';
    case CTAVariant.NIL:
      return null;
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

  return <StyledCTATitle>{getTitle(variant)}</StyledCTATitle>;
}

function getDescription(variant: CTAVariantExcludingProCTAs) {
  switch (variant) {
    case CTAVariant.DONATE_GENERIC:
      // FIXME: replace with localised string
      return (
        <>
          {`Session is fighting powerful forces trying to weaken privacy, but we can’t continue this fight alone.`}
          <br />
          <br />
          {`Donating keeps Session secure, independent, and online.`}
        </>
      );

    case CTAVariant.NIL:
      return null;

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
    <StyledScrollDescriptionContainer>{getDescription(variant)}</StyledScrollDescriptionContainer>
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
  const dispatch = useDispatch();

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
            // TODO: this should be moved to a constant as its used in 2 places and will have special behaviour
            // TODO: implement link usage tracking
            showLinkVisitWarningDialog(APP_URL.DONATE, dispatch);
            onClose();
          }}
          dataTestId="modal-session-pro-confirm-button"
        >
          {/** FIXME: replace with localised string */}
          Donate
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

  const closeButtonText = useMemo(() => {
    if (variant === CTAVariant.DONATE_GENERIC) {
      // FIXME: replace with localised string
      return 'Skip';
    }
    return tr(actionButton && variant !== CTAVariant.PRO_EXPIRING_SOON ? 'cancel' : 'close');
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
        dataTestId="modal-session-pro-cancel-button"
        style={!actionButton ? { ...proButtonProps.style, width: '50%' } : proButtonProps.style}
      >
        {closeButtonText}
      </SessionButton>
    </ModalActionsContainer>
  );
}

export function SessionCTA(props: SessionCTAState) {
  const dispatch = useDispatch();
  const hasPro = useCurrentUserHasPro();

  function onClose() {
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
  const dispatch = useDispatch();

  // TODO: remove once pro is released
  const isProAvailable = useIsProAvailable();
  const isProCTA = useIsProCTAVariant(variant);
  if (isProCTA && !isProAvailable) {
    return () => null;
  }

  return () => showSessionCTA(variant, dispatch);
};

export const useShowSessionCTACbWithVariant = () => {
  const dispatch = useDispatch();

  // TODO: remove once pro is released
  const isProAvailable = useIsProAvailable();

  return (variant: CTAVariant) => {
    if (isProCTAVariant(variant) && !isProAvailable) {
      return;
    }
    showSessionCTA(variant, dispatch);
  };
};

export async function handleTriggeredProCTAs(dispatch: Dispatch<any>) {
  if (!getFeatureFlag('proAvailable')) {
    return;
  }

  if (Storage.get(SettingsKey.proExpiringSoonCTA)) {
    dispatch(
      updateSessionCTA({
        variant: CTAVariant.PRO_EXPIRING_SOON,
      })
    );
    await Storage.put(SettingsKey.proExpiringSoonCTA, false);
  } else if (Storage.get(SettingsKey.proExpiredCTA)) {
    dispatch(
      updateSessionCTA({
        variant: CTAVariant.PRO_EXPIRED,
      })
    );
    await Storage.put(SettingsKey.proExpiredCTA, false);
  }
}
