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

const DEFAULT_MODAL_WIDTH = '410px';

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

const StyledModal = styled.div<{
  $contentMaxWidth?: string;
  $contentMinWidth?: string;
  padding?: string;
  border: boolean;
  bigHeader?: boolean;
}>`
  animation: fadein var(--default-duration);
  z-index: 150;
  max-height: 90vh;
  max-width: ${props => (props.$contentMaxWidth ? props.$contentMaxWidth : DEFAULT_MODAL_WIDTH)};
  min-width: ${props => (props.$contentMinWidth ? props.$contentMinWidth : DEFAULT_MODAL_WIDTH)};
  box-sizing: border-box;
  font-family: var(--font-default);
  background-color: var(--modal-background-content-color);
  color: var(--modal-text-color);
  border: 1px solid ${props => (props.border ? 'var(--border-color)' : 'var(--transparent-color)')};
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

const StyledModalBody = styled.div<{ shouldOverflow: boolean }>`
  scrollbar-gutter: stable;
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

export const ButtonChildrenContainer = (props: { children: ReactNode }) => {
  return (
    <Flex
      $container={true}
      width={'100%'}
      $justifyContent="space-evenly"
      maxWidth="300px"
      $alignItems="center"
      $flexGap="var(--margins-md)"
      height="59px"
      style={{ justifySelf: 'center' }}
    >
      {props.children}
    </Flex>
  );
};

export type SessionWrapperModalType2 = {
  title?: string;
  showHeader?: boolean;
  onClose?: (event?: KeyboardEvent) => void;
  showExitIcon?: boolean;
  headerIconButtons?: Array<React.ReactNode>;
  children: ReactNode;
  /**
   * *Should* be some SessionButtons enclosed in a ButtonChildrenContainer
   */
  buttonChildren?: ReactNode;
  $contentMaxWidth?: string;
  $contentMinWidth?: string;
  contentBorder?: boolean;
  shouldOverflow?: boolean;
  padding?: string;
  classes?: string;
  allowOutsideClick?: boolean;
  bigHeader?: boolean;
  modalDataTestId?: SessionDataTestId;
  style?: Omit<CSSProperties, 'maxWidth' | 'minWidth' | 'padding' | 'border'>;
};

const ModalHeader = (
  props: Pick<
    SessionWrapperModalType2,
    'showExitIcon' | 'onClose' | 'headerIconButtons' | 'title' | 'bigHeader' | 'modalDataTestId'
  > & { scrolled: boolean }
) => {
  const { showExitIcon, headerIconButtons, title, onClose, bigHeader, modalDataTestId, scrolled } =
    props;
  const htmlDirection = useHTMLDirection();

  return (
    <StyledModalHeader
      dir={htmlDirection}
      $container={true}
      $flexDirection={'row'}
      $justifyContent={'space-between'}
      $alignItems={'center'}
      padding={'var(--margins-lg) var(--margins-sm)  var(--margins-sm) var(--margins-lg)'}
      bigHeader={bigHeader}
      data-testid={modalDataTestId}
      scrolled={scrolled}
    >
      <Flex
        $container={true}
        $flexDirection={'row'}
        $alignItems={'center'}
        padding={'0'}
        margin={'0'}
      >
        {headerIconButtons?.length ? headerIconButtons : showExitIcon ? <SpacerXL /> : null}
      </Flex>
      <StyledTitle
        bigHeader={bigHeader}
        tabIndex={!showExitIcon && !headerIconButtons?.length ? 0 : undefined}
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
        {headerIconButtons?.length
          ? headerIconButtons.map((_, index) => {
              const offset = showExitIcon
                ? headerIconButtons.length - 2
                : headerIconButtons.length - 1;
              if (index > offset) {
                return null;
              }
              return <SpacerXL key={`session-modal__header_space-${index}`} />;
            })
          : null}
        {showExitIcon ? (
          <SessionLucideIconButton
            unicode={LUCIDE_ICONS_UNICODE.X}
            iconSize={'medium'}
            onClick={() => {
              if (onClose) {
                onClose();
              }
            }}
            padding={'0 var(--margins-xs) 0 var(--margins-xs)'}
            margin={'0'}
            dataTestId="modal-close-button"
          />
        ) : null}
      </Flex>
    </StyledModalHeader>
  );
};

export const SessionWrapperModal2 = (props: SessionWrapperModalType2) => {
  const {
    title,
    onClose,
    showHeader = true,
    showExitIcon,
    headerIconButtons,
    $contentMinWidth,
    $contentMaxWidth,
    contentBorder = true,
    shouldOverflow = false,
    padding,
    classes,
    allowOutsideClick,
    bigHeader,
    modalDataTestId,
    style,
  } = props;

  const [scrolled, setScrolled] = useState(false);

  useKey(
    'Esc',
    event => {
      props.onClose?.(event);
    },
    undefined,
    [props.onClose]
  );

  useKey(
    'Escape',
    event => {
      props.onClose?.(event);
    },
    undefined,
    [props.onClose]
  );

  const modalRef = useRef<HTMLDivElement>(null);

  const handleClick = (e: any) => {
    if (!modalRef.current?.contains(e.target)) {
      props.onClose?.();
    }
  };

  const handleScroll = (e: any) => {
    const { scrollTop } = e.target;
    setScrolled(!!scrollTop);
  };

  return (
    <AnimatePresence>
      <SessionFocusTrap allowOutsideClick={allowOutsideClick}>
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
            border={contentBorder}
            bigHeader={bigHeader}
            style={style}
          >
            {showHeader ? (
              <ModalHeader
                showExitIcon={showExitIcon}
                headerIconButtons={headerIconButtons}
                title={title}
                onClose={onClose}
                bigHeader={bigHeader}
                scrolled={scrolled}
              />
            ) : null}

            <StyledModalBody
              onScroll={event => {
                handleScroll(event);
              }}
              shouldOverflow={shouldOverflow}
            >
              <Flex $container={true} $alignItems="center" $flexDirection="column">
                {props.children}
              </Flex>
              {props.buttonChildren ? props.buttonChildren : <SpacerLG />}
            </StyledModalBody>
          </StyledModal>
        </StyledRootDialog>
      </SessionFocusTrap>
    </AnimatePresence>
  );
};
