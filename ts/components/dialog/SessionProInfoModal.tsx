import { isNil } from 'lodash';
import { Dispatch, type ReactNode } from 'react';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import { type SessionProInfoState, updateSessionProInfoModal } from '../../state/ducks/modalDialog';
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
import { SessionIcon } from '../icon';
import { LucideIcon } from '../icon/LucideIcon';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';
import { tr } from '../../localization/localeTools';
import { FileIcon } from '../icon/FileIcon';
import { SessionButtonShiny } from '../basic/SessionButtonShiny';
import { useHasPro } from '../../hooks/useHasPro';
import { useIsProAvailable } from '../../hooks/useIsProAvailable';

export enum SessionProInfoVariant {
  MESSAGE_CHARACTER_LIMIT = 0,
  PINNED_CONVERSATION_LIMIT = 1,
  PINNED_CONVERSATION_LIMIT_GRANDFATHERED = 2,
  PROFILE_PICTURE_ANIMATED = 3,
  ALREADY_PRO_PROFILE_PICTURE_ANIMATED = 4,
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

  inset-inline-start: 0;
  width: 13%;
  top: 28.5%;
  left: 45%;
`;

const StyledAnimatedCTAImageContainer = styled.div`
  position: relative;
`;

function AnimatedCTAImage({
  ctaLayerSrc,
  animatedLayerSrc,
}: {
  ctaLayerSrc: string;
  animatedLayerSrc: string;
}) {
  return (
    <StyledAnimatedCTAImageContainer>
      <StyledCTAImage src={ctaLayerSrc} />
      <StyledAnimationImage src={animatedLayerSrc} />
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

function getFeatureList(variant: SessionProInfoVariant) {
  switch (variant) {
    case SessionProInfoVariant.PROFILE_PICTURE_ANIMATED:
      return ['proFeatureListAnimatedDisplayPicture', 'proFeatureListLargerGroups'] as const;
    case SessionProInfoVariant.PINNED_CONVERSATION_LIMIT:
    case SessionProInfoVariant.PINNED_CONVERSATION_LIMIT_GRANDFATHERED:
      return ['proFeatureListPinnedConversations', 'proFeatureListLargerGroups'] as const;
    case SessionProInfoVariant.MESSAGE_CHARACTER_LIMIT:
    default:
      return ['proFeatureListLongerMessages', 'proFeatureListLargerGroups'] as const;
  }
}

function getDescription(variant: SessionProInfoVariant): ReactNode {
  switch (variant) {
    case SessionProInfoVariant.PINNED_CONVERSATION_LIMIT:
      return tr('proCallToActionPinnedConversationsMoreThan');
    case SessionProInfoVariant.PINNED_CONVERSATION_LIMIT_GRANDFATHERED:
      return tr('proCallToActionPinnedConversations');
    case SessionProInfoVariant.PROFILE_PICTURE_ANIMATED:
      return tr('proAnimatedDisplayPictureCallToActionDescription');
    case SessionProInfoVariant.ALREADY_PRO_PROFILE_PICTURE_ANIMATED:
      return (
        <>
          <span>
            {tr('proAlreadyPurchased')}{' '}
            <SessionIcon
              sizeIsWidth={false}
              iconType={'sessionPro'}
              iconSize={'small'}
              backgroundColor={'var(--primary-color)'}
              borderRadius={'4px'}
              iconColor={'var(--black-color)'}
            />
          </span>
          <br />
          {tr('proAnimatedDisplayPicture')}
        </>
      );

    case SessionProInfoVariant.MESSAGE_CHARACTER_LIMIT:
    default:
      return tr('proCallToActionLongerMessages');
  }
}

function getImage(variant: SessionProInfoVariant): ReactNode {
  switch (variant) {
    case SessionProInfoVariant.PINNED_CONVERSATION_LIMIT:
    case SessionProInfoVariant.PINNED_CONVERSATION_LIMIT_GRANDFATHERED:
      return <StyledCTAImage src="images/cta_hero_pin_convo_limit.webp" />;

    case SessionProInfoVariant.PROFILE_PICTURE_ANIMATED:
    case SessionProInfoVariant.ALREADY_PRO_PROFILE_PICTURE_ANIMATED:
      return (
        <AnimatedCTAImage
          ctaLayerSrc="images/cta_hero_animated_profile_base_layer.webp"
          animatedLayerSrc="images/cta_hero_animated_profile_animation_layer.webp"
        />
      );

    case SessionProInfoVariant.MESSAGE_CHARACTER_LIMIT:
    default:
      return <StyledCTAImage src="images/cta_hero_char_limit.webp" />;
  }
}

function isProVisibleCTA(variant: SessionProInfoVariant): boolean {
  // This is simple now but if we ever add multiple this needs to become a list
  return variant === SessionProInfoVariant.ALREADY_PRO_PROFILE_PICTURE_ANIMATED;
}

const buttonProps = {
  buttonShape: SessionButtonShape.Square,
  buttonType: SessionButtonType.Solid,
  fontWeight: 400,
  style: {
    height: '46px',
    width: '100%',
  },
} satisfies SessionButtonProps;

export function SessionProInfoModal(props: SessionProInfoState) {
  const dispatch = useDispatch();
  const hasPro = useHasPro();

  function onClose() {
    dispatch(updateSessionProInfoModal(null));
  }

  if (isNil(props?.variant) || (hasPro && !isProVisibleCTA(props.variant))) {
    return null;
  }

  return (
    <SessionWrapperModal
      onClose={onClose}
      headerChildren={getImage(props.variant)}
      padding="0"
      removeScrollbarGutter={true}
      shouldOverflow={true}
      $contentMinWidth={WrapperModalWidth.normal}
      $contentMaxWidth={WrapperModalWidth.normal}
      buttonChildren={
        <ModalActionsContainer
          maxWidth="unset"
          style={{
            display: 'grid',
            alignItems: 'center',
            justifyItems: 'center',
            gridTemplateColumns: hasPro ? '1fr' : '1fr 1fr',
            columnGap: 'var(--margins-sm)',
            paddingInline: 'var(--margins-md)',
            marginBottom: 'var(--margins-md)',
            height: 'unset',
          }}
        >
          {!hasPro ? (
            <SessionButtonShiny
              {...buttonProps}
              shinyContainerStyle={{
                width: '100%',
              }}
              buttonColor={SessionButtonColor.Primary}
              onClick={onClose}
              dataTestId="modal-session-pro-confirm-button"
            >
              {tr('theContinue')}
            </SessionButtonShiny>
          ) : null}
          <SessionButton
            {...buttonProps}
            buttonColor={SessionButtonColor.Tertiary}
            onClick={onClose}
            dataTestId="modal-session-pro-cancel-button"
            style={hasPro ? { ...buttonProps.style, width: '50%' } : buttonProps.style}
          >
            {tr(hasPro ? 'close' : 'cancel')}
          </SessionButton>
        </ModalActionsContainer>
      }
    >
      <SpacerSM />
      <StyledCTATitle reverseDirection={hasPro}>
        {tr(hasPro ? 'proActivated' : 'upgradeTo')}
        <SessionIcon
          sizeIsWidth={false}
          iconType={'sessionPro'}
          iconSize={'huge'}
          backgroundColor={'var(--primary-color)'}
          borderRadius={'6px'}
          iconColor={'var(--black-color)'}
        />
      </StyledCTATitle>
      <SpacerXL />
      <StyledContentContainer>
        <StyledScrollDescriptionContainer>
          {getDescription(props.variant)}
        </StyledScrollDescriptionContainer>
        {!hasPro ? (
          <StyledFeatureList>
            {getFeatureList(props.variant).map(token => (
              <FeatureListItem>{tr(token)}</FeatureListItem>
            ))}
            <FeatureListItem customIconSrc={'images/sparkle-animated.svg'}>
              {tr('proFeatureListLoadsMore')}
            </FeatureListItem>
          </StyledFeatureList>
        ) : null}
      </StyledContentContainer>
      <SpacerXL />
    </SessionWrapperModal>
  );
}

export const showSessionProInfoDialog = (
  variant: SessionProInfoVariant,
  dispatch: Dispatch<any>
) => {
  dispatch(
    updateSessionProInfoModal({
      variant,
    })
  );
};

export const useShowSessionProInfoDialogCb = (variant: SessionProInfoVariant) => {
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
    return (_: SessionProInfoVariant) => null;
  }

  return (variant: SessionProInfoVariant) => showSessionProInfoDialog(variant, dispatch);
};
