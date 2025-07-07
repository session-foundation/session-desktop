import styled from 'styled-components';
import type { ReactNode } from 'react';
import { ConvoHub } from '../../session/conversations';
import { isUsAnySogsFromCache } from '../../session/apis/open_group_api/sogsv3/knownBlindedkeys';
import { PubKey } from '../../session/types';
import { RenderTextCallbackType } from '../../types/Util';
import { localize } from '../../localization/localeTools';

interface MentionProps {
  key: string;
  dataUserId?: string;
  isPublic?: boolean;
  text: string;
  inComposableElement?: boolean;
  children?: ReactNode;
}

export const StyledMentionAnother = styled.span<{ inComposableElement?: boolean }>`
  border-radius: var(--border-radius);
  padding: ${props => (props.inComposableElement ? '0' : '1px')};
  cursor: ${props => (props.inComposableElement ? 'default' : 'auto')};
  ${props => (props.inComposableElement ? 'user-select: all;' : '')}
  unicode-bidi: plaintext;
  font-weight: bold;
`;

const StyledMentionedUs = styled(StyledMentionAnother)`
  background-color: var(--primary-color);
  color: var(--black-color);
  border-radius: var(--border-radius);
`;

export const Mention = (props: MentionProps) => {
  const blindedOrNotPubkey = props.text.slice(1);
  const foundConvo = ConvoHub.use().get(blindedOrNotPubkey);

  // this call takes care of finding if we have a blindedId of ourself on any sogs we have joined.
  if (isUsAnySogsFromCache(blindedOrNotPubkey)) {
    return (
      <StyledMentionedUs
        data-user-id={props.dataUserId}
        contentEditable={false}
        inComposableElement={props.inComposableElement}
      >
        @{localize('you')}
        {props.children}
      </StyledMentionedUs>
    );
  }

  const resolvedName =
    foundConvo?.getNicknameOrRealUsernameOrPlaceholder() || PubKey.shorten(props.text);
  const shortPubkey = PubKey.shorten(blindedOrNotPubkey);
  const suffix = props.isPublic && resolvedName !== shortPubkey ? shortPubkey : '';

  return (
    <StyledMentionAnother
      data-user-id={props.dataUserId}
      contentEditable={false}
      inComposableElement={props.inComposableElement}
    >
      @{resolvedName} {suffix}
      {props.children}
    </StyledMentionAnother>
  );
};

type Props = {
  text: string;
  renderOther?: RenderTextCallbackType;
  isGroup: boolean;
  isPublic: boolean;
};

const defaultRenderOther = ({ text }: { text: string }) => <>{text}</>;

export const AddMentions = (props: Props): JSX.Element => {
  const { text, renderOther, isGroup, isPublic } = props;
  const results: Array<JSX.Element> = [];
  const FIND_MENTIONS = new RegExp(`@${PubKey.regexForPubkeys}`, 'g');

  const renderWith = renderOther || defaultRenderOther;

  let match = FIND_MENTIONS.exec(text);
  let last = 0;
  let count = 1000;
  if (!match) {
    return renderWith({ text, key: 0, isGroup, isPublic });
  }

  while (match) {
    count++;
    const key = count;
    if (last < match.index) {
      const otherText = text.slice(last, match.index);
      results.push(renderWith({ text: otherText, key, isGroup, isPublic }));
    }

    const pubkeyWithAt = text.slice(match.index, FIND_MENTIONS.lastIndex);
    results.push(<Mention text={pubkeyWithAt} key={`${key}`} isPublic={isPublic} />);

    last = FIND_MENTIONS.lastIndex;
    match = FIND_MENTIONS.exec(text);
  }

  if (last < text.length) {
    results.push(renderWith({ text: text.slice(last), key: count++, isGroup, isPublic }));
  }

  return <>{results}</>;
};
