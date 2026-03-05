import {
  MouseEvent,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type SessionDataTestId,
} from 'react';
import { contextMenu } from 'react-contexify';
import useWindowSize from 'react-use/lib/useWindowSize';

import { QRCodeSVG } from 'qrcode.react';
import styled, { CSSProperties } from 'styled-components';
import { THEME_GLOBALS } from '../themes/globals';
import { AnimatedFlex } from './basic/Flex';
import { SessionIconType } from './icon';
import { SessionContextMenuContainer } from './SessionContextMenuContainer';
import { Menu, MenuItem } from './menu/items/MenuItem';
import { tr } from '../localization';
import { LUCIDE_ICONS_UNICODE } from './icon/lucide';
import { saveQRCodeAsPng } from '../util/saveQRCodeAsPng';

// AnimatedFlex because we fade in the QR code a flicker on first render
const StyledQRView = styled(AnimatedFlex)<{
  size: number;
}>`
  cursor: pointer;
  border-radius: 10px;
  overflow: visible; // we need this for overflow buttons to be visible (see UserProfileModal)
  ${props => props.size && `width: ${props.size}px; height: ${props.size}px;`}
`;

const StyledFullScreenQrView = styled(AnimatedFlex)`
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 3;
  background-color: #000000dd;
  position: fixed;
`;

export type QRCodeLogoProps = { iconType: SessionIconType; iconSize: number };

export type SessionQRCodeProps = {
  id: string;
  value: string;
  size: number;
  backgroundColor?: string;
  foregroundColor?: string;
  hasLogo?: QRCodeLogoProps;
  logoImage?: string;
  logoSize?: number;
  loading?: boolean;
  onToggleFullScreen?: () => void;
  fullScreen?: boolean;
  ariaLabel?: string;
  dataTestId: SessionDataTestId;
  style?: CSSProperties;
  children?: ReactNode;
};

function QrCodeMenu({
  triggerId,
  containerRef,
}: {
  triggerId: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <SessionContextMenuContainer>
      <Menu id={triggerId}>
        <MenuItem
          onClick={() => {
            void saveQRCodeAsPng(containerRef, 'session-qr-code.png');
          }}
          iconType={LUCIDE_ICONS_UNICODE.ARROW_DOWN_TO_LINE}
          isDangerAction={false}
        >
          {tr('save')}
        </MenuItem>
      </Menu>
    </SessionContextMenuContainer>
  );
}

export function SessionQRCode(props: SessionQRCodeProps) {
  const {
    id,
    value,
    size,
    backgroundColor,
    foregroundColor,
    hasLogo,
    logoImage,
    loading,
    onToggleFullScreen,
    fullScreen,
    ariaLabel,
    dataTestId,
    style,
    children,
  } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const [logo, setLogo] = useState(logoImage);
  const [bgColor, setBgColor] = useState(backgroundColor);
  const [fgColor, setFgColor] = useState(foregroundColor);

  const qrCanvasSize = 1000;

  const { height, width } = useWindowSize();
  const smallestDimension = Math.min(height, width);

  const handleOnClick = async () => {
    onToggleFullScreen?.();
  };

  useEffect(() => {
    // Don't pass the component props to the QR component directly instead update it's props in the next render cycle to prevent janky renders
    if (loading) {
      return;
    }

    if (bgColor !== backgroundColor) {
      setBgColor(backgroundColor);
    }

    if (fgColor !== foregroundColor) {
      setFgColor(foregroundColor);
    }

    if (hasLogo && logo !== logoImage) {
      setLogo(logoImage);
    }
  }, [backgroundColor, bgColor, fgColor, foregroundColor, hasLogo, loading, logo, logoImage]);

  const Comp = fullScreen ? StyledFullScreenQrView : StyledQRView;

  const overriddenSize = fullScreen ? smallestDimension * 0.75 : size;
  const triggerId = 'qr-code-menu-trigger-id';
  return (
    <Comp
      ref={containerRef}
      $container={true}
      $justifyContent="center"
      $alignItems="center"
      size={overriddenSize}
      id={id}
      aria-label={ariaLabel || 'QR code'}
      onClick={(event: MouseEvent<HTMLDivElement>) => {
        event.preventDefault();
        void handleOnClick();
      }}
      onContextMenu={e => {
        if (fullScreen && logoImage) {
          contextMenu.show({
            id: triggerId,
            event: e,
          });
        }
      }}
      data-testid={dataTestId}
      initial={{ opacity: 0 }}
      animate={{ opacity: loading ? 0 : 1 }}
      transition={{ duration: THEME_GLOBALS['--default-duration-seconds'] }}
      style={style}
    >
      <QrCodeMenu triggerId={triggerId} containerRef={containerRef} />
      <QRCodeSVG
        value={value}
        level={'Q'}
        size={qrCanvasSize}
        bgColor={fullScreen ? 'black' : bgColor}
        fgColor={fullScreen ? 'white' : fgColor}
        marginSize={2}
        style={{ width: overriddenSize, height: overriddenSize }}
        imageSettings={
          logoImage && !fullScreen
            ? {
                src: logoImage,
                x: undefined,
                y: undefined,
                height: qrCanvasSize * 0.25,
                width: qrCanvasSize * 0.25,
                opacity: 1,
                excavate: true,
              }
            : undefined
        }
      />
      {!fullScreen ? children : null}
    </Comp>
  );
}
