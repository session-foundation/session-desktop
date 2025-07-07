import styled, { CSSProperties } from 'styled-components';
import { Flex } from '../../basic/Flex';
import { SessionIconButton } from '../../icon';
import { SubtitleStringsType } from './ConversationHeaderTitle';
import { SessionLucideIconButton } from '../../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../../icon/lucide';

function loadDataTestId(currentSubtitle: SubtitleStringsType) {
  if (currentSubtitle === 'disappearingMessages') {
    return 'disappear-messages-type-and-time';
  }

  return 'conversation-header-subtitle';
}

export const StyledSubtitleContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
  // with the "Recreate group" button (temporary) visible, at min-width we have less room available
  min-width: 180px;

  div:first-child {
    span:last-child {
      margin-bottom: 0;
    }
  }
`;

export const StyledSubtitleDotMenu = styled(Flex)``;

const StyledSubtitleDot = styled.span<{ active: boolean }>`
  border-radius: 50%;
  background-color: ${props =>
    props.active ? 'var(--text-primary-color)' : 'var(--text-secondary-color)'};

  height: 5px;
  width: 5px;
  margin: 0 2px;
`;

export const SubtitleDotMenu = ({
  id,
  selectedOptionIndex,
  optionsCount,
  style,
}: {
  id: string;
  selectedOptionIndex: number;
  optionsCount: number;
  style: CSSProperties;
}) => (
  <StyledSubtitleDotMenu id={id} $container={true} $alignItems={'center'} style={style}>
    {Array(optionsCount)
      .fill(0)
      .map((_, index) => {
        return (
          <StyledSubtitleDot
            key={`subtitleDotMenu-${id}-${index}`}
            active={selectedOptionIndex === index}
          />
        );
      })}
  </StyledSubtitleDotMenu>
);

export type SubTitleArray = Array<{ type: SubtitleStringsType; label: string | null }>;

type CycleDirection = 1 | -1;

type ConversationHeaderSubtitleProps = {
  subtitlesArray: SubTitleArray;
  subtitleIndex: number;
  onCycle: (direction: CycleDirection) => void;
  onClickFunction: () => void;
  showDisappearingMessageIcon: boolean;
};

function CycleButton({
  onCycle,
  direction,
  cannotCycle,
}: {
  onCycle: (direction: CycleDirection) => void;
  direction: CycleDirection;
  cannotCycle: boolean;
}) {
  if (cannotCycle) {
    return null;
  }
  return (
    <SessionLucideIconButton
      iconColor={'var(--button-icon-stroke-selected-color)'}
      iconSize={'medium'}
      unicode={
        direction === 1 ? LUCIDE_ICONS_UNICODE.CHEVRON_RIGHT : LUCIDE_ICONS_UNICODE.CHEVRON_LEFT
      }
      margin={direction === 1 ? '0 0 0 3px' : '0 3px 0 0'}
      padding="0 var(--margins-xs)"
      onClick={() => onCycle(direction)}
      tabIndex={0}
    />
  );
}

export const ConversationHeaderSubtitle = (props: ConversationHeaderSubtitleProps) => {
  const { subtitlesArray, subtitleIndex, onClickFunction, showDisappearingMessageIcon, onCycle } =
    props;

  const currentSubtitle = subtitlesArray[subtitleIndex];

  if (!currentSubtitle) {
    throw new Error('currentSubtitle is undefined');
  }

  const cannotCycle = subtitlesArray.length < 2;

  return (
    <StyledSubtitleContainer>
      <Flex
        $container={true}
        $flexDirection={'row'}
        $justifyContent={cannotCycle ? 'center' : 'space-between'}
        $alignItems={'center'}
        width={'100%'}
      >
        <CycleButton onCycle={onCycle} direction={-1} cannotCycle={cannotCycle} />
        {showDisappearingMessageIcon && (
          <SessionIconButton
            iconColor={'var(--button-icon-stroke-selected-color)'}
            iconSize={'small'}
            iconType="timerFixed"
            margin={'0 var(--margins-xs) 0 0'}
          />
        )}
        <span
          role="button"
          className="module-conversation-header__title-text"
          onClick={onClickFunction}
          onKeyPress={(e: any) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onClickFunction();
            }
          }}
          tabIndex={0}
          data-testid={loadDataTestId(currentSubtitle.type)}
        >
          {currentSubtitle.label}
        </span>
        <CycleButton onCycle={onCycle} direction={1} cannotCycle={cannotCycle} />
      </Flex>
    </StyledSubtitleContainer>
  );
};
