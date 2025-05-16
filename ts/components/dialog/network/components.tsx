import styled from 'styled-components';
import { ReactNode, useState, type SessionDataTestId } from 'react';
import useInterval from 'react-use/lib/useInterval';
import { Flex } from '../../basic/Flex';
import { getThemeValue } from '../../../themes/globals';
import { hexColorToRGB } from '../../../util/hexColorToRGB';
import { formatAbbreviatedExpireDoubleTimer } from '../../../util/i18n/formatting/expirationTimer';
import { DURATION } from '../../../session/constants';
import { localize } from '../../../localization/localeTools';
import { useInfoLoading, useLastRefreshedTimestamp } from '../../../state/selectors/networkModal';
import { SessionButton, type SessionButtonProps } from '../../basic/SessionButton';

export const SessionNetworkButton = styled(SessionButton)<SessionButtonProps>`
  font-size: var(--font-display-size-lg);
  font-weight: 400;
  width: 100%;
  height: 40px;
`;

export const SectionHeading = styled.h3<{
  margin?: string;
  textAlignment?: 'start' | 'center' | 'end';
}>`
  direction: 'auto';
  color: var(--text-secondary-color);
  font-family: var(--font-default);
  font-size: var(--font-size-md);
  font-weight: 400;
  line-height: var(--font-line-height);
  width: 100%;
  padding: 0;
  margin: ${props => props.margin ?? '0'};
  text-align: ${props => props.textAlignment ?? 'start'};
`;

export const SessionNetworkHeading = styled.h4<{
  color?: string;
  textAlignment?: 'start' | 'center' | 'end';
  width?: string;
}>`
  direction: 'auto';
  font-family: var(--font-default);
  font-size: var(--font-display-size-lg);
  font-weight: 700;
  line-height: var(--font-line-height);
  padding: 0;
  margin: 0;

  text-align: ${props => props.textAlignment ?? 'start'};
  ${props => props.color && `color: ${props.color};`}
  ${props => props.width && `width: ${props.width};`}
`;

type SessionNetworkParagraphProps = {
  children: ReactNode;
  interactive?: boolean;
  onClick?: () => void;
  textAlignment?: 'start' | 'center' | 'end';
  width?: string;
  color?: string;
};

const StyledSessionNetworkParagraph = styled.p<SessionNetworkParagraphProps>`
  direction: 'auto';
  font-family: var(--font-default);
  font-size: var(--font-display-size-lg);
  font-weight: 400;
  line-height: var(--font-line-height);
  padding: 0;
  margin: 0;

  /* NOTE we want to bold Learn CTA */
  ${props =>
    props.interactive &&
    'cursor: pointer; div span { font-weight: 700; span[role="img"] { font-weight: unset; } }'}
  ${props => props.width && `width: ${props.width};`}
  text-align: ${props => props.textAlignment ?? 'start'};
  ${props => props.color && `color: ${props.color};`}
`;

export const SessionNetworkParagraph = (props: SessionNetworkParagraphProps) => {
  return <StyledSessionNetworkParagraph {...props} role={props.interactive ? 'link' : undefined} />;
};

export const ExtraSmallText = styled.p<{
  color?: string;
  margin?: string;
  textAlignment?: 'start' | 'center' | 'end';
}>`
  direction: 'auto';
  font-family: var(--font-default);
  font-size: var(--font-size-md);
  font-weight: 400;
  line-height: var(--font-line-height);
  width: 100%;
  padding: 0;
  margin: ${props => props.margin ?? '0'};
  text-align: ${props => props.textAlignment ?? 'start'};
  ${props => props.color && `color: ${props.color};`}
`;

export const Block = styled(Flex)<{ backgroundColor?: string; borderColor?: string }>`
  position: relative;
  ${props => props.backgroundColor && `background-color: ${props.backgroundColor};`};
  border-radius: 8px;
  border: 1px solid ${props => props.borderColor ?? 'var(--border-color)'};
  font-size: var(--font-display-size-lg);
  line-height: var(--font-line-height);
`;

export const BlockText = styled.p`
  font-size: var(--font-size-md);
  direction: 'auto';
  line-height: var(--font-line-height);
  padding: 0;
  margin: 0;
`;

