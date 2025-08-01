import styled from 'styled-components';
import { MessageInfoLabel } from '.';
import { useConversationUsernameWithFallback } from '../../../../../../hooks/useParamSelector';
import { isDevProd } from '../../../../../../shared/env_vars';
import { Avatar, AvatarSize, CrownIcon } from '../../../../../avatar/Avatar';
import { Flex } from '../../../../../basic/Flex';
import { CopyToClipboardIcon } from '../../../../../buttons';
import { tr } from '../../../../../../localization/localeTools';
import { ContactName } from '../../../../ContactName/ContactName';
import { useSelectedConversationKey } from '../../../../../../state/selectors/selectedConversation';
import { useShowUserDetailsCbFromConversation } from '../../../../../menuAndSettingsHooks/useShowUserDetailsCb';
import { PubKey } from '../../../../../../session/types';

const StyledFromContainer = styled.div`
  display: flex;
  gap: var(--margins-lg);
  align-items: center;
  padding: var(--margins-xs) var(--margins-xs) var(--margins-xs) 0;
`;

const StyledAuthorNamesContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

const StyledPubkey = styled.span<{ $isBlinded: boolean }>`
  font-family: var(--font-mono);
  font-size: var(--font-size-md);
  user-select: none; // if the account id can be copied, there will be a "copy account id" menu item
  color: ${props =>
    props.$isBlinded ? 'var(--text-secondary-color)' : 'var(--text-primary-color)'};
  cursor: pointer;
`;

const StyledMessageInfoAuthor = styled.div`
  font-size: var(--font-size-lg);
`;

const StyledAvatar = styled.div`
  position: relative;
`;

export const MessageFrom = (props: { sender: string; isSenderAdmin: boolean }) => {
  const { sender, isSenderAdmin } = props;
  const profileName = useConversationUsernameWithFallback(true, sender);

  const isDev = isDevProd();

  const selectedConvoId = useSelectedConversationKey();

  const showUserProfileModalCb = useShowUserDetailsCbFromConversation(sender) ?? undefined;

  return (
    <StyledMessageInfoAuthor>
      <Flex $container={true} $justifyContent="flex-start" $alignItems="flex-start">
        <MessageInfoLabel>{tr('from')}</MessageInfoLabel>
        {isDev ? (
          <CopyToClipboardIcon
            iconSize={'small'}
            copyContent={`${profileName} ${sender}`}
            margin={'0 0 0 var(--margins-xs)'}
          />
        ) : null}
      </Flex>
      <StyledFromContainer>
        <StyledAvatar>
          <Avatar size={AvatarSize.M} pubkey={sender} onAvatarClick={showUserProfileModalCb} />
          {isSenderAdmin ? <CrownIcon /> : null}
        </StyledAvatar>
        <StyledAuthorNamesContainer>
          <ContactName
            pubkey={sender}
            conversationId={selectedConvoId}
            contactNameContext="message-info-author"
          />
          <StyledPubkey onClick={showUserProfileModalCb} $isBlinded={PubKey.isBlinded(sender)}>
            {sender}
          </StyledPubkey>
        </StyledAuthorNamesContainer>
      </StyledFromContainer>
    </StyledMessageInfoAuthor>
  );
};
