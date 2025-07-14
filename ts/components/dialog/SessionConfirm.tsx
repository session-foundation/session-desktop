import { useDispatch } from 'react-redux';
import { useEffect, useState } from 'react';
import useKey from 'react-use/lib/useKey';
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
import type { LocalizerProps } from '../basic/Localizer';
import { SessionSpinner } from '../loading';
import { ModalDescription } from './shared/ModalDescriptionContainer';
import { tr } from '../../localization/localeTools';
import { ModalFlexContainer } from './shared/ModalFlexContainer';

export interface SessionConfirmDialogProps {
  i18nMessage?: LocalizerProps;
  title?: string;
  radioOptions?: SessionRadioItems;
  onOk?: any;
  onClose?: any;
  closeAfterInput?: boolean;

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

  okText: string;
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

  const dispatch = useDispatch();
  const lastMessage = useLastMessage(conversationId);

  const [isLoading, setIsLoading] = useState(false);
  const [chosenOption, setChosenOption] = useState(
    radioOptions?.length ? radioOptions[0].value : ''
  );

  const okText = props.okText;
  const cancelText = props.cancelText || tr('cancel');

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
    <SessionWrapperModal
      headerChildren={title ? <ModalBasicHeader title={title} showExitIcon={showExitIcon} /> : null}
      onClose={onClickClose}
      buttonChildren={
        <ModalActionsContainer>
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
        </ModalActionsContainer>
      }
    >
      <ModalFlexContainer>
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
        <SessionSpinner loading={isLoading} />
      </ModalFlexContainer>
    </SessionWrapperModal>
  );
};
