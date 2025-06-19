import { ReactNode, useRef } from 'react';
import useKey from 'react-use/lib/useKey';
import { clsx } from 'clsx';
import styled from 'styled-components';

import { SessionButton, SessionButtonColor, SessionButtonType } from './basic/SessionButton';
import { StyledRootDialog } from './dialog/StyledRootDialog';
import { SessionFocusTrap } from './SessionFocusTrap';
import { Flex } from './basic/Flex';
import { SpacerXL } from './basic/Text';
import { SessionLucideIconButton } from './icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from './icon/lucide';

const StyledTitle = styled.div`
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  padding: 0 var(--margins-sm);
`;

export type SessionWrapperModalType = {
  title?: string;
  showHeader?: boolean;
  onConfirm?: () => void;
  onClose?: (event?: KeyboardEvent) => void;
  showClose?: boolean;
  confirmText?: string;
  cancelText?: string;
  showExitIcon?: boolean;
  headerIconButtons?: Array<React.ReactNode>;
  children: ReactNode;
  headerReverse?: boolean;
  additionalClassName?: string;
};

export const SessionWrapperModal = (props: SessionWrapperModalType) => {
  const {
    title,
    onConfirm,
    onClose,
    showHeader = true,
    showClose = false,
    confirmText,
    cancelText,
    showExitIcon,
    headerIconButtons,
    headerReverse,
    additionalClassName,
  } = props;

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

  return (
    <SessionFocusTrap>
      <StyledRootDialog
        shouldOverflow={true}
        className={clsx('loki-dialog modal', additionalClassName || null)}
        onClick={handleClick}
        role="dialog"
      >
        <div className="session-confirm-wrapper">
          <div ref={modalRef} className="session-modal">
            {showHeader ? (
              <Flex
                $container={true}
                $flexDirection={headerReverse ? 'row-reverse' : 'row'}
                $justifyContent={'space-between'}
                $alignItems={'center'}
                padding={'var(--margins-lg)'}
                className={'session-modal__header'}
              >
                <Flex
                  $container={true}
                  $flexDirection={headerReverse ? 'row-reverse' : 'row'}
                  $alignItems={'center'}
                  padding={'0'}
                  margin={'0'}
                  className={'session-modal__header__close'}
                >
                  {showExitIcon ? (
                    <SessionLucideIconButton
                      unicode={LUCIDE_ICONS_UNICODE.X}
                      iconSize="medium"
                      onClick={() => {
                        props.onClose?.();
                      }}
                      padding={'5px'}
                      margin={'0'}
                      dataTestId="modal-close-button"
                    />
                  ) : null}
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
                </Flex>
                <StyledTitle className="session-modal__header__title" data-testid="modal-heading">
                  {title}
                </StyledTitle>
                <Flex
                  $container={true}
                  $flexDirection={headerReverse ? 'row-reverse' : 'row'}
                  $alignItems={'center'}
                  padding={'0'}
                  margin={'0'}
                >
                  {headerIconButtons?.length ? (
                    headerIconButtons
                  ) : showExitIcon ? (
                    <SpacerXL />
                  ) : null}
                </Flex>
              </Flex>
            ) : null}

            <div className="session-modal__body">
              <div className="session-modal__centered">
                {props.children}

                <div className="session-modal__button-group">
                  {onConfirm ? (
                    <SessionButton buttonType={SessionButtonType.Simple} onClick={props.onConfirm}>
                      {confirmText || window.i18n('okay')}
                    </SessionButton>
                  ) : null}
                  {onClose && showClose ? (
                    <SessionButton
                      buttonType={SessionButtonType.Simple}
                      buttonColor={SessionButtonColor.Danger}
                      onClick={props.onClose}
                    >
                      {cancelText || window.i18n('close')}
                    </SessionButton>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </StyledRootDialog>
    </SessionFocusTrap>
  );
};
