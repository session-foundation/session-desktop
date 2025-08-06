import styled from 'styled-components';
import { SessionIcon } from '../icon';
import { useIsDarkTheme } from '../../state/theme/selectors/theme';

const CrownWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  bottom: 0;
  right: 0;
  height: 50%; // anything less than 50% is quite hard to see on the AvatarSize.M and smaller sizes
  width: 50%; // anything less than 50% is quite hard to see on the AvatarSize.M and smaller sizes
  background: var(--text-primary-color);
  border-radius: 50%;
`;

export const CrownIcon = () => {
  // bg color for the two dark themes; the dynamic accent color for the light themes
  const isDarkTheme = useIsDarkTheme();

  const iconColor = isDarkTheme ? 'var(--background-primary-color)' : 'var(--primary-color)';

  return (
    <CrownWrapper>
      <SessionIcon
        iconColor={iconColor}
        iconSize={'small'}
        iconType="crown"
        iconPadding="1px 0px 1px 1px"
      />
    </CrownWrapper>
  );
};
