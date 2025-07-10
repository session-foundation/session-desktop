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
import { SpacerLG, SpacerSM } from '../basic/Text';
import { SessionIcon } from '../icon';
import { LucideIcon } from '../icon/LucideIcon';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';
import { Localizer } from '../basic/Localizer';
import { localize, type MergedLocalizerTokens } from '../../localization/localeTools';
import { FileIcon } from '../icon/FileIcon';
import { useFeatureFlag } from '../../state/ducks/types/releasedFeaturesReduxTypes';
import { SessionButtonShiny } from '../basic/SessionButtonShiny';

export enum SessionProInfoVariant {
  MESSAGE_CHARACTER_LIMIT = 0,
  PROFILE_PICTURE_ANIMATED = 1,
}

const StyledContentContainer = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: var(--margins-lg);
  gap: var(--margins-sm);
`;

const StyledScrollDescriptionContainer = styled.div`
  text-align: center;
  font-size: var(--font-size-lg);
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

// TODO: implement with animated profile pictures
// const StyledAnimationImage = styled.img`
//   position: absolute;
//   width: 100%;
//   height: 100%;
//   inset-inline-start: 0;
// `;
//
// const StyledAnimatedCTAImageContainer = styled.div`
//   position: relative;
// `;
//
// function AnimatedCTAImage({
//   ctaLayerSrc,
//   animatedLayerSrc,
// }: {
//   ctaLayerSrc: string;
//   animatedLayerSrc: string;
// }) {
//   return (
//     <StyledAnimatedCTAImageContainer>
//       <StyledCTAImage src={ctaLayerSrc} />
//       <StyledAnimationImage src={animatedLayerSrc} />
//     </StyledAnimatedCTAImageContainer>
//   );
// }

const StyledCTATitle = styled.span`
  font-size: var(--font-size-h4);
  font-weight: bold;
  line-height: normal;
  display: inline-flex;
  flex-direction: row;
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

function getFeatureList(variant: SessionProInfoVariant): Array<MergedLocalizerTokens> {
  switch (variant) {
    default:
      return ['proFeatureListLongerMessages', 'proFeatureListLargerGroups'];
  }
}

function getDescription(variant: SessionProInfoVariant): ReactNode {
  switch (variant) {
    case SessionProInfoVariant.MESSAGE_CHARACTER_LIMIT:
      return <Localizer token="proCallToActionLongerMessages" />;
    default:
      throw new Error('Invalid Variant');
  }
}

function getImage(variant: SessionProInfoVariant): ReactNode {
  switch (variant) {
    case SessionProInfoVariant.MESSAGE_CHARACTER_LIMIT:
      return <StyledCTAImage src="images/cta_hero_char_limit.webp" />;

    // TODO: implement with animated profile pictures
    // case SessionProInfoVariant.PROFILE_PICTURE_ANIMATED:
    //   return (
    //     <AnimatedCTAImage
    //       ctaLayerSrc="images/cta_hero_generic.webp"
    //       animatedLayerSrc="images/cta_hero_dog_animated.webp"
    //     />
    //   );

    default:
      throw new Error('Invalid Variant');
  }
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

  function onClose() {
    dispatch(updateSessionProInfoModal(null));
  }

  if (isNil(props?.variant)) {
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
            gridTemplateColumns: '1fr 1fr',
            columnGap: 'var(--margins-sm)',
            paddingBottom: 'var(--margins-md)',
            paddingInline: 'var(--margins-md)',
            height: 'unset',
          }}
        >
          <SessionButtonShiny
            {...buttonProps}
            shinyContainerStyle={{
              width: '100%',
            }}
            buttonColor={SessionButtonColor.Primary}
            onClick={onClose}
            dataTestId="modal-session-pro-confirm-button"
          >
            {localize('theContinue')}
          </SessionButtonShiny>
          <SessionButton
            {...buttonProps}
            buttonColor={SessionButtonColor.Tertiary}
            onClick={onClose}
            dataTestId="modal-session-pro-cancel-button"
          >
            {localize('cancel').toString()}
          </SessionButton>
        </ModalActionsContainer>
      }
    >
      <SpacerSM />
      <StyledCTATitle>
        {localize('upgradeTo')}
        <SessionIcon
          sizeIsWidth={false}
          iconType={'sessionPro'}
          iconSize={'huge'}
          backgroundColor={'var(--primary-color)'}
          borderRadius={'6px'}
          iconColor={'var(--black-color)'}
        />
      </StyledCTATitle>
      <SpacerLG />
      <StyledContentContainer>
        <StyledScrollDescriptionContainer>
          {getDescription(props.variant)}
        </StyledScrollDescriptionContainer>
        <StyledFeatureList>
          {getFeatureList(props.variant).map(token => (
            <FeatureListItem>{localize(token)}</FeatureListItem>
          ))}
          <FeatureListItem customIconSrc={'images/sparkle-animated.svg'}>
            {localize('proFeatureListLoadsMore')}
          </FeatureListItem>
        </StyledFeatureList>
      </StyledContentContainer>
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
  const isProAvailable = useFeatureFlag('proAvailable');
  const mockHasPro = useFeatureFlag('mockUserHasPro');

  // TODO: get pro status from store once available
  const hasPro = mockHasPro;

  if (!isProAvailable || hasPro) {
    return () => null;
  }

  return () => showSessionProInfoDialog(variant, dispatch);
};
