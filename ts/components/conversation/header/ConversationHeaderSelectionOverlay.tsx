import { useDispatch, useSelector } from 'react-redux';
import useKey from 'react-use/lib/useKey';

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
import { useDeleteMessagesCb } from '../../menuAndSettingsHooks/useDeleteMessagesCb';

export const SelectionOverlay = () => {
  const selectedMessageIds = useSelector(getSelectedMessageIds);
  const selectedConversationKey = useSelectedConversationKey();
  const dispatch = useDispatch();

  const deleteMessagesCb = useDeleteMessagesCb(selectedConversationKey);

  function onCloseOverlay() {
    dispatch(resetSelectedMessageIds());
  }
  /**
   * This is a duplicate with the onKeyDown of SessionConversation.
   * At some point we'll make a global handler to deal with the key presses
   * and handle them depending on what is visible, but that's not part of this PR
   */
  useKey(
    shouldProcess => {
      return (
        shouldProcess.code === 'Escape' ||
        shouldProcess.code === 'Backspace' ||
        shouldProcess.code === 'Delete'
      );
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

  const classNameAndId = 'message-selection-overlay';

  return (
    <SessionFocusTrap>
      <div className={classNameAndId} id={classNameAndId}>
        <div className="close-button">
          <SessionLucideIconButton
            unicode={LUCIDE_ICONS_UNICODE.X}
            iconColor="var(--chat-buttons-icon-color)"
            iconSize="large"
            onClick={onCloseOverlay}
            aria-label={tr('close')}
          />
        </div>

        <div className="button-group">
          <SessionButton
            buttonColor={SessionButtonColor.Danger}
            buttonShape={SessionButtonShape.Square}
            buttonType={SessionButtonType.Solid}
            text={tr('delete')}
            onClick={() => {
              void deleteMessagesCb?.(selectedMessageIds);
            }}
          />
        </div>
      </div>
    </SessionFocusTrap>
  );
};
