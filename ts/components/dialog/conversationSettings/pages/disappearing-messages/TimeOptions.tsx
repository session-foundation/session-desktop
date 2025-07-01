import { isEmpty } from 'lodash';

import { DisappearTimeOptionDataTestId } from 'react';
import {
  TimerOptionsArray,
  TimerSeconds,
} from '../../../../../session/disappearing_messages/timerOptions';
import { PanelButtonGroup, PanelButtonText, PanelLabel } from '../../../../buttons/PanelButton';
import { PanelRadioButton } from '../../../../buttons/PanelRadioButton';
import { Localizer } from '../../../../basic/Localizer';
import { assertUnreachable } from '../../../../../types/sqlSharedTypes';

type TimerOptionsProps = {
  options: TimerOptionsArray | null;
  selected: number;
  setSelected: (value: number) => void;
  hasOnlyOneMode?: boolean;
  disabled?: boolean;
};

function toMinutes(seconds: Extract<TimerSeconds, 300 | 1800>) {
  const ret = Math.floor(seconds / 60);
  if (ret !== 5 && ret !== 30) {
    throw new Error('invalid toMinutes');
  }
  return ret;
}

function toHours(seconds: Extract<TimerSeconds, 3600 | 21600 | 43200>) {
  const ret = Math.floor(seconds / 3600);
  if (ret !== 1 && ret !== 6 && ret !== 12) {
    throw new Error('invalid toHours');
  }
  return ret;
}

function toDays(seconds: Extract<TimerSeconds, 86400 | 604800 | 1209600>) {
  const ret = Math.floor(seconds / 86400);
  if (ret !== 1 && ret !== 7 && ret !== 14) {
    throw new Error('invalid toDays');
  }
  return ret;
}

function getDataTestIdFromTimerSeconds(seconds: TimerSeconds): DisappearTimeOptionDataTestId {
  switch (seconds) {
    case 0:
    case 5:
    case 10:
    case 30:
    case 60:
      return `time-option-${seconds}-seconds`;
    case 300:
    case 1800:
      return `time-option-${toMinutes(seconds)}-minutes`;
    case 3600:
    case 21600:
    case 43200:
      return `time-option-${toHours(seconds)}-hours`;
    case 86400:
    case 604800:
    case 1209600:
      return `time-option-${toDays(seconds)}-days`;
    default:
      assertUnreachable(seconds, 'getDataTestIdFromTimerSeconds: unhandled case');
      // tsc is a bit dumb sometimes and expects a return here
      throw new Error('getDataTestIdFromTimerSeconds: unhandled case');
  }
}

export const TimeOptions = (props: TimerOptionsProps) => {
  const { options, selected, setSelected, hasOnlyOneMode, disabled } = props;

  if (!options || isEmpty(options)) {
    return null;
  }

  return (
    <>
      {!hasOnlyOneMode && (
        <PanelLabel>
          <Localizer token="disappearingMessagesTimer" />
        </PanelLabel>
      )}
      <PanelButtonGroup>
        {options.map(option => {
          // we want  "time-option-1-hours", etc as accessibility id
          const parentDataTestId = getDataTestIdFromTimerSeconds(option.value);

          return (
            <PanelRadioButton
              key={option.name}
              textElement={
                <PanelButtonText
                  text={option.name}
                  textDataTestId="disappearing-messages-menu-option"
                />
              }
              value={option.name}
              isSelected={selected === option.value}
              onSelect={() => {
                setSelected(option.value);
              }}
              disabled={disabled}
              rowDataTestId={parentDataTestId}
              radioInputDataTestId={`input-${parentDataTestId}`}
            />
          );
        })}
      </PanelButtonGroup>
    </>
  );
};
