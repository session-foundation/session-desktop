import { useState } from 'react';
import styled from 'styled-components';
import { useIsDetailMessageView } from '../../../../contexts/isDetailViewContext';
import { useMessageReactsPropsById } from '../../../../hooks/useParamSelector';
import { MessageRenderingProps } from '../../../../models/messageType';
import { REACT_LIMIT } from '../../../../session/constants';
import { useSelectedIsGroupOrCommunity } from '../../../../state/selectors/selectedConversation';
import { nativeEmojiData } from '../../../../util/emoji';
import { Flex } from '../../../basic/Flex';
import { EMOJI_REACTION_HEIGHT, Reaction, ReactionProps } from '../reactions/Reaction';
import { Localizer } from '../../../basic/Localizer';
import { LucideIcon } from '../../../icon/LucideIcon';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';
import { createButtonOnKeyDownForClickEventHandler } from '../../../../util/keyboardShortcuts';

export const StyledMessageReactionsContainer = styled(Flex)<{
  $noAvatar: boolean;
}>`
  ${props => !props.$noAvatar && 'margin-inline-start: var(--width-avatar-group-msg-list);'}
`;

export const StyledMessageReactions = styled(Flex)<{ $fullWidth: boolean }>`
  ${props => (props.$fullWidth ? '' : 'max-width: 640px;')}
`;

const StyledReactionOverflow = styled.button`
  display: flex;
  flex-direction: row-reverse;
  justify-content: flex-start;
  align-items: center;

  border: none;
  margin-right: 4px;
  margin-bottom: var(--margins-sm);

  span {
    background-color: var(--message-bubble-incoming-background-color);
    border: var(--default-borders);
    border-radius: 50%;
    overflow: hidden;
    width: ${EMOJI_REACTION_HEIGHT}px;
    height: ${EMOJI_REACTION_HEIGHT}px;
    display: flex;
    justify-content: center;
    align-content: center;
    flex-wrap: wrap;
    margin-right: -9px;
  }
`;

const StyledReadLess = styled.span`
  font-size: var(--font-size-xs);
  margin-top: 8px;
  cursor: pointer;
`;

type ReactionsProps = Omit<ReactionProps, 'emoji'>;

const Reactions = (props: ReactionsProps) => {
  const { messageId, reactions, inModal } = props;
  return (
    <StyledMessageReactions
      $container={true}
      $flexWrap={inModal ? 'nowrap' : 'wrap'}
      $alignItems={'center'}
      $fullWidth={inModal}
    >
      {reactions.map(([emoji]) => (
        <Reaction key={`${messageId}-${emoji}`} emoji={emoji} {...props} />
      ))}
    </StyledMessageReactions>
  );
};

interface ExpandReactionsProps extends ReactionsProps {
  handleExpand: () => void;
}

const CompressedReactions = (props: ExpandReactionsProps) => {
  const { messageId, reactions, inModal, handleExpand } = props;
  const onKeyDown = createButtonOnKeyDownForClickEventHandler(handleExpand);
  return (
    <StyledMessageReactions
      $container={true}
      $flexWrap={inModal ? 'nowrap' : 'wrap'}
      $alignItems={'center'}
      $fullWidth={true}
    >
      {reactions.slice(0, 4).map(([emoji]) => (
        <Reaction key={`${messageId}-${emoji}`} emoji={emoji} {...props} />
      ))}
      <StyledReactionOverflow onClick={handleExpand} onKeyDown={onKeyDown}>
        {reactions
          .slice(4, 7)
          .reverse()
          .map(([emoji]) => {
            return (
              <span
                key={`${messageId}-${emoji}`}
                role={'img'}
                aria-label={
                  nativeEmojiData?.ariaLabels ? nativeEmojiData.ariaLabels[emoji] : undefined
                }
              >
                {emoji}
              </span>
            );
          })}
      </StyledReactionOverflow>
    </StyledMessageReactions>
  );
};

const ExpandedReactions = (props: ExpandReactionsProps) => {
  const { handleExpand } = props;
  return (
    <Flex $container={true} $flexDirection={'column'} $alignItems={'center'} $margin="4px 0 0">
      <Reactions {...props} />
      <StyledReadLess onClick={handleExpand}>
        <LucideIcon
          unicode={LUCIDE_ICONS_UNICODE.CHEVRON_UP}
          iconSize="medium"
          style={{ textAlign: 'center' }}
        />
        <Localizer token="showLess" />
      </StyledReadLess>
    </Flex>
  );
};

export type MessageReactsSelectorProps = Pick<
  MessageRenderingProps,
  'convoId' | 'serverId' | 'reacts' | 'sortedReacts'
>;

type Props = {
  messageId: string;
  hasReactLimit?: boolean;
  onClick: (emoji: string) => void;
  onPopupClick?: (emoji: string) => void;
  inModal?: boolean;
  onSelected?: (emoji: string) => boolean;
  noAvatar: boolean;
};

export const MessageReactions = (props: Props) => {
  const isDetailView = useIsDetailMessageView();

  const {
    messageId,
    hasReactLimit = true,
    onClick,
    onPopupClick,
    inModal = false,
    onSelected,
    noAvatar,
  } = props;

  const [isExpanded, setIsExpanded] = useState(false);
  const handleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const msgProps = useMessageReactsPropsById(messageId);

  const inGroup = useSelectedIsGroupOrCommunity();

  if (!msgProps) {
    return null;
  }

  const reactionsProps = {
    messageId,
    reactions: msgProps.sortedReacts ?? [],
    inModal,
    inGroup,
    onClick: !isDetailView ? onClick : undefined,
    onSelected,
    handlePopupClick: onPopupClick,
  };

  const ExtendedReactions = isExpanded ? ExpandedReactions : CompressedReactions;

  return (
    <StyledMessageReactionsContainer
      $container={true}
      $flexDirection={'column'}
      $justifyContent={'center'}
      $alignItems={inModal ? 'flex-start' : 'center'}
      $noAvatar={noAvatar}
    >
      {reactionsProps.reactions.length ? (
        !hasReactLimit || reactionsProps.reactions.length <= REACT_LIMIT ? (
          <Reactions {...reactionsProps} />
        ) : (
          <ExtendedReactions handleExpand={handleExpand} {...reactionsProps} />
        )
      ) : null}
    </StyledMessageReactionsContainer>
  );
};
