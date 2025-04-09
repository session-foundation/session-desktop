import { useDispatch } from 'react-redux';
import { showLinkVisitWarningDialog } from '../dialog/OpenUrlModal';
import { SessionIconButton, SessionIconSize } from '../icon';
import { SessionIconButtonProps } from '../icon/SessionIconButton';

export const HelpDeskButton = (
  props: Omit<SessionIconButtonProps, 'iconType' | 'iconSize'> & { iconSize?: SessionIconSize }
) => {
  const dispatch = useDispatch();

  return (
    <SessionIconButton
      aria-label="Help desk link"
      {...props}
      iconType="question"
      iconSize={props.iconSize || 10}
      iconPadding={props.iconPadding || '2px'}
      padding={props.padding || '0'}
      dataTestId="session-link-helpdesk"
      onClick={() => {
        showLinkVisitWarningDialog('https://getsession.org/account-ids', dispatch);
      }}
    />
  );
};
