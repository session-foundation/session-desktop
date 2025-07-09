/* eslint-disable no-unneeded-ternary */
import { AnimatePresence } from 'framer-motion';
import styled from 'styled-components';
import clsx from 'clsx';
import type { CSSProperties } from 'styled-components';
import { ReactNode, useState, useRef, type SessionDataTestId } from 'react';
import useKey from 'react-use/lib/useKey';
import { Flex } from './basic/Flex';
import { SpacerLG, SpacerXL } from './basic/Text';
import { SessionLucideIconButton } from './icon/SessionIconButton';
import { SessionFocusTrap } from './SessionFocusTrap';
import { useHTMLDirection } from '../util/i18n/rtlSupport';
import { StyledRootDialog } from './dialog/StyledRootDialog';
import { LUCIDE_ICONS_UNICODE } from './icon/lucide';
import { IsModalScrolledContext, useIsModalScrolled } from '../contexts/IsModalScrolledContext';
import { OnModalCloseContext, useOnModalClose } from '../contexts/OnModalCloseContext';

const StyledModalHeader = styled(Flex)<{ bigHeader?: boolean; scrolled: boolean }>`
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
  normal = '410px',
  wide = '500px',
  debug = '75%',
}

const StyledModal = styled.div<{
  $contentMaxWidth?: WrapperModalWidth;
  $contentMinWidth?: WrapperModalWidth;
  padding?: string;
}>`
  animation: fadein var(--default-duration);
  z-index: 150;
  max-height: 90vh;
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
    props.padding
      ? props.padding
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
  style = {},
}: {
  children: ReactNode;
  style?: CSSProperties;
}) => {
  return (
    <Flex
      $container={true}
      width={'100%'}
      $justifyContent="space-evenly"
      maxWidth="300px"
      $alignItems="center"
      $flexGap="var(--margins-md)"
      height="50px"
      style={{ justifySelf: 'center', ...style }}
      data-testid="modal-actions-container"
    >
      {children}
    </Flex>
  );
};

export type SessionWrapperModalType2 = {
  headerChildren: ReactNode | null;
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
  style?: Omit<CSSProperties, 'maxWidth' | 'minWidth' | 'padding' | 'border'>;
};

/**
 * A basic modal header with a title, an optional left button and/or exit icon.
 * To be used as `headerChildren` prop as part of SessionWrapperModal2.
 */
export const BasicModalHeader = (props: {
  title?: ReactNode;
  showExitIcon?: boolean;
  leftButton?: ReactNode;
  bigHeader?: boolean;
  modalHeaderDataTestId?: SessionDataTestId;
}) => {
  const { showExitIcon, leftButton, title, bigHeader, modalHeaderDataTestId } = props;
  const htmlDirection = useHTMLDirection();

  const onClose = useOnModalClose();
  const scrolled = useIsModalScrolled();

  return (
    <StyledModalHeader
      data-testid={modalHeaderDataTestId}
      dir={htmlDirection}
      $container={true}
      $flexDirection={'row'}
      $justifyContent={'space-between'}
      $alignItems={'center'}
      padding={'var(--margins-lg) var(--margins-sm)  var(--margins-sm) var(--margins-lg)'}
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
        {/* Note: add a spacer if no left button is set but we have an exit icon */}
        {leftButton ? leftButton : showExitIcon ? <SpacerXL /> : null}
      </Flex>
      <StyledTitle
        bigHeader={bigHeader}
        tabIndex={!showExitIcon && !leftButton ? 0 : undefined}
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
        {showExitIcon ? (
          <SessionLucideIconButton
            unicode={LUCIDE_ICONS_UNICODE.X}
            iconSize={'medium'}
            onClick={onClose ?? undefined}
            padding={'0 var(--margins-xs) 0 var(--margins-xs)'}
            margin={'0'}
            dataTestId="modal-close-button"
          />
        ) : null}
      </Flex>
    </StyledModalHeader>
  );
};

/**
 * A generic modal component that is constructed from a provided header, body and some actions.
 *
 *
 */
export const SessionWrapperModal2 = (
  props: SessionWrapperModalType2 & { onClose?: () => void }
) => {
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
  } = props;

  const [scrolled, setScrolled] = useState(false);

  useKey(
    'Esc',
    _event => {
      onClose?.();
    },
    undefined,
    [onClose]
  );

  useKey(
    'Escape',
    _event => {
      onClose?.();
    },
    undefined,
    [onClose]
  );

  const modalRef = useRef<HTMLDivElement>(null);

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
    <AnimatePresence>
      <SessionFocusTrap allowOutsideClick={allowOutsideClick}>
        <IsModalScrolledContext.Provider value={scrolled}>
          <OnModalCloseContext.Provider value={onClose ?? null}>
            <StyledRootDialog
              shouldOverflow={shouldOverflow}
              className={clsx('modal', classes)}
              onMouseDown={handleClick}
              role="dialog"
              data-testid={modalDataTestId}
            >
              <StyledModal
                ref={modalRef}
                $contentMaxWidth={$contentMaxWidth}
                $contentMinWidth={$contentMinWidth}
                padding={padding}
                style={style}
              >
                {props.headerChildren ? props.headerChildren : null}

                <StyledModalBody
                  onScroll={event => {
                    handleScroll(event);
                  }}
                  shouldOverflow={shouldOverflow}
                  removeScrollbarGutter={removeScrollbarGutter}
                >
                  <Flex
                    $container={true}
                    $alignItems="center"
                    $flexDirection="column"
                    paddingInline="var(--margins-lg)" // add the padding here so that the rest of the modal isn't affected (including buttonChildren/ModalHeader)
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
    </AnimatePresence>
  );
};
