import styled, { CSSProperties } from 'styled-components';
import { Flex } from '../../basic/Flex';
import { SessionIconButton } from '../../icon';
import { SubtitleStringsType } from './ConversationHeaderTitle';

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

type ConversationHeaderSubtitleProps = {
  subtitlesArray: SubTitleArray;
  subtitleIndex: number;
  onCycle: (direction: 1 | -1) => void;
  onClickFunction: () => void;
  showDisappearingMessageIcon: boolean;
};

export const ConversationHeaderSubtitle = (props: ConversationHeaderSubtitleProps) => {
  const { subtitlesArray, subtitleIndex, onClickFunction, showDisappearingMessageIcon, onCycle } =
    props;

  const currentSubtitle = subtitlesArray[subtitleIndex];

  if (!currentSubtitle) {
    throw new Error('currentSubtitle is undefined');
  }

  return (
    <StyledSubtitleContainer>
      <Flex
        $container={true}
        $flexDirection={'row'}
        $justifyContent={subtitlesArray.length < 2 ? 'center' : 'space-between'}
        $alignItems={'center'}
        width={'100%'}
      >
        <SessionIconButton
          iconColor={'var(--button-icon-stroke-selected-color)'}
          iconSize={'small'}
          iconType="chevron"
          iconRotation={90}
          margin={'0 3px 0 0'}
          onClick={() => {
            onCycle(-1);
          }}
          isHidden={subtitlesArray.length < 2}
          tabIndex={0}
        />
        {showDisappearingMessageIcon && (
          <SessionIconButton
            iconColor={'var(--button-icon-stroke-selected-color)'}
            iconSize={'tiny'}
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
        <SessionIconButton
          iconColor={'var(--button-icon-stroke-selected-color)'}
          iconSize={'small'}
          iconType="chevron"
          iconRotation={270}
          margin={'0 0 0 3px'}
          onClick={() => {
            onCycle(1);
          }}
          isHidden={subtitlesArray.length < 2}
          tabIndex={0}
        />
      </Flex>
      <SubtitleDotMenu
        id={'conversation-header-subtitle-dots'}
        selectedOptionIndex={subtitlesArray.indexOf(currentSubtitle)}
        optionsCount={subtitlesArray.length}
        style={{ display: subtitlesArray.length < 2 ? 'none' : undefined, margin: '8px 0' }}
      />
    </StyledSubtitleContainer>
  );
};
