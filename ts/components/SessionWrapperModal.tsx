/* eslint-disable no-unneeded-ternary */
import styled from 'styled-components';
import useKey from 'react-use/lib/useKey';
import clsx from 'clsx';
import type { CSSProperties } from 'styled-components';
import { ReactNode, useState, useRef, type SessionDataTestId } from 'react';
import { Flex } from './basic/Flex';
import { SpacerLG } from './basic/Text';
import { SessionLucideIconButton } from './icon/SessionIconButton';
import { SessionFocusTrap } from './SessionFocusTrap';
import { useHTMLDirection } from '../util/i18n/rtlSupport';
import { StyledRootDialog } from './dialog/StyledRootDialog';
import { LUCIDE_ICONS_UNICODE } from './icon/lucide';
import { IsModalScrolledContext, useIsModalScrolled } from '../contexts/IsModalScrolledContext';
import { OnModalCloseContext, useOnModalClose } from '../contexts/OnModalCloseContext';
import { SessionButton, SessionButtonColor, SessionButtonType } from './basic/SessionButton';
import type { ModalId } from '../state/ducks/modalDialog';
import { useIsTopModal } from '../state/selectors/modal';

type WithExtraLeftButton = {
  /**
   * A button to be displayed on the left side of the header title.
   * If all you want is a close button, use showExitIcon instead.
   * Check other usages to use the correct icon size and styling.
   */
  extraLeftButton?: ReactNode;
};
type WithExtraRightButton = {
  /**
   * A button to be displayed on the right side of the header title.
   * Check other usages to use the correct icon size and styling.
   */
  extraRightButton?: ReactNode;
};
type WithShowExitIcon = { showExitIcon?: boolean };

const StyledModalHeader = styled(Flex)<{
  bigHeader?: boolean;
  scrolled: boolean;
}>`
  position: relative;
  font-family: var(--font-default);
  font-size: ${props => (props.bigHeader ? 'var(--font-size-h4)' : 'var(--font-size-xl)')};
  font-weight: 500;
  text-align: center;
  line-height: 18px;

  z-index: 3;

  &::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: -16px; // bottom and height have to match for the border to be correctly placed
    height: 16px; // bottom and height have to match for the border to be correctly placed
    width: 100%;
    ${props =>
      props.scrolled
        ? 'background: linear-gradient(to bottom, var(--modal-shadow-color), transparent)'
        : ''};
    pointer-events: none;
  }

  border-bottom: ${props =>
    props.scrolled ? '1px solid var(--border-color)' : '1px solid var(--transparent-color)'};
`;

export enum WrapperModalWidth {
  narrow = '350px',
  normal = '420px',
  wide = '500px',
  debug = '75%',
}

const StyledModal = styled.div<{
  $contentMaxWidth?: WrapperModalWidth;
  $contentMinWidth?: WrapperModalWidth;
  $padding?: string;
  $topAnchor: ModalTopAnchor;
}>`
  position: absolute;
  top: ${props => (props.$topAnchor === 'center' ? 'auto' : props.$topAnchor)};
  max-height: ${props =>
    `calc(100vh - ${props.$topAnchor === 'center' ? '' : `2 * ${props.$topAnchor}`})`}; // 2* to have the modal centered vertically, if it overflows
  animation: fadein var(--default-duration);
  z-index: 150;
  max-width: ${props =>
    props.$contentMaxWidth ? props.$contentMaxWidth : WrapperModalWidth.normal};
  min-width: ${props =>
    props.$contentMinWidth ? props.$contentMinWidth : WrapperModalWidth.normal};
  box-sizing: border-box;
  font-family: var(--font-default);
  background-color: var(--modal-background-content-color);
  color: var(--modal-text-color);
  border: 1px solid var(--border-color);
  border-radius: 13px;
  box-shadow: var(--modal-drop-shadow);

  margin: auto auto;
  padding: ${props =>
    props.$padding
      ? props.$padding
      : // Note: no padding by default as it depends on what is rendered, see the ModalMap before you change something here
        '0'};

  overflow: hidden;
  display: flex;
  flex-direction: column;

  &__centered {
    display: flex;
    flex-direction: column;
    align-items: center;
    // to allow new lines
    white-space: pre-wrap;
  }

  &__text-highlight {
    @include text-highlight(var(--primary-color));

    color: var(--black-color);

    font-family: var(--font-mono);
    font-style: normal;
    font-size: var(--font-size-xs);
  }
`;

const StyledModalBody = styled.div<{ shouldOverflow: boolean; removeScrollbarGutter?: boolean }>`
  ${props => (!props.removeScrollbarGutter ? 'scrollbar-gutter: stable;' : '')}
  margin: 0;
  font-family: var(--font-default);
  line-height: var(--font-size-md);
  font-size: var(--font-size-md);
  height: 100%;
  overflow-y: ${props => (props.shouldOverflow ? 'auto' : 'hidden')};
  overflow-x: hidden;

  .message {
    text-align: center;
  }
`;

