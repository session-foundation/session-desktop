import styled from 'styled-components';
import { getAppDispatch } from '../../state/dispatch';
import { useLeftOverlayModeType } from '../../state/selectors/section';
import { sectionActions } from '../../state/ducks/section';
import { searchActions } from '../../state/ducks/search';
import { LucideIcon } from '../icon/LucideIcon';
import { tr } from '../../localization/localeTools';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';

const StyledMenuButton = styled.button`
  position: relative;
  display: inline-block;

  display: flex;
  justify-content: center;
  align-items: center;
  background: var(--transparent-color);

  border: 1.5px solid var(--menu-button-border-color);
  border-radius: 7px;
  width: 51px;
  height: 33px;
  cursor: pointer;

  transition: var(--default-duration);

  color: var(--menu-button-icon-color);

  &:hover,
  &:focus-visible {
    background: var(--menu-button-background-hover-color);
    border-color: var(--menu-button-border-hover-color);
    color: var(--menu-button-icon-hover-color);
  }
`;

export function useNewConversationCallback() {
  const leftOverlayMode = useLeftOverlayModeType();
  const dispatch = getAppDispatch();

  return () => {
    dispatch(searchActions.clearSearch());
    dispatch(
      leftOverlayMode
        ? sectionActions.resetLeftOverlayMode()
        : sectionActions.setLeftOverlayMode({ type: 'choose-action', params: null })
    );
  };
}

/**
 * This is the Session Menu Button. i.e. the button on top of the conversation list to start a new conversation.
 * It has two state: selected or not and so we use an checkbox input to keep the state in sync.
 */
export const MenuButton = () => {
  const onClick = useNewConversationCallback();

  return (
    <StyledMenuButton data-testid="new-conversation-button" onClick={onClick}>
      <LucideIcon
        unicode={LUCIDE_ICONS_UNICODE.PLUS}
        iconSize="large"
        aria-label={tr('contentDescriptionChooseConversationType')}
      />
    </StyledMenuButton>
  );
};
