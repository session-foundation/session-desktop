import { useRef, useState } from 'react';
import styled from 'styled-components';
import useUpdate from 'react-use/lib/useUpdate';
import { SessionTooltip, type TooltipProps, useTriggerPosition } from '../../../SessionTooltip';
import { FlagToggle } from '../FeatureFlags';
import { getFeatureFlag } from '../../../../state/ducks/types/releasedFeaturesReduxTypes';
import { SessionHtmlRenderer } from '../../../basic/SessionHTMLRenderer';
import { type PopoverProps, SessionPopoverContent } from '../../../SessionPopover';
import { SessionButton } from '../../../basic/SessionButton';
import { SpacerXS } from '../../../basic/Text';
import { SimpleSessionInput } from '../../../inputs/SessionInput';

const StyledPopoverContainer = styled.div<{ marginTop?: number; marginBottom?: number }>`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  align-self: center;
  margin-top: ${({ marginTop }) => marginTop ?? 0}px;
  margin-bottom: ${({ marginBottom }) => marginBottom ?? 0}px;
`;
const StyledTrigger = styled.div`
  font-size: var(--text-size-xs);
  padding-top: var(--margins-xxs);
  padding-bottom: var(--margins-xxs);
  text-align: center;
  width: 90px;
  border: 1px solid red;
`;

function PopoverGrid(
  props: Omit<PopoverProps, 'triggerX' | 'triggerY' | 'triggerHeight' | 'triggerWidth'>
) {
  const r1 = useRef<HTMLDivElement>(null);
  const r2 = useRef<HTMLDivElement>(null);
  const r3 = useRef<HTMLDivElement>(null);
  const r4 = useRef<HTMLDivElement>(null);
  const r5 = useRef<HTMLDivElement>(null);
  const r6 = useRef<HTMLDivElement>(null);

  const t1 = useTriggerPosition(r1);
  const t2 = useTriggerPosition(r2);
  const t3 = useTriggerPosition(r3);
  const t4 = useTriggerPosition(r4);
  const t5 = useTriggerPosition(r5);
  const t6 = useTriggerPosition(r6);

  return (
    <>
      <StyledPopoverContainer marginTop={40}>
        <StyledTrigger ref={r1}>Left</StyledTrigger>
        <SessionPopoverContent
          {...props}
          {...t1}
          horizontalPosition="left"
          verticalPosition="top"
        />
        <StyledTrigger ref={r2}>Center</StyledTrigger>
        <SessionPopoverContent
          {...props}
          {...t2}
          horizontalPosition="center"
          verticalPosition="top"
        />
        <StyledTrigger ref={r3}>Right</StyledTrigger>
        <SessionPopoverContent
          {...props}
          {...t3}
          horizontalPosition="right"
          verticalPosition="top"
        />
      </StyledPopoverContainer>
      <StyledPopoverContainer marginBottom={40}>
        <StyledTrigger ref={r4}>Left</StyledTrigger>
        <SessionPopoverContent
          {...props}
          {...t4}
          horizontalPosition="left"
          verticalPosition="bottom"
        />
        <StyledTrigger ref={r5}>Center</StyledTrigger>
        <SessionPopoverContent
          {...props}
          {...t5}
          horizontalPosition="center"
          verticalPosition="bottom"
        />
        <StyledTrigger ref={r6}>Right</StyledTrigger>
        <SessionPopoverContent
          {...props}
          {...t6}
          horizontalPosition="right"
          verticalPosition="bottom"
        />
      </StyledPopoverContainer>
    </>
  );
}

function TooltipGrid(props: Omit<TooltipProps, 'children'>) {
  return (
    <>
      <StyledPopoverContainer marginTop={40}>
        <SessionTooltip {...props} horizontalPosition="left" verticalPosition="top">
          <StyledTrigger>Left</StyledTrigger>
        </SessionTooltip>
        <SessionTooltip {...props} horizontalPosition="center" verticalPosition="top">
          <StyledTrigger>Center</StyledTrigger>
        </SessionTooltip>
        <SessionTooltip {...props} horizontalPosition="right" verticalPosition="top">
          <StyledTrigger>Right</StyledTrigger>
        </SessionTooltip>
      </StyledPopoverContainer>
      <StyledPopoverContainer marginBottom={40}>
        <SessionTooltip {...props} horizontalPosition="left" verticalPosition="bottom">
          <StyledTrigger>Left</StyledTrigger>
        </SessionTooltip>
        <SessionTooltip {...props} horizontalPosition="center" verticalPosition="bottom">
          <StyledTrigger>Center</StyledTrigger>
        </SessionTooltip>
        <SessionTooltip {...props} horizontalPosition="right" verticalPosition="bottom">
          <StyledTrigger>Right</StyledTrigger>
        </SessionTooltip>
      </StyledPopoverContainer>
    </>
  );
}

export function PopoverPlaygroundPage() {
  const forceUpdate = useUpdate();
  const [content, setContent] = useState('Popover content');
  const [tooltipsOpen, setTooltipsOpen] = useState(true);
  const [popoversOpen, setPopoversOpen] = useState(false);

  const contentHtml = <SessionHtmlRenderer html={content} />;

  return (
    <>
      <h2>Flags</h2>
      <FlagToggle
        forceUpdate={forceUpdate}
        flag="useShowPopoverAnchors"
        value={getFeatureFlag('useShowPopoverAnchors')}
      />
      <h2>Settings</h2>
      <span>
        {'You can change the popover content with this input. It will parse HTML tags like <br>.'}
        {'You may need to move the mouse to trigger a re-render after some input changes.'}
      </span>
      <SpacerXS />

      <SimpleSessionInput
        onValueChanged={setContent}
        value={content}
        placeholder="content"
        errorDataTestId="invalid-data-testid"
        onEnterPressed={() => undefined}
        providedError={undefined}
      />
      <h2>Tooltip</h2>
      <h3>Controlled</h3>
      <SessionButton onClick={() => setTooltipsOpen(prev => !prev)}>
        {tooltipsOpen ? 'Close' : 'Open'}
      </SessionButton>
      <TooltipGrid content={contentHtml} open={tooltipsOpen} />
      <h3>Hover</h3>
      <TooltipGrid content={contentHtml} />
      <h2>Popover</h2>
      <h3>Controlled</h3>
      <SessionButton onClick={() => setPopoversOpen(prev => !prev)}>
        {popoversOpen ? 'Close' : 'Open'}
      </SessionButton>
      <PopoverGrid open={popoversOpen}>{contentHtml}</PopoverGrid>
    </>
  );
}