const StyledTitle = styled.div<{ bigHeader?: boolean }>`
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  padding: ${props =>
    props.bigHeader ? 'var(--margins-sm)' : 'var(--margins-xs) var(--margins-sm)'};
`;

export const ModalActionsContainer = ({
  children,
  maxWidth,
  style = {},
  buttonType,
}: {
  children: ReactNode;
  style?: CSSProperties;
  maxWidth?: string;
  /**
   * Depending on the button type, the margin block is different.
   */
  buttonType: SessionButtonType;
}) => {
  return (
    <Flex
      $container={true}
      width={'100%'}
      $justifyContent="space-evenly"
      maxWidth={maxWidth || '300px'}
      $alignItems="center"
      $flexGap="var(--margins-md)"
      height="unset"
      style={{
        justifySelf: 'center',
        marginBlock:
          buttonType === SessionButtonType.Simple ? 'var(--margins-sm)' : 'var(--margins-lg)',
        ...style,
      }}
      data-testid="modal-actions-container"
    >
      {children}
    </Flex>
  );
};

/**
 * In the modal, the bottom actions sometimes have a border.
 * When they do, they all share the same styling (minWidth --modal-actions-outline-min-width) so this component is here to reuse that logic.
 */
export function ModalBottomButtonWithBorder({
  text,
  onClick,
  buttonColor,
  dataTestId,
  buttonType,
  disabled,
}: {
  text: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  buttonColor?: SessionButtonColor;
  dataTestId?: SessionDataTestId;
  buttonType?: SessionButtonType;
}) {
  return (
    <SessionButton
      text={text}
      onClick={onClick}
      disabled={disabled}
      buttonColor={buttonColor}
      buttonType={buttonType}
      dataTestId={dataTestId}
      style={{ minWidth: 'var(--modal-actions-outline-min-width)' }}
    />
  );
}

export type ModalTopAnchor = '5vh' | 'center';

type SessionWrapperModalType = {
  headerChildren: ReactNode;
  children: ReactNode;
  /**
   * *Should* be some SessionButtons enclosed in a ModalActionsContainer
   */
  buttonChildren?: ReactNode;
  $contentMaxWidth?: WrapperModalWidth;
  $contentMinWidth?: WrapperModalWidth;
  shouldOverflow?: boolean;
  padding?: string;
  classes?: string;
  allowOutsideClick?: boolean;
  removeScrollbarGutter?: boolean;
  modalDataTestId?: SessionDataTestId;
  /**
   * Instead of centering the modal (and having layout shifts on height change), we can use this to anchor the modal to a % from the top of the screen.
   * Defaults to 'center' to keep the modal centered (should only be used for modals that doesn't have height changes)
   */
  topAnchor?: ModalTopAnchor;
  $flexGap?: string;
  style?: Omit<CSSProperties, 'maxWidth' | 'minWidth' | 'padding' | 'border'>;
  modalId: ModalId;
};

const useNeedsSpacerOnSide = ({
  extraLeftButton,
  extraRightButton,
  showExitIcon,
}: WithShowExitIcon & WithExtraRightButton & WithExtraLeftButton) => {
  const buttonsLeft = extraLeftButton ? 1 : 0;
  const buttonsRight = (extraRightButton ? 1 : 0) + (showExitIcon ? 1 : 0);
  const extraButtonsOnRightSide = buttonsRight - buttonsLeft;

  return {
    count: Math.abs(extraButtonsOnRightSide),
    side: extraButtonsOnRightSide === 0 ? 'none' : extraButtonsOnRightSide > 0 ? 'left' : 'right',
  };
};

function ExtraSpacerLeft(props: WithShowExitIcon & WithExtraRightButton & WithExtraLeftButton) {
  const extraOn = useNeedsSpacerOnSide(props);

  if (extraOn.side !== 'left' || extraOn.count === 0) {
    return null;
  }
  if (extraOn.count === 1) {
    return <SpacerLG />;
  }
  if (extraOn.count === 2) {
    return (
      <>
        <SpacerLG />
        <SpacerLG />
      </>
    );
  }
  throw new Error('ExtraSpacerLeft: not handled case for extraOn.count');
}

function ExtraSpacerRight(props: WithShowExitIcon & WithExtraRightButton & WithExtraLeftButton) {
  const extraOn = useNeedsSpacerOnSide(props);

  if (extraOn.side !== 'right' || extraOn.count === 0) {
    return null;
  }
  if (extraOn.count === 1) {
    return <SpacerLG />;
  }
  if (extraOn.count === 2) {
    return (
      <>
        <SpacerLG />
        <SpacerLG />
      </>
    );
  }
  throw new Error('ExtraSpacerRight: not handled case for extraOn.count');
}
/**
 * A basic modal header with a title, an optional left button and/or exit icon.
 * To be used as `headerChildren` prop as part of SessionWrapperModal.
 */
