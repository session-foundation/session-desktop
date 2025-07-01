import LinkifyIt from 'linkify-it';

import { useDispatch } from 'react-redux';
import styled from 'styled-components';

import type { ReactNode } from 'react';
import { RenderTextCallbackType } from '../../../../types/Util';
import { getEmojiSizeClass, SizeClassType } from '../../../../util/emoji';
import { LinkPreviews } from '../../../../util/linkPreviews';
import { AddMentions } from '../../AddMentions';
import { AddNewLines } from '../../AddNewLines';
import { Emojify } from '../../Emojify';
import { showLinkVisitWarningDialog } from '../../../dialog/OpenUrlModal';

const linkify = new LinkifyIt();

type Props = {
  text: string;
  /** If set, all emoji will be the same size. Otherwise, just one emoji will be large. */
  disableJumbomoji: boolean;
  /** If set, links will be left alone instead of turned into clickable `<a>` tags. Used in quotes, convo list item, etc */
  disableRichContent: boolean;
  isGroup: boolean;
};

const renderMentions: RenderTextCallbackType = ({ text, key, isGroup }) => (
  <AddMentions key={key} text={text} isGroup={isGroup} />
);

export const renderTextDefault: RenderTextCallbackType = ({ text }) => <>{text}</>;

const renderNewLines: RenderTextCallbackType = ({ text: textWithNewLines, key, isGroup }) => {
  return (
    <AddNewLines
      key={key}
      text={textWithNewLines}
      renderNonNewLine={renderMentions}
      isGroup={isGroup}
    />
  );
};

const renderEmoji = ({
  text,
  key,
  sizeClass,
  renderNonEmoji,
  isGroup,
}: {
  text: string;
  key: number;
  sizeClass: SizeClassType;
  renderNonEmoji: RenderTextCallbackType;
  isGroup: boolean;
}) => (
  <Emojify
    key={key}
    text={text}
    sizeClass={sizeClass}
    renderNonEmoji={renderNonEmoji}
    isGroup={isGroup}
  />
);

type LinkifyProps = {
  text: string;
  /** Allows you to customize now non-links are rendered. Simplest is just a <span>. */
  renderNonLink: RenderTextCallbackType;
  isGroup: boolean;
};

const SUPPORTED_PROTOCOLS = /^(http|https):/i;

const Linkify = (props: LinkifyProps): JSX.Element => {
  const { text, isGroup, renderNonLink } = props;
  const results: Array<any> = [];
  let count = 1;
  const dispatch = useDispatch();
  const matchData = linkify.match(text) || [];
  let last = 0;

  if (matchData.length === 0) {
    return renderNonLink({ text, key: 0, isGroup });
  }

  matchData.forEach((match: { index: number; url: string; lastIndex: number; text: string }) => {
    if (last < match.index) {
      const textWithNoLink = text.slice(last, match.index);
      results.push(renderNonLink({ text: textWithNoLink, isGroup, key: count++ }));
    }

    const { url, text: originalText } = match;
    const isLink = SUPPORTED_PROTOCOLS.test(url) && !LinkPreviews.isLinkSneaky(url);
    if (isLink) {
      // disable click on <a> elements so clicking a message containing a link doesn't
      // select the message. The link will still be opened in the browser.

      results.push(
        <a
          key={count++}
          href={url}
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            showLinkVisitWarningDialog(url, dispatch);
          }}
        >
          {originalText}
        </a>
      );
    } else {
      results.push(renderNonLink({ text: originalText, isGroup, key: count++ }));
    }

    last = match.lastIndex;
  });

  if (last < text.length) {
    results.push(renderNonLink({ text: text.slice(last), isGroup, key: count++ }));
  }

  return <>{results}</>;
};

const StyledPre = styled.pre`
  background-color: var(--background-primary-color);
  color: var(--text-primary-color);
  border: 1px solid var(--text-primary-color);
  padding: var(--margins-xs);
  user-select: text;
  border-radius: var(--border-radius);
  margin-inline-start: var(--margins-xs);
  margin-inline-end: var(--margins-xs);
`;

function parsePreTags(content: string, messageBodyProps: Props) {
  const segments: Array<ReactNode> = [];
  const regex = /```([a-zA-Z]*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  // eslint-disable-next-line no-cond-assign
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index);
      if (text.replaceAll('\n', '')) {
        window.log.debug(text);
        segments.push(
          <MessageBody
            {...messageBodyProps}
            text={content.slice(lastIndex, match.index)}
            disableRichContent={true}
          />
        );
      }
    }

    // match[1] is the "language/caption"
    segments.push(<StyledPre title={match[1]}>{match[2]}</StyledPre>);

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).replaceAll('\n', '');
    if (text) {
      window.log.debug(text);
      segments.push(
        <MessageBody
          {...messageBodyProps}
          text={content.slice(lastIndex)}
          disableRichContent={true}
        />
      );
    }
  }

  return segments.length ? (
    segments
  ) : (
    <MessageBody {...messageBodyProps} text={content} disableRichContent={true} />
  );
}

export const MessageBody = (props: Props) => {
  const { text, disableJumbomoji, disableRichContent, isGroup } = props;
  const sizeClass: SizeClassType = disableJumbomoji ? 'default' : getEmojiSizeClass(text);

  if (disableRichContent) {
    return renderEmoji({
      text,
      sizeClass,
      key: 0,
      renderNonEmoji: renderNewLines,
      isGroup,
    });
  }

  if (text && text.length > 6 && text.includes('```')) {
    return parsePreTags(text, props);
  }

  return (
    <Linkify
      text={text}
      isGroup={isGroup}
      renderNonLink={({ key, text: nonLinkText }) => {
        return renderEmoji({
          text: nonLinkText,
          sizeClass,
          key,
          renderNonEmoji: renderNewLines,
          isGroup,
        });
      }}
    />
  );
};
