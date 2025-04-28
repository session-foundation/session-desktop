import { useDispatch } from 'react-redux';
import styled from 'styled-components';

import { closeRightPanel } from '../../../state/ducks/conversations';
import { resetRightOverlayMode } from '../../../state/ducks/section';
import { useSelectedDisplayNameInProfile } from '../../../state/selectors/selectedConversation';
import { Avatar, AvatarSize } from '../../avatar/Avatar';
import { Flex } from '../../basic/Flex';
import { Header } from '../../conversation/right-panel/overlay/components';
import type { WithConvoId } from '../../../session/types/with';
import { useIsMe, useIsPrivate } from '../../../hooks/useParamSelector';
import { PubKey } from '../../../session/types';
import { H4 } from '../../basic/Heading';
import { localize } from '../../../localization/localeTools';

function AccountId({ conversationId }: WithConvoId) {
  const isPrivate = useIsPrivate(conversationId);

  if (!isPrivate || PubKey.isBlinded(conversationId)) {
    return null;
  }
  return <StyledAccountId data-testid="account-id">{conversationId}</StyledAccountId>;
}

export const ConversationSettingsHeader = ({ conversationId }: WithConvoId) => {
  const dispatch = useDispatch();
  const displayNameInProfile = useSelectedDisplayNameInProfile();
  const isMe = useIsMe(conversationId);

  if (!conversationId) {
    return null;
  }

  return (
    <Header
      backButtonDirection="right"
      backButtonOnClick={() => {
        dispatch(closeRightPanel());
        dispatch(resetRightOverlayMode());
      }}
      hideCloseButton={true}
      hideBackButton={true}
      paddingTop="var(--margins-xs)"
    >
      <Flex
        $container={true}
        $justifyContent={'center'}
        $alignItems={'center'}
        width={'100%'}
        $flexDirection="column"
        $flexGap="var(--margins-lg)"
      >
        <Avatar size={AvatarSize.XL} pubkey={conversationId} dataTestId="profile-picture" />
        <H4 data-testid="display-name">
          {isMe ? localize('noteToSelf').toString() : displayNameInProfile}
        </H4>
        <AccountId conversationId={conversationId} />
      </Flex>
    </Header>
  );
};

const StyledAccountId = styled.div`
  font-family: var(--font-mono);
  font-weight: 400;
  font-size: var(--font-display-size-md);
  text-align: center;
  line-height: 1.2;
`;
