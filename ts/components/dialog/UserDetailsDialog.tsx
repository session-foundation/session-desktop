import { useState } from 'react';

import useKey from 'react-use/lib/useKey';
import { ConvoHub } from '../../session/conversations';
import { openConversationWithMessages } from '../../state/ducks/conversations';
import { updateUserDetailsModal, UserDetailsModalState } from '../../state/ducks/modalDialog';
import { Avatar, AvatarSize } from '../avatar/Avatar';
import { SessionButton, SessionButtonType } from '../basic/SessionButton';
import { SpacerLG } from '../basic/Text';
import { CopyToClipboardButton } from '../buttons/CopyToClipboardButton';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { ConversationTypeEnum } from '../../models/types';
import { Flex } from '../basic/Flex';
import { SessionIDNonEditable } from '../basic/YourSessionIDPill';

export const UserDetailsDialog = (props: UserDetailsModalState) => {
  const [isEnlargedImageShown, setIsEnlargedImageShown] = useState(false);

  const size = isEnlargedImageShown ? AvatarSize.HUGE : AvatarSize.XL;

  function closeDialog() {
    window.inboxStore?.dispatch(updateUserDetailsModal(null));
  }

  async function onClickStartConversation() {
    if (!props) {
      return;
    }
    const convo = ConvoHub.use().get(props.conversationId);

    const conversation = await ConvoHub.use().getOrCreateAndWait(
      convo.id,
      ConversationTypeEnum.PRIVATE
    );

    await openConversationWithMessages({ conversationKey: conversation.id, messageId: null });

    closeDialog();
  }

  useKey(
    'Enter',
    () => {
      void onClickStartConversation();
    },
    undefined,
    [props?.conversationId]
  );

  if (!props) {
    return null;
  }

  return (
    <SessionWrapperModal
      title={props.userName}
      onClose={closeDialog}
      showExitIcon={true}
      additionalClassName="user-details-dialog"
    >
      <div className="avatar-center">
        <div className="avatar-center-inner">
          <Avatar
            size={size}
            onAvatarClick={() => {
              setIsEnlargedImageShown(!isEnlargedImageShown);
            }}
            pubkey={props.conversationId}
          />
        </div>
      </div>
      <SpacerLG />
      <Flex $container={true} width={'100%'} $justifyContent="center" $alignItems="center">
        <SessionIDNonEditable dataTestId="invalid-data-testid" sessionId={props.conversationId} />
      </Flex>
      <SpacerLG />
      <div className="session-modal__button-group__center">
        <SessionButton
          text={window.i18n('conversationsNew')}
          buttonType={SessionButtonType.Simple}
          onClick={onClickStartConversation}
        />
        <CopyToClipboardButton
          copyContent={props.conversationId}
          buttonType={SessionButtonType.Simple}
          hotkey={true}
        />
      </div>
    </SessionWrapperModal>
  );
};
