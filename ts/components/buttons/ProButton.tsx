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
  style = defaultStyle,
}: {
  iconSize: SessionIconSize;
  disabled?: boolean;
  onClick?: () => void;
  dataTestId: SessionDataTestId;
  style?: CSSProperties;
}) {
  return (
    <SessionIconButton
      {...sharedProps}
      iconSize={iconSize}
      borderRadius={sizeToBorderRadius(iconSize)}
      dataTestId={dataTestId}
      disabled={disabled}
      onClick={onClick}
      style={style}
    />
  );
}

export function ProIcon({
  iconSize,
  dataTestId,
  style = defaultStyle,
}: {
  iconSize: SessionIconSize;
  dataTestId?: SessionDataTestId;
  style?: CSSProperties;
}) {
  return (
    <SessionIcon
      {...sharedProps}
      iconSize={iconSize}
      borderRadius={sizeToBorderRadius(iconSize)}
      dataTestId={dataTestId}
      style={style}
    />
  );
}
