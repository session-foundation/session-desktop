import { useMemo } from 'react';
import styled from 'styled-components';
import { findAndFormatContact } from '../../../../models/message';
import { PubKey } from '../../../../session/types/PubKey';

import { Localizer, type LocalizerProps } from '../../../basic/Localizer';
import { nativeEmojiData } from '../../../../util/emoji';
import { useSelectedIsPublic } from '../../../../state/selectors/selectedConversation';

export const StyledPopupContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 72px;
  width: 100%;
  font-size: var(--font-size-sm);
  font-weight: bold;
  overflow-wrap: break-word;
  cursor: pointer;
`;

const StyledEmoji = styled.span`
  font-size: 36px;
  margin-block-start: 8px;
`;

const generateContactsString = (
  senders: Array<string>,
  isPublic: boolean
): { contacts: Array<string>; hasMe: boolean } => {
  const contacts: Array<string> = [];
  let hasMe = false;
  senders.forEach(sender => {
    const contact = findAndFormatContact(sender);

    if (contact.isMe) {
      hasMe = true;
    } else {
      const shortPubkey = PubKey.shorten(contact.pubkey);
      let resolvedName = contact?.profileName ?? contact?.name;

      // Shorten the name if it's too long, the box these names are listed in is pretty small
      if (resolvedName && resolvedName.length > 13) {
        resolvedName = `${resolvedName.slice(0, 10)}…`;
      }

      const nameSuffix = isPublic && resolvedName ? shortPubkey : '';
      contacts.push(`${resolvedName ?? shortPubkey} ${nameSuffix}`.trim());
    }
  });
  return { contacts, hasMe };
};

const getI18nComponentProps = (
  isYou: boolean,
  contacts: Array<string>,
  numberOfReactors: number,
  emoji: string,
  emojiName?: string
): LocalizerProps => {
  const name = contacts[0];
  const other_name = contacts[1];
  const emoji_name = emojiName ? `:${emojiName}:` : emoji;
  const count = numberOfReactors - 1;

  switch (numberOfReactors) {
    case 1:
      return isYou
        ? { token: 'emojiReactsHoverYouNameDesktop', args: { emoji_name } }
        : { token: 'emojiReactsHoverNameDesktop', args: { name, emoji_name } };
    case 2:
      return isYou
        ? { token: 'emojiReactsHoverYouNameTwoDesktop', args: { name, emoji_name } }
        : { token: 'emojiReactsHoverNameTwoDesktop', args: { name, other_name, emoji_name } };
    default:
      return isYou
        ? { token: 'emojiReactsHoverYouNameMultipleDesktop', args: { count, emoji_name } }
        : { token: 'emojiReactsHoverTwoNameMultipleDesktop', args: { name, count, emoji_name } };
  }
};

type Props = {
  messageId: string;
  emoji: string;
  count: number;
  senders: Array<string>;
  onClick: (...args: Array<any>) => void;
};

export const ReactionPopup = (props: Props) => {
  const { emoji, senders, count, onClick } = props;

  const isPublic = useSelectedIsPublic();

  const emojiName = nativeEmojiData?.ids?.[emoji];
  const emojiAriaLabel = nativeEmojiData?.ariaLabels?.[emoji];

  const { contacts, hasMe } = useMemo(
    () => generateContactsString(senders, isPublic),
    [senders, isPublic]
  );

  const i18nProps = useMemo(
    () => getI18nComponentProps(hasMe, contacts, count, emoji, emojiName),
    [hasMe, contacts, count, emoji, emojiName]
  );

  return (
    <StyledPopupContainer onClick={onClick}>
      <Localizer {...i18nProps} />
      <StyledEmoji role={'img'} aria-label={emojiAriaLabel}>
        {emoji}
      </StyledEmoji>
    </StyledPopupContainer>
  );
};
