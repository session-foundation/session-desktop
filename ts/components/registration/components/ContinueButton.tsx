import { tr } from '../../../localization/localeTools';
import { SessionButton } from '../../basic/SessionButton';

type Props = {
  onClick: () => void | Promise<void>;
  disabled: boolean;
};

export const ContinueButton = (props: Props) => {
  const { onClick, disabled } = props;

  return (
    <SessionButton
      ariaLabel={tr('theContinue')}
      onClick={onClick}
      text={tr('theContinue')}
      disabled={disabled}
      dataTestId="continue-button"
    />
  );
};
