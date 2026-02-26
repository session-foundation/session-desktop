import { useEffect, useState } from 'react';
import { getAppDispatch } from '../../state/dispatch';
import { useLastMessage } from '../../hooks/useParamSelector';
import { updateConversationInteractionState } from '../../interactions/conversationInteractions';
import { ConversationInteractionStatus } from '../../interactions/types';
import { updateConfirmModal } from '../../state/ducks/modalDialog';
import {
  ModalBasicHeader,
  ModalActionsContainer,
  SessionWrapperModal,
} from '../SessionWrapperModal';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SessionRadioGroup, SessionRadioItems } from '../basic/SessionRadioGroup';
import { SessionSpinner } from '../loading';
import { ModalDescription } from './shared/ModalDescriptionContainer';
import { messageArgsToArgsOnly, tr, type TrArgs } from '../../localization/localeTools';
import { ModalFlexContainer } from './shared/ModalFlexContainer';
import { ModalWarning } from './shared/ModalWarning';

export type RadioOptions = { items: SessionRadioItems; defaultSelectedValue: string | undefined };

export type SessionConfirmDialogProps = {
  i18nMessage?: TrArgs;
  title?: TrArgs;
  /**
   * Warning message to display in the modal
   */
  warningMessage?: TrArgs;
  radioOptions?: RadioOptions;
  onClose?: any;

  /**
   * Callback to run on ok click. Closes modal after execution by default
   * If we have radioOptions rendered, the args will be the value of the selected radio option
   */
  onClickOk?: (chosenOptionValue?: string) => Promise<unknown> | unknown;

  onClickClose?: () => Promise<unknown> | unknown;

  /**
   * Callback to run on close click. Closes modal after execution by default
   */
  onClickCancel?: () => Promise<unknown> | unknown;

  okText: TrArgs;
  cancelText?: TrArgs;
  hideCancel?: boolean;
  okTheme?: SessionButtonColor;
  /**
   * Theme for the close button. If an okayTheme is provided, this theme will be ignored
   */
  closeTheme?: SessionButtonColor;
  showExitIcon?: boolean | undefined;
  conversationId?: string;
};

export const SessionConfirm = (props: SessionConfirmDialogProps) => {
  const {
    title,
    i18nMessage,
    radioOptions,
    okTheme,
    closeTheme = SessionButtonColor.Danger,
    onClickOk,
    onClickClose,
    hideCancel = false,
    onClickCancel,
    showExitIcon,
    conversationId,
  } = props;

  const dispatch = getAppDispatch();
  const lastMessage = useLastMessage(conversationId);

  const [isLoading, setIsLoading] = useState(false);

  const defaultSelectedOption = radioOptions?.defaultSelectedValue
    ? radioOptions?.items.find(item => item.value === radioOptions?.defaultSelectedValue)
    : undefined;

  const defaultSelectedIsDisabled = defaultSelectedOption?.disabled ?? false;
  const firstItemNotDisabled = radioOptions?.items.find(item => !item.disabled);

  const [chosenOption, setChosenOption] = useState<string | undefined>(
    // If a defaultSelected is provided and it is not disabled, use that.
    // Otherwise use the first item that is not disabled.
    //
    defaultSelectedOption && !defaultSelectedIsDisabled
      ? defaultSelectedOption.value
      : firstItemNotDisabled?.value
  );

  const cancelText = props.cancelText
    ? tr(props.cancelText.token, messageArgsToArgsOnly(props.cancelText))
    : tr('cancel');

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
      // all Confirm dialogs are expected to close on OK click.
      // If you need to show an error, use a custom dialog.
      dispatch(updateConfirmModal(null));
    }
  };

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
    void onClickCancel?.();
    void onClickClose?.();
    window.inboxStore?.dispatch(updateConfirmModal(null));
  };

  return (
    <SessionWrapperModal
      modalId="confirmModal"
      headerChildren={
        title ? (
          <ModalBasicHeader
            title={tr(title.token, messageArgsToArgsOnly(title))}
            showExitIcon={showExitIcon}
          />
        ) : null
      }
      onClose={() => {
        void onClickClose?.();
      }}
      buttonChildren={
        <ModalActionsContainer buttonType={SessionButtonType.Simple}>
          <SessionButton
            text={tr(props.okText.token, messageArgsToArgsOnly(props.okText))}
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
        </ModalActionsContainer>
      }
    >
      <ModalFlexContainer>
        {i18nMessage ? (
          <ModalDescription dataTestId="modal-description" localizerProps={i18nMessage} />
        ) : null}

        {props.warningMessage ? (
          <ModalWarning dataTestId="modal-warning" localizerProps={props.warningMessage} />
        ) : null}
        {!!radioOptions?.items.length && chosenOption !== '' ? (
          <SessionRadioGroup
            group="session-confirm-radio-group"
            initialItem={chosenOption ?? ''}
            items={radioOptions.items}
            onClick={value => {
              if (value) {
                setChosenOption(value);
              }
            }}
          />
        ) : null}
        <SessionSpinner $loading={isLoading} />
      </ModalFlexContainer>
    </SessionWrapperModal>
  );
};
