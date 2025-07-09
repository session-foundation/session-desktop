import { ReactNode, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import useKey from 'react-use/lib/useKey';
import { useLastMessage } from '../../hooks/useParamSelector';
import { updateConversationInteractionState } from '../../interactions/conversationInteractions';
import { ConversationInteractionStatus } from '../../interactions/types';
import { updateConfirmModal } from '../../state/ducks/modalDialog';
import { ButtonChildrenContainer, SessionWrapperModal2 } from '../SessionWrapperModal2';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SessionRadioGroup, SessionRadioItems } from '../basic/SessionRadioGroup';
import type { LocalizerProps } from '../basic/Localizer';
import { SessionSpinner } from '../loading';
import { ModalDescription } from './shared/ModalDescriptionContainer';

export interface SessionConfirmDialogProps {
  children?: ReactNode;
  i18nMessage?: LocalizerProps;
  title?: string;
  radioOptions?: SessionRadioItems;
  onOk?: any;
  onClose?: any;
  closeAfterInput?: boolean;
  contentMaxWidth?: string;
  contentMinWidth?: string;

  /**
   * function to run on ok click. Closes modal after execution by default
   * sometimes the callback might need arguments when using radioOptions
   */
  onClickOk?: (...args: Array<any>) => Promise<void> | void;

  onClickClose?: () => any;

  /**
   * function to run on close click. Closes modal after execution by default
   */
  onClickCancel?: () => any;

  okText?: string;
  cancelText?: string;
  hideCancel?: boolean;
  okTheme?: SessionButtonColor;
  /**
   * Theme for the close button. If an okayTheme is provided, this theme will be ignored
   */
  closeTheme?: SessionButtonColor;
  showExitIcon?: boolean | undefined;
  conversationId?: string;
}

export const SessionConfirm = (props: SessionConfirmDialogProps) => {
  const dispatch = useDispatch();
  const {
    children,
    title = '',
    i18nMessage,
    radioOptions,
    okTheme,
    closeTheme = SessionButtonColor.Danger,
    onClickOk,
    onClickClose,
    hideCancel = false,
    onClickCancel,
    showExitIcon,
    closeAfterInput = true,
    conversationId,
    contentMaxWidth,
    contentMinWidth,
  } = props;

  const lastMessage = useLastMessage(conversationId);

  const [isLoading, setIsLoading] = useState(false);
  const [chosenOption, setChosenOption] = useState(
    radioOptions?.length ? radioOptions[0].value : ''
  );

  const okText = props.okText || window.i18n('okay');
  const cancelText = props.cancelText || window.i18n('cancel');
  const showHeader = !!props.title;

  const onClickOkHandler = async () => {
    if (onClickOk) {
      setIsLoading(true);
      try {
        await onClickOk(chosenOption !== '' ? chosenOption : undefined);
      } catch (e) {
        window.log.warn(e);
      } finally {
        setIsLoading(false);
      }
    }

    if (closeAfterInput) {
      dispatch(updateConfirmModal(null));
    }
  };

  useKey('Enter', () => {
    void onClickOkHandler();
  });

  useKey('Escape', () => {
    onClickCancelHandler();
  });

  useEffect(() => {
    if (isLoading) {
      if (conversationId && lastMessage?.interactionType) {
        void updateConversationInteractionState({
          conversationId,
          type: lastMessage?.interactionType,
          status: ConversationInteractionStatus.Loading,
        });
      }
    }
  }, [isLoading, conversationId, lastMessage?.interactionType]);

  /**
   * Performs specified on close action then removes the modal.
   */
  const onClickCancelHandler = () => {
    onClickCancel?.();
    onClickClose?.();
    window.inboxStore?.dispatch(updateConfirmModal(null));
  };

  return (
    <SessionWrapperModal2
      title={title}
      onClose={onClickClose}
      showExitIcon={showExitIcon}
      showHeader={showHeader}
      $contentMaxWidth={contentMaxWidth}
      $contentMinWidth={contentMinWidth}
      buttonChildren={
        <ButtonChildrenContainer>
          <SessionButton
            text={okText}
            buttonColor={okTheme}
            buttonType={SessionButtonType.Simple}
            fontWeight={500}
            onClick={onClickOkHandler}
            margin={'var(--margins-xs)'}
            dataTestId="session-confirm-ok-button"
          />
          {!hideCancel && (
            <SessionButton
              text={cancelText}
              buttonColor={!okTheme ? closeTheme : undefined}
              buttonType={SessionButtonType.Simple}
              fontWeight={500}
              onClick={onClickCancelHandler}
              margin={'var(--margins-xs)'}
              dataTestId="session-confirm-cancel-button"
            />
          )}
        </ButtonChildrenContainer>
      }
    >
      {i18nMessage ? (
        <ModalDescription dataTestId="modal-description" localizerProps={i18nMessage} />
      ) : null}
      {radioOptions && chosenOption !== '' ? (
        <SessionRadioGroup
          group="session-confirm-radio-group"
          initialItem={chosenOption}
          items={radioOptions}
          onClick={value => {
            if (value) {
              setChosenOption(value);
            }
          }}
        />
      ) : null}
      {children}
      <SessionSpinner loading={isLoading} />
    </SessionWrapperModal2>
  );
};
