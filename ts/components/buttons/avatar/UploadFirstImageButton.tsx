import styled from 'styled-components';
import { AvatarSize } from '../../avatar/Avatar';
import { LUCIDE_ICONS_UNICODE } from '../../icon/lucide';
import { LucideIcon } from '../../icon/LucideIcon';
import { PlusAvatarButton } from './PlusAvatarButton';

const StyledUploadButton = styled.div`
  background-color: var(--chat-buttons-background-color);
  border-radius: 50%;
  overflow: hidden;
  padding: var(--margins-lg);
  aspect-ratio: 1;
`;

export const UploadFirstImageButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <div style={{ position: 'relative' }} onClick={onClick}>
      <StyledUploadButton>
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