export const ModalBasicHeader = ({
  showExitIcon,
  extraLeftButton,
  title,
  bigHeader,
  modalHeaderDataTestId,
  extraRightButton,
}: WithShowExitIcon &
  WithExtraRightButton &
  WithExtraLeftButton & {
    title?: ReactNode;
    bigHeader?: boolean;
    modalHeaderDataTestId?: SessionDataTestId;
  }) => {
  const onClose = useOnModalClose();
  const scrolled = useIsModalScrolled();

  return (
    <StyledModalHeader
      data-testid={modalHeaderDataTestId}
      $container={true}
      $flexDirection={'row'}
      $justifyContent={'space-between'}
      $alignItems={'center'}
      padding={'var(--margins-lg) var(--margins-lg) var(--margins-sm) var(--margins-lg)'}
      bigHeader={bigHeader}
      scrolled={scrolled}
    >
      <Flex
        $container={true}
        $flexDirection={'row'}
        $alignItems={'center'}
        padding={'0'}
        margin={'0'}
      >
        {extraLeftButton}
        {/* Note: this is just here to keep the title centered, no matter the buttons we have */}
        <ExtraSpacerLeft
          showExitIcon={showExitIcon}
          extraLeftButton={extraLeftButton}
          extraRightButton={extraRightButton}
        />
      </Flex>
      <StyledTitle
        bigHeader={bigHeader}
        tabIndex={!showExitIcon && !extraLeftButton ? 0 : undefined}
        data-testid="modal-heading"
      >
        {title}
      </StyledTitle>
      <Flex
        $container={true}
        $flexDirection={'row'}
        $alignItems={'center'}
        padding={'0'}
        margin={'0'}
      >
        {/* Note: this is just here to keep the title centered, no matter the buttons we have */}
        <ExtraSpacerRight
          showExitIcon={showExitIcon}
          extraLeftButton={extraLeftButton}
          extraRightButton={extraRightButton}
        />
        {extraRightButton}
        {showExitIcon ? (
          <SessionLucideIconButton
            unicode={LUCIDE_ICONS_UNICODE.X}
            // don't ask me why, but the X icon on lucide has more padding than the others.
            // So we need to use one size bigger than the other icons we use on the header.
            iconSize={'huge'}
            onClick={onClose ?? undefined}
            padding={'0'}
            margin={'0 var(--margins-xs) 0 var(--margins-xs)'}
            dataTestId="modal-close-button"
            iconColor="var(--text-primary-color)"
          />
        ) : null}
      </Flex>
    </StyledModalHeader>
  );
};

/**
 * A generic modal component that is constructed from a provided header, body and some actions.
 */
export const SessionWrapperModal = (props: SessionWrapperModalType & { onClose?: () => void }) => {
  const {
    $contentMinWidth,
    $contentMaxWidth,
    shouldOverflow = false,
    padding,
    classes,
    allowOutsideClick,
    modalDataTestId,
    style,
    removeScrollbarGutter,
    onClose,
    topAnchor,
    $flexGap,
    modalId,
  } = props;

  const [scrolled, setScrolled] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const htmlDirection = useHTMLDirection();
  const isTopModal = useIsTopModal(modalId);

  useKey((event: KeyboardEvent) => {
    if (!isTopModal) {
      return false;
    }
    return event.key === 'Esc' || event.key === 'Escape';
  }, onClose);

  const handleClick = (e: any) => {
    if (!modalRef.current?.contains(e.target)) {
      onClose?.();
    }
  };

  const handleScroll = (e: any) => {
    const { scrollTop } = e.target;
    setScrolled(!!scrollTop);
  };

  return (
    <SessionFocusTrap allowOutsideClick={allowOutsideClick} initialFocus={() => modalRef.current}>
      <IsModalScrolledContext.Provider value={scrolled}>
        <OnModalCloseContext.Provider value={onClose ?? null}>
          <StyledRootDialog
            shouldOverflow={shouldOverflow}
            className={clsx('modal', classes)}
            onMouseDown={handleClick}
            role="dialog"
            data-testid={modalDataTestId}
            dir={htmlDirection}
          >
            <StyledModal
              $contentMaxWidth={$contentMaxWidth}
              $contentMinWidth={$contentMinWidth}
              $padding={padding}
              style={style}
              $topAnchor={topAnchor ?? 'center'}
              ref={modalRef}
              data-modal-id={modalId}
            >
              {props.headerChildren ? props.headerChildren : null}
              <StyledModalBody
                onScroll={handleScroll}
                shouldOverflow={shouldOverflow}
                removeScrollbarGutter={removeScrollbarGutter}
              >
                <Flex
                  $container={true}
                  $alignItems="center"
                  $flexDirection="column"
                  paddingInline="var(--margins-lg)" // add the padding here so that the rest of the modal isn't affected (including buttonChildren/ModalHeader)
                  $flexGap={$flexGap}
                >
                  {props.children}
                </Flex>
                {props.buttonChildren ? props.buttonChildren : <SpacerLG />}
              </StyledModalBody>
            </StyledModal>
          </StyledRootDialog>
        </OnModalCloseContext.Provider>
      </IsModalScrolledContext.Provider>
    </SessionFocusTrap>
  );
};
