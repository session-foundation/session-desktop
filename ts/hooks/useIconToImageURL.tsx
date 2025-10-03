import { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import useMount from 'react-use/lib/useMount';
import { SessionIcon, SessionIconProps, SessionIconType } from '../components/icon';
import { sleepFor } from '../session/utils/Promise';
import { useIsDarkTheme } from '../state/theme/selectors/theme';
import { ThemeKeys, getThemeValue } from '../themes/globals';

const chooseIconColors = (
  defaultColor: ThemeKeys,
  darkColor?: ThemeKeys,
  lightColor?: ThemeKeys,
  isDarkTheme?: boolean
) => {
  return getThemeValue(
    darkColor && lightColor ? (isDarkTheme ? darkColor : lightColor) : defaultColor
  );
};

export const convertIconToImageURL = async (
  props: Pick<SessionIconProps, 'iconType' | 'iconSize'> & {
    isDarkTheme?: boolean;
  }
): Promise<{ dataUrl: string; bgColor: string; fgColor: string }> => {
  const { iconType, iconSize, isDarkTheme } = props;

  const fgColor = chooseIconColors(
    '--black-color',
    '--background-primary-color',
    '--text-primary-color',
    isDarkTheme
  );

  const bgColor = chooseIconColors(
    '--white-color',
    '--text-primary-color',
    '--background-primary-color',
    isDarkTheme
  );

  const root = document.querySelector('#root');
  const divElement = document.createElement('div');
  divElement.id = 'icon-to-image-url';
  divElement.style.display = 'none';
  root?.appendChild(divElement);

  const reactRoot = createRoot(divElement!);
  reactRoot.render(
    <SessionIcon
      iconType={iconType}
      iconSize={iconSize}
      iconColor={fgColor}
      backgroundColor={bgColor}
    />
  );
  // wait for it to render
  await sleepFor(200);

  const svg = root?.querySelector(`#icon-to-image-url svg`);
  svg?.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const svgString = svg?.outerHTML;
  reactRoot?.unmount();
  root?.removeChild(divElement);

  return {
    bgColor,
    fgColor,
    dataUrl: svgString ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}` : '',
  };
};

export const useIconToImageURL = ({
  iconType,
  iconSize,
}: {
  iconType: SessionIconType;
  iconSize: number;
}) => {
  const isDarkTheme = useIsDarkTheme();
  const [dataURL, setDataURL] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [inDarkTheme, setInDarkTheme] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState('');
  const [iconColor, setIconColor] = useState('');

  const loadURL = useCallback(async () => {
    setLoading(true);
    setDataURL('');

    try {
      const {
        dataUrl: newURL,
        bgColor,
        fgColor,
      } = await convertIconToImageURL({
        iconType,
        iconSize,
        isDarkTheme,
      });

      if (!newURL) {
        throw new Error('[useIconToImageURL] Failed to convert icon to URL');
      }

      setInDarkTheme(isDarkTheme);
      setBackgroundColor(bgColor);
      setIconColor(fgColor);
      setDataURL(newURL);

      if (!mounted) {
        setMounted(true);
      }
      setLoading(false);
    } catch (error) {
      window.log.error('[useIconToImageURL] Error fetching icon data url', error);
    }
  }, [iconSize, iconType, isDarkTheme, mounted]);

  useMount(() => {
    void loadURL();
  });

  useEffect(() => {
    if (!loading && mounted && isDarkTheme !== inDarkTheme) {
      void loadURL();
    }
  }, [inDarkTheme, isDarkTheme, loadURL, loading, mounted]);

  return { dataURL, iconSize, iconColor, backgroundColor, loading };
};
