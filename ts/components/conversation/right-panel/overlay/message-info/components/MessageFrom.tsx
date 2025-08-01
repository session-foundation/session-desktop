import styled from 'styled-components';
import { MessageInfoLabel } from '.';
import { useConversationUsernameWithFallback } from '../../../../../../hooks/useParamSelector';
import { isDevProd } from '../../../../../../shared/env_vars';
import { Avatar, AvatarSize, CrownIcon } from '../../../../../avatar/Avatar';
import { Flex } from '../../../../../basic/Flex';
import { CopyToClipboardIcon } from '../../../../../buttons';
import { tr } from '../../../../../../localization/localeTools';

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

const Name = styled.span`
  font-weight: bold;
`;

const Pubkey = styled.span`
  font-family: var(--font-mono);
  font-size: var(--font-size-md);
  user-select: text;
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
  const from = tr('from');

  const isDev = isDevProd();

  return (
    <StyledMessageInfoAuthor>
      <Flex $container={true} $justifyContent="flex-start" $alignItems="flex-start">
        <MessageInfoLabel>{from}</MessageInfoLabel>
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
          <Avatar size={AvatarSize.M} pubkey={sender} onAvatarClick={undefined} />
          {isSenderAdmin ? <CrownIcon /> : null}
        </StyledAvatar>
        <StyledAuthorNamesContainer>
          {!!profileName && <Name>{profileName}</Name>}
          <Pubkey>{sender}</Pubkey>
        </StyledAuthorNamesContainer>
      </StyledFromContainer>
    </StyledMessageInfoAuthor>
  );
};
