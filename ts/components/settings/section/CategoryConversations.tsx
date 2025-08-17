import { SettingsKey } from '../../../data/settings-key';
import { useHasEnterSendEnabled } from '../../../state/selectors/settings';
import { SessionRadioGroup, SessionRadioItems } from '../../basic/SessionRadioGroup';
import { BlockedContactsList } from '../BlockedList';
import { SessionSettingsItemWrapper } from '../SessionSettingListItem';
import { tr } from '../../../localization/localeTools';

const EnterKeyFunctionSetting = () => {
  const initialSetting = useHasEnterSendEnabled();
  const selectedWithSettingTrue = 'enterForNewLine';

  const items: SessionRadioItems = [
    {
      label: tr('conversationsEnterSends'),
      value: 'enterForSend',
      inputDataTestId: 'input-enterForSend',
      labelDataTestId: 'label-enterForSend',
    },
    {
      label: tr('conversationsEnterNewLine'),
      value: selectedWithSettingTrue,
      inputDataTestId: `input-${selectedWithSettingTrue}`,
      labelDataTestId: `label-${selectedWithSettingTrue}`,
    },
  ];

  return (
    <SessionSettingsItemWrapper
      title={tr('conversationsEnter')}
      description={tr('conversationsEnterDescription')}
      inline={false}
    >
      <SessionRadioGroup
        initialItem={initialSetting ? 'enterForNewLine' : 'enterForSend'}
        group={SettingsKey.hasShiftSendEnabled} // make sure to define this key in your SettingsKey enum
        items={items}
        onClick={(selectedRadioValue: string) => {
          void window.setSettingValue(
            SettingsKey.hasShiftSendEnabled,
            selectedRadioValue === selectedWithSettingTrue
          );
        }}
      />
    </SessionSettingsItemWrapper>
  );
};

export const CategoryConversations = () => {
  return (
    <>
      <EnterKeyFunctionSetting />
      <BlockedContactsList />
    </>
  );
};
