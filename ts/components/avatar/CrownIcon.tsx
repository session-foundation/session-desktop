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
  border-radius: 50%;
`;

export const CrownIcon = () => {
  const isDarkTheme = useIsDarkTheme();

  const iconColor = isDarkTheme ? 'var(--black-color)' : 'var(--yellow-color)';
  const bgColor = isDarkTheme ? 'var(--yellow-color)' : 'var(--black-color)';

  return (
    <CrownWrapper style={{ backgroundColor: bgColor }}>
      <SessionIcon
        iconColor={iconColor}
        iconSize={'small'}
        iconType="crown"
        iconPadding="1px 0px 1px 1px"
      />
    </CrownWrapper>
  );
};
