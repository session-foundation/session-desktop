import type { SessionDataTestId } from 'react';
import type { CSSProperties } from 'styled-components';
import { SessionIcon, SessionIconButton, type SessionIconSize } from '../icon';

function sizeToBorderRadius(size: SessionIconSize) {
  switch (size) {
    case 'medium':
      return '4px';
    case 'large':
      return '6px';
    case 'huge':
      return '6px';
    default:
      return '2px';
  }
}

const sharedProps = {
  sizeIsWidth: false,
  iconType: 'sessionPro',
  backgroundColor: 'var(--primary-color)',
  iconColor: 'var(--black-color)',
} as const;

const defaultStyle = { flexShrink: 0 };

export function ProIconButton({
  iconSize,
  disabled,
  onClick,
  dataTestId,
  style,
  noColors,
}: {
  iconSize: SessionIconSize;
  disabled?: boolean;
  onClick?: (() => void) | null;
  dataTestId: SessionDataTestId;
  style?: CSSProperties;
  noColors?: boolean;
}) {
  const mergedStyle = {
    ...defaultStyle,
    ...(noColors ? { backgroundColor: 'var(--chat-buttons-background-hover-color)' } : {}),
    ...style,
  };
  if (onClick) {
    return (
      <SessionIconButton
        {...sharedProps}
        iconSize={iconSize}
        borderRadius={sizeToBorderRadius(iconSize)}
        dataTestId={dataTestId}
        disabled={disabled}
        onClick={onClick}
        style={mergedStyle}
      />
    );
  }

  return (
    <SessionIcon
      {...sharedProps}
      iconSize={iconSize}
      borderRadius={sizeToBorderRadius(iconSize)}
      dataTestId={dataTestId}
      style={mergedStyle}
    />
  );
}
