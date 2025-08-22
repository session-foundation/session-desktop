import styled from 'styled-components';
import { AvatarSize } from '../../avatar/Avatar';
import { PlusAvatarButton } from '../../buttons/PlusAvatarButton';
import { LUCIDE_ICONS_UNICODE } from '../../icon/lucide';
import { LucideIcon } from '../../icon/LucideIcon';
import { useTheme } from '../../../state/theme/selectors/theme';

const StyledUploadButton = styled.div`
  border-radius: 50%;
  overflow: hidden;
  padding: var(--margins-lg);
  aspect-ratio: 1;
`;

export const UploadFirstImageButton = ({ onClick }: { onClick: () => void }) => {
  const theme = useTheme();

  // we do not have a color that works well for this button on all themes.
  const backgroundColor =
    theme === 'ocean-dark'
      ? 'var(--background-primary-color)'
      : 'var(--chat-buttons-background-color)';

  return (
    <div style={{ position: 'relative' }} onClick={onClick}>
      <StyledUploadButton style={{ backgroundColor }}>
        <LucideIcon unicode={LUCIDE_ICONS_UNICODE.IMAGE} iconSize={'max'} />
      </StyledUploadButton>
      <PlusAvatarButton
        dataTestId="image-upload-section"
        hasImage={false}
        avatarSize={AvatarSize.XL}
        isClosedGroup={false}
      />
    </div>
  );
};
