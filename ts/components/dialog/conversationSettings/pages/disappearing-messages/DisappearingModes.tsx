import { tr } from '../../../../../localization/localeTools';
import { DisappearingMessageConversationModeType } from '../../../../../session/disappearing_messages/types';
import {
  PanelButtonGroup,
  PanelButtonText,
  PanelButtonTextWithSubText,
  PanelLabelWithDescription,
} from '../../../../buttons/panel/PanelButton';
import { PanelRadioButton } from '../../../../buttons/panel/PanelRadioButton';

function toDataTestId(mode: DisappearingMessageConversationModeType) {
  switch (mode) {
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
  singleMode?: DisappearingMessageConversationModeType;
};

export const DisappearingModes = (props: DisappearingModesProps) => {
  const { options, selected, setSelected, hasOnlyOneMode, singleMode } = props;

  if (hasOnlyOneMode) {
    return null;
  }

  return (
    <>
      <PanelLabelWithDescription
        title={{ token: 'disappearingMessagesDeleteType' }}
        description={{
          token:
            singleMode === 'deleteAfterRead'
              ? 'disappearingMessagesDisappearAfterReadDescription'
              : singleMode === 'deleteAfterSend'
                ? 'disappearingMessagesDisappearAfterSendDescription'
                : 'disappearingMessagesDescription1',
        }}
      />
      <PanelButtonGroup>
        {Object.keys(options).map(_mode => {
          const mode = _mode as DisappearingMessageConversationModeType;
          const optionI18n =
            mode === 'deleteAfterRead'
              ? tr('disappearingMessagesDisappearAfterRead')
              : mode === 'deleteAfterSend'
                ? tr('disappearingMessagesDisappearAfterSend')
                : tr('off');

          const subtitleI18n =
            mode === 'deleteAfterRead'
              ? tr('disappearingMessagesDisappearAfterReadDescription')
              : mode === 'deleteAfterSend'
                ? tr('disappearingMessagesDisappearAfterSendDescription')
                : undefined;
          const parentDataTestId = toDataTestId(mode);

          return (
            <PanelRadioButton
              key={mode}
              textElement={
                subtitleI18n ? (
                  <PanelButtonTextWithSubText
                    text={optionI18n}
                    subText={subtitleI18n}
                    textDataTestId="disappearing-messages-menu-option"
                    subTextDataTestId="disappearing-messages-timer-menu-option"
                  />
                ) : (
                  <PanelButtonText
                    text={optionI18n}
                    textDataTestId="disappearing-messages-menu-option"
                  />
                )
              }
              value={mode}
              isSelected={selected === mode}
              onSelect={() => {
                setSelected(mode);
              }}
              disabled={options[mode]}
              rowDataTestId={parentDataTestId}
              radioInputDataTestId={`input-${parentDataTestId}`}
            />
          );
        })}
      </PanelButtonGroup>
    </>
  );
};