const StyledBlockPrimaryText = styled(BlockText)`
  color: var(--renderer-span-primary-color);
  font-size: var(--font-size-h5);
`;

export const BlockPrimaryText = ({
  children,
  dataTestId,
}: {
  children: ReactNode;
  dataTestId?: SessionDataTestId;
}) => {
  return <StyledBlockPrimaryText data-testid={dataTestId}>{children}</StyledBlockPrimaryText>;
};

export const BlockSecondaryText = styled(BlockText)`
  color: var(--text-secondary-color);
  font-size: var(--font-size-md);
`;

type GradientProps = {
  paddingY?: string;
  paddingX?: string;
};

const Gradient = styled.div<GradientProps>`
  position: absolute;
  height: 100%;
  width: 100%;
  background-image: linear-gradient(
    to right,
    var(--modal-background-content-color),
    transparent,
    var(--modal-background-content-color)
  );

  ${props =>
    props.paddingX &&
    `margin-left: calc(-1 * ${props.paddingX}); margin-right: calc(-1 * ${props.paddingX});`}
  ${props =>
    props.paddingY &&
    `margin-top: calc(-1 * ${props.paddingY}); margin-bottom: calc(-1 * ${props.paddingY});`}
`;

const GradientPrimary = styled(Gradient)<GradientProps & { color: string }>`
  background-image: linear-gradient(transparent, ${props => props.color}, transparent);
`;

/**
 * A container with a magical blurred gradient effect in the background.
 */
type GradientContainerProps = {
  height?: string;
  width?: string;
  paddingInline?: string;
  paddingBlock?: string;
};

const GradientContainer = styled.div<GradientContainerProps>`
  position: relative;
  ${props => props.height && `height: ${props.height};`}
  ${props => props.width && `width: ${props.width};`}
  ${props => props.paddingInline && `padding-inline: ${props.paddingInline};`}
  ${props => props.paddingBlock && `padding-block: ${props.paddingBlock};`}
`;

export const BackgroundGradientContainer = ({
  children,
  noGradient,
  height,
  width,
  paddingInline,
  paddingBlock,
}: GradientContainerProps & {
  children: ReactNode;
  noGradient?: boolean;
}) => {
  const gradientColor = `rgba(${hexColorToRGB(getThemeValue('--primary-color'))}, 0.25)`;

  return (
    <GradientContainer
      height={height}
      width={width}
      paddingInline={paddingInline}
      paddingBlock={paddingBlock}
    >
      {!noGradient ? (
        <>
          <GradientPrimary color={gradientColor} />
          <Gradient />
        </>
      ) : null}
      <div style={{ position: 'relative' }}>{children}</div>
    </GradientContainer>
  );
};

function formatTimeRefreshed({ timeRefreshed }: { timeRefreshed: number }) {
  const timeRefreshedSeconds = Math.floor(timeRefreshed / 1000);

  const [time_large, time_small] = formatAbbreviatedExpireDoubleTimer(
    timeRefreshedSeconds <= 60 ? 60 : timeRefreshedSeconds
  );

  if (time_large || time_small) {
    // NOTE if the time is less than 60 seconds, we want to show 0 minutes. So we follow the time format in formatAbbreviatedExpireDoubleTimer()
    const relative_time = timeRefreshedSeconds <= 60 ? '0m' : time_large || time_small;

    return localize('updated').withArgs({ relative_time }).toString();
  }

  throw new Error('formatTimeLeft unexpected duration given');
}

/**
 *
 * @param timestamp - unix timestamp
 * @returns
 */
export const LastRefreshedText = () => {
  const timestamp = useLastRefreshedTimestamp();
  const loading = useInfoLoading();
  const [timeRefreshed, setTimeRefreshed] = useState(Date.now() - timestamp);

  useInterval(() => {
    if (loading) {
      return;
    }
    const newValue = Date.now() - timestamp;
    setTimeRefreshed(newValue);
  }, 1 * DURATION.SECONDS);

  return <span data-testid="last-updated-timestamp">{formatTimeRefreshed({ timeRefreshed })}</span>;
};
