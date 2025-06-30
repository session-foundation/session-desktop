import { SessionDataTestId, useState } from 'react';

import useMount from 'react-use/lib/useMount';
import styled, { CSSProperties } from 'styled-components';

import { SessionRadio } from './SessionRadio';

export type SessionRadioItems = Array<{
  value: string;
  label: string;
  inputDataTestId: SessionDataTestId;
  labelDataTestId: SessionDataTestId;
}>;

interface Props {
  initialItem: string;
  items: SessionRadioItems;
  group: string;
  onClick: (selectedValue: string) => void;
  style?: CSSProperties;
}

const StyledFieldSet = styled.fieldset`
  display: flex;
  flex-direction: column;

  border: none;
  margin-inline-start: var(--margins-sm);
  margin-top: var(--margins-sm);

  min-width: 300px; // so it doesn't look too weird on the modal (which is 410px wide)

  & > div {
    padding: var(--margins-md) 7px;
  }
`;

export const SessionRadioGroup = (props: Props) => {
  const { items, group, initialItem, style } = props;
  const [activeItem, setActiveItem] = useState('');

  useMount(() => {
    setActiveItem(initialItem);
  });

  return (
    <StyledFieldSet id={group} style={style}>
      {items.map(item => {
        const itemIsActive = item.value === activeItem;

        return (
          <SessionRadio
            key={item.value}
            label={item.label}
            active={itemIsActive}
            value={item.value}
            inputDataTestId={item.inputDataTestId}
            labelDataTestId={item.labelDataTestId}
            inputName={group}
            onClick={(value: string) => {
              setActiveItem(value);
              props.onClick(value);
            }}
            style={{ textAlign: 'start' }}
          />
        );
      })}
    </StyledFieldSet>
  );
};
