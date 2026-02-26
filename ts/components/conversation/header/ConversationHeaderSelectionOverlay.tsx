import { useRef } from 'react';
import { useSelector } from 'react-redux';
import useKey from 'react-use/lib/useKey';
import { getAppDispatch } from '../../../state/dispatch';

import { resetSelectedMessageIds } from '../../../state/ducks/conversations';
import { getSelectedMessageIds } from '../../../state/selectors/conversations';
import { useSelectedConversationKey } from '../../../state/selectors/selectedConversation';
import {
  SessionButton,
  SessionButtonColor,
  SessionButtonShape,
  SessionButtonType,
} from '../../basic/SessionButton';
import { SessionFocusTrap } from '../../SessionFocusTrap';
import { tr } from '../../../localization/localeTools';
import { SessionLucideIconButton } from '../../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../../icon/lucide';
import { isBackspace, isDeleteKey, isEscapeKey } from '../../../util/keyboardShortcuts';
import { useDeleteMessagesCb } from '../../menuAndSettingsHooks/useDeleteMessagesCb';

export const SelectionOverlay = () => {
  const selectedMessageIds = useSelector(getSelectedMessageIds);
  const selectedConversationKey = useSelectedConversationKey();
  const deleteMessagesCb = useDeleteMessagesCb(selectedConversationKey);
  const dispatch = getAppDispatch();
  const ref = useRef(null);

  function onCloseOverlay() {
    dispatch(resetSelectedMessageIds());
  }
  /**
   * This is a duplicate with the onKeyDown of SessionConversation.
   * At some point we'll make a global handler to deal with the key presses
   * and handle them depending on what is visible, but that's not part of this PR
   */
  useKey(
    e => {
      return isEscapeKey(e) || isBackspace(e) || isDeleteKey(e);
    },
    event => {
      const selectionMode = !!selectedMessageIds.length;
      switch (event.key) {
        case 'Escape':
          if (selectionMode) {
            onCloseOverlay();
          }
          return true;
        case 'Backspace':
        case 'Delete':
          if (selectionMode) {
            void deleteMessagesCb?.(selectedMessageIds);
          }
          return true;
        default:
      }
      return false;
    }
  );

  return (
    <SessionFocusTrap
      initialFocus={() => ref.current}
      containerDivStyle={{
        position: 'absolute',
        display: 'flex',
        left: '0px',
        right: '0px',
        padding: '0px var(--margins-md)',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 'var(--main-view-header-height)',
        background: 'var(--background-primary-color)',
      }}
    >
      <SessionLucideIconButton
        unicode={LUCIDE_ICONS_UNICODE.X}
        iconColor="var(--chat-buttons-icon-color)"
        iconSize="large"
        onClick={onCloseOverlay}
        aria-label={tr('close')}
        ref={ref}
      />

      <SessionButton
        buttonColor={SessionButtonColor.Danger}
        buttonShape={SessionButtonShape.Square}
        buttonType={SessionButtonType.Solid}
        text={tr('delete')}
        onClick={() => {
          void deleteMessagesCb?.(selectedMessageIds);
        }}
      />
    </SessionFocusTrap>
  );
};
