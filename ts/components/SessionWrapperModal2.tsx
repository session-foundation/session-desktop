import styled from 'styled-components';
import clsx from 'clsx';
import { ReactNode, useState, useRef } from 'react';
import useKey from 'react-use/lib/useKey';
import { Flex } from './basic/Flex';
import { SpacerXL } from './basic/Text';
import { SessionIconButton } from './icon';
import { SessionIconButtonProps } from './icon/SessionIconButton';
import { SessionFocusTrap } from './SessionFocusTrap';
import { useHTMLDirection } from '../util/i18n/rtlSupport';
import { StyledRootDialog } from './dialog/StyledRootDialog';

const DEFAULT_MODAL_WIDTH = '410px';

const StyledModalHeader = styled(Flex)`
  font-family: var(--font-default);
  font-size: var(--font-size-xl);
  font-weight: 500;
  text-align: center;
  line-height: 18px;
`;

const StyledModal = styled.div<{
  scrolled: boolean;
  contentMaxWidth?: string;
  $contentMinWidth?: string;
  padding?: string;
  border: boolean;
}>`
  animation: fadein var(--default-duration);
  z-index: 150;
  max-height: 90vh;
  max-width: ${props => (props.contentMaxWidth ? props.contentMaxWidth : DEFAULT_MODAL_WIDTH)};
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
    props.padding ? props.padding : '0  var(--margins-md) var(--margins-sm) var(--margins-lg)'};

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

  ${StyledModalHeader} {
    // marking those transparent so we don't have layout shift on scroll
    margin-bottom: var(--margins-xs);
    border-bottom: 1px solid var(--transparent-color);
    box-shadow: 0px 0px 20px 8px var(--transparent-color);

    ${props =>
      props.scrolled &&
      `border-bottom: 1px solid var(--border-color); box-shadow: 0px 0px 20px 8px var(--modal-shadow-color);`};
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

const StyledTitle = styled.div`
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  padding: var(--margins-xs) var(--margins-sm);
`;

export const ButtonChildrenContainer = (props: { children: ReactNode }) => {
  return (
    <Flex
      $container={true}
      width={'100%'}
      $justifyContent="center"
      $alignItems="center"
      $flexGap="var(--margins-md)"
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
  headerIconButtons?: Array<Omit<SessionIconButtonProps, 'iconSize'>>;
  children: ReactNode;
  buttonChildren?: ReactNode;
  contentMaxWidth?: string;
  $contentMinWidth?: string;
  contentBorder?: boolean;
  shouldOverflow?: boolean;
  padding?: string;
  classes?: string;
  allowOutsideClick?: boolean;
};

const ModalHeader = (
  props: Pick<SessionWrapperModalType2, 'showExitIcon' | 'onClose' | 'headerIconButtons' | 'title'>
) => {
  const { showExitIcon, headerIconButtons, title, onClose } = props;
  const htmlDirection = useHTMLDirection();

  return (
    <StyledModalHeader
      dir={htmlDirection}
      $container={true}
      $flexDirection={'row'}
      $justifyContent={'space-between'}
      $alignItems={'center'}
      padding={'var(--margins-lg) var(--margins-sm)  var(--margins-sm) var(--margins-lg)'}
      margin={'0 calc(-1 * var(--margins-md)) 0 calc(-1 * var(--margins-lg))'}
    >
      <Flex
        $container={true}
        $flexDirection={'row'}
        $alignItems={'center'}
        padding={'0'}
        margin={'0'}
      >
        {headerIconButtons?.length ? (
          headerIconButtons.map(iconItem => {
            return (
              <SessionIconButton
                key={iconItem.iconType}
                iconType={iconItem.iconType}
                iconSize={'medium'}
                iconRotation={iconItem.iconRotation}
                rotateDuration={iconItem.rotateDuration}
                onClick={iconItem.onClick}
                padding={'0'}
                margin={'0'}
                disabled={iconItem.disabled}
                dataTestId={iconItem.dataTestId}
                dataTestIdIcon={iconItem.dataTestIdIcon}
              />
            );
          })
        ) : showExitIcon ? (
          <SpacerXL />
        ) : null}
      </Flex>
      <StyledTitle
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
          <SessionIconButton
            iconType="exit"
            iconSize="small"
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
    contentMaxWidth,
    contentBorder = true,
    shouldOverflow = false,
    padding,
    classes,
    allowOutsideClick,
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
    <SessionFocusTrap allowOutsideClick={allowOutsideClick}>
      <StyledRootDialog
        shouldOverflow={shouldOverflow}
        className={clsx('modal', classes)}
        onMouseDown={handleClick}
        role="dialog"
      >
        <StyledModal
          ref={modalRef}
          contentMaxWidth={contentMaxWidth}
          $contentMinWidth={$contentMinWidth}
          scrolled={scrolled}
          padding={padding}
          border={contentBorder}
        >
          {showHeader ? (
            <ModalHeader
              showExitIcon={showExitIcon}
              headerIconButtons={headerIconButtons}
              title={title}
              onClose={onClose}
            />
          ) : null}

          <StyledModalBody
            onScroll={event => {
              handleScroll(event);
            }}
            shouldOverflow={shouldOverflow}
          >
            <div className="session-modal__centered">
              {props.children}
              {props.buttonChildren}
            </div>
          </StyledModalBody>
        </StyledModal>
      </StyledRootDialog>
    </SessionFocusTrap>
  );
};
