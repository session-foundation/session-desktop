import { useDispatch } from 'react-redux';
import { showLinkVisitWarningDialog } from '../dialog/OpenUrlModal';
import { SessionLucideIconButton } from '../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';
import type { WithIconColor, WithIconSize } from '../icon/Icons';

export const HelpDeskButton = ({
  style,
  iconSize,
  iconColor,
}: { style?: React.CSSProperties } & WithIconSize & WithIconColor) => {
  const dispatch = useDispatch();

  return (
    <SessionLucideIconButton
      aria-label="Help desk link"
      iconSize={iconSize}
      iconColor={iconColor}
      unicode={LUCIDE_ICONS_UNICODE.CIRCLE_HELP}
      dataTestId="session-link-helpdesk"
      onClick={() => {
        showLinkVisitWarningDialog('https://getsession.org/account-ids', dispatch);
      }}
      style={style}
    />
  );
};
