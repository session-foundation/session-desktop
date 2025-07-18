import { RenderTextCallbackType } from '../../types/Util';

type Props = {
  text: string;
  /** Allows you to customize now non-newlines are rendered. Simplest is just a <span>. */
  renderNonNewLine: RenderTextCallbackType;
  isGroup: boolean;
  isPublic: boolean;
};

export const AddNewLines = (props: Props) => {
  const { text, renderNonNewLine, isGroup, isPublic } = props;
  const rendered = renderNonNewLine({ text, key: 0, isGroup, isPublic });
  if (typeof rendered === 'string') {
    return <>{rendered}</>;
  }
  return rendered;
};
