import type { CSSProperties } from 'styled-components';
import type { SessionDataTestId } from 'react';
import { SessionLucideIconButton } from '../../icon/SessionIconButton';
import { AvatarSize } from '../../avatar/Avatar';
import { LUCIDE_ICONS_UNICODE } from '../../icon/lucide';
import { focusVisibleOutlineStr } from '../../../styles/focusVisible';

export function isAvatarActionSupportedAvatarSize(
  avatarSize: AvatarSize
): avatarSize is AvatarSize.XL | AvatarSize.HUGE {
  return avatarSize === AvatarSize.XL || avatarSize === AvatarSize.HUGE;
}

export function useAvatarActionPosition(
  avatarSize: AvatarSize,
  position: 'top' | 'bottom'
): CSSProperties {
  if (!isAvatarActionSupportedAvatarSize(avatarSize)) {
    throw new Error('useAvatarActionPosition is not supported for this avatar size');
  }

  const offsetBottom =
    avatarSize === AvatarSize.XL
      ? { bottom: '3%', insetInlineEnd: 0 }
      : { bottom: '7%', insetInlineEnd: '9%' };

  const offsetTop =
    avatarSize === AvatarSize.XL
      ? { top: '3%', insetInlineEnd: 0 }
      : { top: '4%', insetInlineEnd: '9%' };

  return {
    position: 'absolute',
    ...(position === 'top' ? offsetTop : offsetBottom),
  };
}

function useButtonSize({
  avatarSize,
  hasImage,
  isClosedGroup,
}: {
  avatarSize: AvatarSize.XL | AvatarSize.HUGE;
  hasImage: boolean;
  isClosedGroup: boolean;
}) {
  const isHuge = avatarSize === AvatarSize.HUGE;
  if (hasImage) {
    // editing for a group fallback is not possible (as editing implies an image was already set)
    return isHuge ? 'medium' : 'small';
  }
  if (isClosedGroup) {
    return isHuge ? 'large' : 'medium';
  }
  return isHuge ? 'medium' : 'small';
}

export const PlusAvatarButton = ({
  onClick,
  dataTestId,
  hasImage,
  avatarSize,
  isClosedGroup,
}: {
  onClick?: () => void;
  /**
   * if true, the button will be a pencil icon, otherwise a plus icon
   */
  hasImage: boolean;
  dataTestId?: SessionDataTestId;
  /**
   * We need the avatar size to know the offset of the plus/pencil icon.
   * Note: a few things will need to be tweaked if you try to use this for a different size than XL or HUGE.
   */
  avatarSize: AvatarSize;
  /**
   * If we are rendering a double avatar for closed group, the icons size and positions are different
   */
  isClosedGroup: boolean;
}) => {
  if (!isAvatarActionSupportedAvatarSize(avatarSize)) {
    throw new Error('PlusAvatarButton is not supported for this avatar size');
  }
  const hardcodedPosition = useAvatarActionPosition(avatarSize, 'bottom');

  // the pencil looks smaller than the plus on the XL avatar
  const buttonSize = useButtonSize({ avatarSize, hasImage, isClosedGroup });

  return (
    <SessionLucideIconButton
      unicode={hasImage ? LUCIDE_ICONS_UNICODE.PENCIL : LUCIDE_ICONS_UNICODE.PLUS}
      iconSize={buttonSize}
      iconColor="var(--modal-background-content-color)"
      onClick={onClick}
      dataTestId={dataTestId}
      backgroundColor="var(--primary-color)"
      padding={hasImage ? 'var(--margins-xs)' : 'var(--margins-xxs)'}
      style={{
        ...hardcodedPosition,
        boxShadow: '0px 0px 3px 2px var(--borders-color)',
      }}
      focusVisibleEffect={focusVisibleOutlineStr()}
    />
  );
};
