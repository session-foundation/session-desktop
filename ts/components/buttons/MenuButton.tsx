import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import { useLeftOverlayMode } from '../../state/selectors/section';
import { sectionActions } from '../../state/ducks/section';
import { searchActions } from '../../state/ducks/search';
import { LucideIcon } from '../icon/LucideIcon';
import { localize } from '../../localization/localeTools';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';

const StyledMenuButton = styled.button`
  position: relative;
  display: inline-block;

  display: flex;
  justify-content: center;
  align-items: center;
  background: var(--menu-button-background-color);

  border: 1.5px solid var(--menu-button-border-color);
  border-radius: 7px;
  width: 51px;
  height: 33px;
  cursor: pointer;

  transition: var(--default-duration);

  color: var(--menu-button-icon-color);

  &:hover {
    background: var(--menu-button-background-hover-color);
    border-color: var(--menu-button-border-hover-color);
    color: var(--menu-button-icon-hover-color);
  }
`;

/**
 * This is the Session Menu Button. i.e. the button on top of the conversation list to start a new conversation.
 * It has two state: selected or not and so we use an checkbox input to keep the state in sync.
 */
export const MenuButton = () => {
  const leftOverlayMode = useLeftOverlayMode();
  const dispatch = useDispatch();

  const isToggled = Boolean(leftOverlayMode);

  const onClickFn = () => {
    dispatch(searchActions.clearSearch());
    dispatch(
      isToggled
        ? sectionActions.resetLeftOverlayMode()
        : sectionActions.setLeftOverlayMode('choose-action')
    );
  };

  return (
    <StyledMenuButton data-testid="new-conversation-button" onClick={onClickFn}>
      <LucideIcon
        unicode={LUCIDE_ICONS_UNICODE.PLUS}
        iconSize="large"
        aria-label={localize('contentDescriptionChooseConversationType')}
      />
    </StyledMenuButton>
  );
};
