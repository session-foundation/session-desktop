import { isEmpty } from 'lodash';
import { useState } from 'react';
import { clipboard } from 'electron';
import { useHotkey } from '../../hooks/useHotkey';
import { ToastUtils } from '../../session/utils';
import { SessionButton, SessionButtonProps } from '../basic/SessionButton';
import { SessionIconButtonProps, SessionLucideIconButton } from '../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';
import type { SessionIconSize } from '../icon';

type CopyProps = {
  copyContent?: string;
  onCopyComplete?: (copiedValue: string | undefined) => void;
  hotkey?: boolean;
};

type CopyToClipboardButtonProps = Omit<SessionButtonProps, 'children' | 'onClick'> & CopyProps;

export const CopyToClipboardButton = (props: CopyToClipboardButtonProps) => {
  const { copyContent, onCopyComplete, hotkey = false, text } = props;
  const [copied, setCopied] = useState(false);

  const onClick = () => {
    try {
      const toCopy = copyContent || text;
      if (!toCopy) {
        throw Error('Nothing to copy!');
      }

      clipboard.writeText(toCopy);
      ToastUtils.pushCopiedToClipBoard();

      setCopied(true);
      if (onCopyComplete) {
        onCopyComplete(text);
      }
    } catch (err) {
      window.log.error('CopyToClipboard:', err);
    }
  };

  useHotkey('c', onClick, !hotkey);

  return (
    <SessionButton
      aria-label={'copy to clipboard button'}
      {...props}
      text={!isEmpty(text) ? text : copied ? window.i18n('copied') : window.i18n('copy')}
      onClick={onClick}
    />
  );
};

type CopyToClipboardIconProps = Omit<
  SessionIconButtonProps,
  'children' | 'onClick' | 'iconType' | 'iconSize'
> &
  CopyProps;

export const CopyToClipboardIcon = (
  props: CopyToClipboardIconProps & { copyContent: string; iconSize: SessionIconSize }
) => {
  const { copyContent, onCopyComplete, hotkey = false } = props;

  const onClick = () => {
    clipboard.writeText(copyContent);
    ToastUtils.pushCopiedToClipBoard();

    if (onCopyComplete) {
      onCopyComplete(copyContent);
    }
  };

  useHotkey('c', onClick, !hotkey);

  return (
    <SessionLucideIconButton
      aria-label={'copy to clipboard icon button'}
      padding="0"
      margin="0"
      {...props}
      unicode={LUCIDE_ICONS_UNICODE.COPY}
      onClick={onClick}
    />
  );
};
