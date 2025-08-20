import type { DisappearingMessageConversationModeType } from 'libsession_util_nodejs';
import { isEmpty } from 'lodash';

import { DisappearTimeOptionDataTestId } from 'react';
import {
  TimerOptions,
  TimerSeconds,
} from '../../../../../session/disappearing_messages/timerOptions';
import {
  PanelButtonGroup,
  PanelButtonText,
  PanelLabelWithDescription,
} from '../../../../buttons/panel/PanelButton';
import { PanelRadioButton } from '../../../../buttons/panel/PanelRadioButton';
import { assertUnreachable } from '../../../../../types/sqlSharedTypes';
import { tr } from '../../../../../localization/localeTools';

// Note: label cannot be a trArgs as it is dynamic based on the timer set (using date-fns)
type TimerOptionsEntry = { value: TimerSeconds; label: string };
type TimerOptionsArray = Array<TimerOptionsEntry>;

type TimerOptionsProps = {
  modeSelected: DisappearingMessageConversationModeType;
  selected: number;
  setSelected: (value: number) => void;
  hasOnlyOneMode?: boolean;
  disabled?: boolean;
};

function useTimerOptionsByMode(
  disappearingMessageMode: DisappearingMessageConversationModeType,
  hasOnlyOneMode: boolean
) {
  const options: TimerOptionsArray = [];
  if (hasOnlyOneMode) {
    options.push({
      label: tr('off'),
      value: TimerOptions.VALUES[0],
    });
  }
  switch (disappearingMessageMode) {
    case 'deleteAfterRead':
      options.push(
        ...TimerOptions.DELETE_AFTER_READ.map(option => ({
          label: TimerOptions.getName(option),
          value: option,
        }))
      );
      break;
    case 'deleteAfterSend':
      options.push(
        ...TimerOptions.DELETE_AFTER_SEND.map(option => ({
          label: TimerOptions.getName(option),
          value: option,
        }))
      );
      break;
    default:
      return [];
  }
  return options;
}

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
  const { modeSelected, selected, setSelected, hasOnlyOneMode, disabled } = props;

  const options = useTimerOptionsByMode(modeSelected, hasOnlyOneMode ?? false);

  if (!options || isEmpty(options)) {
    return null;
  }

  return (
    <>
      {!hasOnlyOneMode && (
        <PanelLabelWithDescription title={{ token: 'disappearingMessagesTimer' }} />
      )}
      <PanelButtonGroup>
        {options.map(option => {
          // we want  "time-option-1-hours", etc as accessibility id
          const parentDataTestId = getDataTestIdFromTimerSeconds(option.value);

          return (
            <PanelRadioButton
              key={option.value}
              textElement={
                <PanelButtonText
                  label={option.label}
                  textDataTestId="disappearing-messages-menu-option"
                />
              }
              value={option.value}
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
