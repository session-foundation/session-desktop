import { isEmpty } from 'lodash';
import { useState } from 'react';
import { clipboard } from 'electron';
import useTimeoutFn from 'react-use/lib/useTimeoutFn';

import { ToastUtils } from '../../session/utils';
import { SessionButtonProps, type SessionButtonColor } from '../basic/SessionButton';
import { SessionIconButtonProps, SessionLucideIconButton } from '../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';
import type { SessionIconSize } from '../icon';
import { tr } from '../../localization/localeTools';
import { DURATION } from '../../session/constants';
import { ModalBottomButtonWithBorder } from '../SessionWrapperModal';
import { focusVisibleOutlineStr } from '../../styles/focusVisible';

type CopyProps = {
  copyContent?: string;
  onCopyComplete?: (copiedValue: string | undefined) => void;
} & { buttonColor: SessionButtonColor };

type CopyToClipboardButtonProps = Omit<SessionButtonProps, 'children' | 'onClick' | 'buttonColor'> &
  CopyProps;

export const CopyToClipboardButton = (props: CopyToClipboardButtonProps) => {
  const { copyContent, onCopyComplete, text, buttonType, buttonColor, dataTestId, disabled } =
    props;
  const [copied, setCopied] = useState(false);

  // reset the copied state after 5 seconds
  useTimeoutFn(
    () => {
      setCopied(false);
    },
    copied ? 5 * DURATION.SECONDS : 0
  );

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

  return (
    <ModalBottomButtonWithBorder
      aria-label={'copy to clipboard button'}
      text={text && !isEmpty(text) ? text : copied ? tr('copied') : tr('copy')}
      onClick={onClick}
      buttonColor={buttonColor}
      dataTestId={dataTestId}
      disabled={disabled}
      buttonType={buttonType}
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
  const { copyContent, onCopyComplete } = props;

  const onClick = () => {
    clipboard.writeText(copyContent);
    ToastUtils.pushCopiedToClipBoard();

    if (onCopyComplete) {
      onCopyComplete(copyContent);
    }
  };

  return (
    <SessionLucideIconButton
      aria-label={'copy to clipboard icon button'}
      padding="0"
      margin="0"
      {...props}
      unicode={LUCIDE_ICONS_UNICODE.COPY}
      onClick={onClick}
      focusVisibleEffect={focusVisibleOutlineStr('2px')}
    />
  );
};
