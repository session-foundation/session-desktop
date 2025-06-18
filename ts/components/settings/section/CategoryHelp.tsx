import { localize } from '../../../localization/localeTools';
import { saveLogToDesktop } from '../../../util/logger/renderer_process_logging';
import { SessionButtonShape, SessionButtonType } from '../../basic/SessionButton';

import { SessionSettingButtonItem, SessionSettingsTitleWithLink } from '../SessionSettingListItem';

export const SettingsCategoryHelp = () => {
  return (
    <>
      <SessionSettingButtonItem
        onClick={() => {
          void saveLogToDesktop();
        }}
        buttonShape={SessionButtonShape.Square}
        buttonType={SessionButtonType.Solid}
        buttonText={localize('helpReportABugExportLogs').toString()}
        title={localize('helpReportABug').toString()}
        description={localize('helpReportABugExportLogsSaveToDesktopDescription').toString()}
      />
      <SessionSettingsTitleWithLink
        title={localize('helpWedLoveYourFeedback').toString()}
        link={'https://getsession.org/survey'}
      />
      <SessionSettingsTitleWithLink
        title={localize('helpHelpUsTranslateSession').toString()}
        link={'https://getsession.org/translate'}
      />
      <SessionSettingsTitleWithLink
        title={localize('helpFAQ').toString()}
        link={'https://getsession.org/faq'}
      />
      <SessionSettingsTitleWithLink
        title={localize('helpSupport').toString()}
        link={'https://sessionapp.zendesk.com/hc/en-us'}
      />
    </>
  );
};
