import { isNil } from 'lodash';
import { Dispatch, type ReactNode } from 'react';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import type { CSSProperties } from 'styled-components';
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
import { LucideIcon } from '../icon/LucideIcon';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';
import { tr } from '../../localization/localeTools';
import { FileIcon } from '../icon/FileIcon';
import { SessionButtonShiny } from '../basic/SessionButtonShiny';
import { useIsProAvailable } from '../../hooks/useIsProAvailable';
import { useCurrentUserHasPro } from '../../hooks/useHasPro';
import { ProIconButton } from '../buttons/ProButton';
import { assertUnreachable } from '../../types/sqlSharedTypes';

export enum SessionProInfoVariant {
  MESSAGE_CHARACTER_LIMIT = 0,
  PINNED_CONVERSATION_LIMIT = 1,
  PINNED_CONVERSATION_LIMIT_GRANDFATHERED = 2,
  PROFILE_PICTURE_ANIMATED = 3,
  ALREADY_PRO_PROFILE_PICTURE_ANIMATED = 4,
  GENERIC = 5,
  GROUP_ACTIVATED = 6,
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

const StyledAnimatedCTAImageContainer = styled.div`
  position: relative;
`;

function AnimatedCTAImage({
  ctaLayerSrc,
  animatedLayerSrc,
  animationStyle,
}: {
  ctaLayerSrc: string;
  animatedLayerSrc: string;
  animationStyle: CSSProperties;
}) {
  return (
    <StyledAnimatedCTAImageContainer>
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

function getFeatureList(variant: SessionProInfoVariant) {
  switch (variant) {
    case SessionProInfoVariant.PROFILE_PICTURE_ANIMATED:
      return ['proFeatureListAnimatedDisplayPicture', 'proFeatureListLargerGroups'] as const;
    case SessionProInfoVariant.PINNED_CONVERSATION_LIMIT:
    case SessionProInfoVariant.PINNED_CONVERSATION_LIMIT_GRANDFATHERED:
      return ['proFeatureListPinnedConversations', 'proFeatureListLargerGroups'] as const;
    case SessionProInfoVariant.MESSAGE_CHARACTER_LIMIT:
    case SessionProInfoVariant.ALREADY_PRO_PROFILE_PICTURE_ANIMATED:
      return ['proFeatureListLongerMessages', 'proFeatureListLargerGroups'] as const;
    case SessionProInfoVariant.GENERIC: // yes generic has the same as above, reversed...
      return ['proFeatureListLargerGroups', 'proFeatureListLongerMessages'] as const;
    case SessionProInfoVariant.GROUP_ACTIVATED:
      return [];
    default:
      assertUnreachable(variant, 'getFeatureList unreachable case');
      throw new Error('unreachable');
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
            <ProIconButton
              iconSize={'small'}
              dataTestId="invalid-data-testid"
              onClick={undefined}
            />
          </span>
          <br />
          {tr('proAnimatedDisplayPicture')}
        </>
      );

    case SessionProInfoVariant.MESSAGE_CHARACTER_LIMIT:
      return tr('proCallToActionLongerMessages');

    case SessionProInfoVariant.GENERIC:
      return tr('proUserProfileModalCallToAction');
    case SessionProInfoVariant.GROUP_ACTIVATED:
      return (
        <span>
          {tr('proGroupActivatedDescription')}{' '}
          <ProIconButton iconSize={'small'} dataTestId="invalid-data-testid" onClick={undefined} />
        </span>
      );
    default:
      assertUnreachable(variant, 'getDescription unreachable case');
      throw new Error('unreachable');
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
          animationStyle={{ width: '13%', top: '28.5%', left: '45%' }}
        />
      );

    case SessionProInfoVariant.MESSAGE_CHARACTER_LIMIT:
      return <StyledCTAImage src="images/cta_hero_char_limit.webp" />;
    case SessionProInfoVariant.GROUP_ACTIVATED:
      return <StyledCTAImage src="images/cta_hero_group_activated_admin.webp" />;
    case SessionProInfoVariant.GENERIC:
      return (
        <AnimatedCTAImage
          ctaLayerSrc="images/cta_hero_generic_base_layer.webp"
          animatedLayerSrc="images/cta_hero_animated_profile_animation_layer.webp"
          animationStyle={{ width: '8%', top: '59.2%', left: '85.5%' }}
        />
      );

    default:
      assertUnreachable(variant, 'getImage');
      throw new Error('unreachable');
  }
}

function isProVisibleCTA(variant: SessionProInfoVariant): boolean {
  // This is simple now but if we ever add multiple this needs to become a list
  return [
    SessionProInfoVariant.ALREADY_PRO_PROFILE_PICTURE_ANIMATED,
    SessionProInfoVariant.GENERIC,
    SessionProInfoVariant.GROUP_ACTIVATED,
  ].includes(variant);
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

export function SessionProInfoModal(props: SessionProInfoState) {
  const dispatch = useDispatch();
  const hasPro = useCurrentUserHasPro();

  function onClose() {
    dispatch(updateSessionProInfoModal(null));
  }

  if (isNil(props?.variant) || (hasPro && !isProVisibleCTA(props.variant))) {
    return null;
  }
  const isGroupCta = props.variant === SessionProInfoVariant.GROUP_ACTIVATED;

  /**
   * Note: the group activated cta is quite custom, but whatever the pro status of the current pro user,
   * we do not want to show the CTA for "subscribe to pro".
   * An admin have subscribed and that's all that's needed to make this group a Pro group.
   */
  const hasNoProAndNotGroupCta = !hasPro && !isGroupCta;

  return (
    <SessionWrapperModal
      modalId="sessionProInfoModal"
      onClose={onClose}
      headerChildren={getImage(props.variant)}
      padding="0"
      removeScrollbarGutter={true}
      shouldOverflow={true}
      $contentMinWidth={WrapperModalWidth.normal}
      $contentMaxWidth={WrapperModalWidth.normal}
      buttonChildren={
        <ModalActionsContainer
          buttonType={SessionButtonType.Simple}
          maxWidth="unset"
          style={{
            display: 'grid',
            alignItems: 'center',
            justifyItems: 'center',
            gridTemplateColumns: !hasNoProAndNotGroupCta ? '1fr' : '1fr 1fr',
            columnGap: 'var(--margins-sm)',
            paddingInline: 'var(--margins-md)',
            marginBottom: 'var(--margins-md)',
            height: 'unset',
          }}
        >
          {hasNoProAndNotGroupCta ? (
            <SessionButtonShiny
              {...proButtonProps}
              shinyContainerStyle={{
                width: '100%',
              }}
              buttonColor={SessionButtonColor.PrimaryDark}
              onClick={onClose}
              dataTestId="modal-session-pro-confirm-button"
            >
              {tr('theContinue')}
            </SessionButtonShiny>
          ) : null}
          <SessionButton
            {...proButtonProps}
            buttonColor={SessionButtonColor.Tertiary}
            onClick={onClose}
            dataTestId="modal-session-pro-cancel-button"
            style={
              !hasNoProAndNotGroupCta
                ? { ...proButtonProps.style, width: '50%' }
                : proButtonProps.style
            }
          >
            {tr(!hasNoProAndNotGroupCta ? 'close' : 'cancel')}
          </SessionButton>
        </ModalActionsContainer>
      }
    >
      <SpacerSM />
      <StyledCTATitle reverseDirection={!hasNoProAndNotGroupCta}>
        {tr(isGroupCta ? 'proGroupActivated' : hasPro ? 'proActivated' : 'upgradeTo')}
        <ProIconButton iconSize={'huge'} dataTestId="invalid-data-testid" onClick={undefined} />
      </StyledCTATitle>
      <SpacerXL />
      <StyledContentContainer>
        <StyledScrollDescriptionContainer>
          {getDescription(props.variant)}
        </StyledScrollDescriptionContainer>
        {hasNoProAndNotGroupCta ? (
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
