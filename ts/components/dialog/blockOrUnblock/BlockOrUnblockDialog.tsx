import { isEmpty } from 'lodash';
import { useCallback } from 'react';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import { getAppDispatch } from '../../../state/dispatch';
import { useConversationsNicknameRealNameOrShortenPubkey } from '../../../hooks/useParamSelector';
import { updateBlockOrUnblockModal } from '../../../state/ducks/modalDialog';
import { BlockedNumberController } from '../../../util';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../../basic/SessionButton';
import { ModalDescription } from '../shared/ModalDescriptionContainer';
import { BlockOrUnblockModalState } from './BlockOrUnblockModalState';
import { tr, type TrArgs } from '../../../localization/localeTools';
import {
  ModalBasicHeader,
  ModalActionsContainer,
  SessionWrapperModal,
} from '../../SessionWrapperModal';
import { ModalFlexContainer } from '../shared/ModalFlexContainer';

type ModalState = NonNullable<BlockOrUnblockModalState>;

function getUnblockTokenAndArgs(names: Array<string>): TrArgs {
  // multiple unblock is supported
  switch (names.length) {
    case 1:
      return { token: 'blockUnblockName', name: names[0] } as const;
    case 2:
      return { token: 'blockUnblockNameTwo', name: names[0] } as const;

    default:
      return {
        token: 'blockUnblockNameMultiple',
        name: names[0],
        count: names.length - 1,
      } as const;
  }
}

function useBlockUnblockI18nDescriptionArgs({
  action,
  pubkeys,
}: Pick<ModalState, 'action' | 'pubkeys'>): TrArgs {
  const names = useConversationsNicknameRealNameOrShortenPubkey(pubkeys);
  if (!pubkeys.length) {
    throw new Error('useI18nDescriptionArgsForAction called with empty list of pubkeys');
  }
  if (action === 'block') {
    if (pubkeys.length !== 1 || names.length !== 1) {
      throw new Error('we can only block a single user at a time');
    }
    return { token: 'blockDescription', name: names[0] } as const;
  }

  return getUnblockTokenAndArgs(names);
}

export const BlockOrUnblockDialog = ({ pubkeys, action, onConfirmed }: NonNullable<ModalState>) => {
  const dispatch = getAppDispatch();

  const localizedAction = action === 'block' ? tr('block') : tr('blockUnblock');

  const args = useBlockUnblockI18nDescriptionArgs({ action, pubkeys });

  const closeModal = useCallback(() => {
    dispatch(updateBlockOrUnblockModal(null));
  }, [dispatch]);

  const [, onConfirm] = useAsyncFn(async () => {
    if (action === 'block') {
      // we never block more than one user from the UI, so this is not very useful, just a type guard
      for (let index = 0; index < pubkeys.length; index++) {
        const pubkey = pubkeys[index];
        // TODO: make BlockedNumberController.block take an array and do the change in a single call.
        // eslint-disable-next-line no-await-in-loop
        await BlockedNumberController.block(pubkey);
      }
      // Note: we don't want to close the CS modal if it was shown, now.
      // Nor reset the conversation if it was shown.
    } else {
      await BlockedNumberController.unblockAll(pubkeys);
    }
    closeModal();
    onConfirmed?.();
  }, [action, onConfirmed, pubkeys]);

  if (isEmpty(pubkeys)) {
    closeModal();
    return null;
  }

  return (
    <SessionWrapperModal
      modalId="blockOrUnblockModal"
      headerChildren={<ModalBasicHeader title={localizedAction} />}
      onClose={closeModal}
      buttonChildren={
        <ModalActionsContainer buttonType={SessionButtonType.Simple}>
          <SessionButton
            buttonType={SessionButtonType.Simple}
            buttonColor={SessionButtonColor.Danger}
            onClick={onConfirm}
            text={localizedAction}
            dataTestId="session-confirm-ok-button"
          />
          <SessionButton
            buttonType={SessionButtonType.Simple}
            onClick={closeModal}
            text={tr('cancel')}
            dataTestId="session-confirm-cancel-button"
          />
        </ModalActionsContainer>
      }
    >
      <ModalFlexContainer>
        <ModalDescription dataTestId="modal-description" localizerProps={args} />
      </ModalFlexContainer>
    </SessionWrapperModal>
  );
};
