import { SizeClassType } from '../../util/emoji';

import { RenderTextCallbackType } from '../../types/Util';

import type { JSX } from "react";

type Props = {
  text: string;
  /** A class name to be added to the generated emoji images */
  sizeClass: SizeClassType;
  /** Allows you to customize now non-newlines are rendered. Simplest is just a <span>. */
  renderNonEmoji?: RenderTextCallbackType;
  isGroup: boolean;
  isPublic?: boolean;
};

const defaultRenderNonEmoji = (text: string | undefined) => <>{text || ''}</>;

export const Emojify = (props: Props): JSX.Element => {
  const { text, renderNonEmoji, sizeClass, isGroup, isPublic = false } = props;
  if (!renderNonEmoji) {
    return <>{defaultRenderNonEmoji(text)}</>;
  }
  const rendered = renderNonEmoji?.({ text: text || '', key: 1, isGroup, isPublic });
  let size = 1.0;
  switch (sizeClass) {
    case 'jumbo':
      size = 2.0;
      break;
    case 'large':
      size = 1.8;
      break;
    case 'medium':
      size = 1.5;
      break;
    case 'small':
      size = 1.1;
      break;
    case 'default':
    default:
      size = 1.0;
  }

  // NOTE (Will): This should be em and not rem because we want to keep the inherited font size from the parent element and not the root
  return <span style={{ fontSize: `${size}em`, userSelect: 'inherit' }}>{rendered}</span>;
};
