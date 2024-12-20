import { DisappearingMessageConversationModeType } from '../../../../../session/disappearing_messages/types';
import { Localizer } from '../../../../basic/Localizer';
import { PanelButtonGroup, PanelLabel } from '../../../../buttons/PanelButton';
import { PanelRadioButton } from '../../../../buttons/PanelRadioButton';

function toDataTestId(mode: DisappearingMessageConversationModeType) {
  switch (mode) {
    case 'legacy':
      return 'disappear-legacy-option' as const;
    case 'deleteAfterRead':
      return 'disappear-after-read-option' as const;
    case 'deleteAfterSend':
      return 'disappear-after-send-option' as const;
    case 'off':
    default:
      return 'disappear-off-option' as const;
  }
}

type DisappearingModesProps = {
  options: Record<DisappearingMessageConversationModeType, boolean>;
  selected?: DisappearingMessageConversationModeType;
  setSelected: (value: DisappearingMessageConversationModeType) => void;
  hasOnlyOneMode?: boolean;
};

export const DisappearingModes = (props: DisappearingModesProps) => {
  const { options, selected, setSelected, hasOnlyOneMode } = props;

  if (hasOnlyOneMode) {
    return null;
  }

  return (
    <>
      <PanelLabel>
        <Localizer token="disappearingMessagesDeleteType" />
      </PanelLabel>
      <PanelButtonGroup>
        {Object.keys(options).map(_mode => {
          const mode = _mode as DisappearingMessageConversationModeType;
          const optionI18n =
            mode === 'legacy'
              ? '' // TODO: to cleanup when we remove legacy entirely
              : mode === 'deleteAfterRead'
                ? window.i18n('disappearingMessagesDisappearAfterRead')
                : mode === 'deleteAfterSend'
                  ? window.i18n('disappearingMessagesDisappearAfterSend')
                  : window.i18n('off');

          const subtitleI18n =
            mode === 'legacy'
              ? '' // TODO: to cleanup when we remove legacy entirely
              : mode === 'deleteAfterRead'
                ? window.i18n('disappearingMessagesDisappearAfterReadDescription')
                : mode === 'deleteAfterSend'
                  ? window.i18n('disappearingMessagesDisappearAfterSendDescription')
                  : undefined;
          const parentDataTestId = toDataTestId(mode);

          return (
            <PanelRadioButton
              key={mode}
              text={optionI18n}
              subtitle={subtitleI18n}
              value={mode}
              isSelected={selected === mode}
              onSelect={() => {
                setSelected(mode);
              }}
              disabled={options[mode]}
              dataTestId={parentDataTestId}
              radioInputDataTestId={`input-${parentDataTestId}`}
            />
          );
        })}
      </PanelButtonGroup>
    </>
  );
};
