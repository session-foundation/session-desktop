import { tr } from '../../../localization/localeTools';
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
        buttonText={tr('helpReportABugExportLogs')}
        title={tr('helpReportABug')}
        description={tr('helpReportABugExportLogsSaveToDesktopDescription')}
      />
      <SessionSettingsTitleWithLink
        title={tr('helpWedLoveYourFeedback')}
        link={'https://getsession.org/survey'}
      />
      <SessionSettingsTitleWithLink
        title={tr('helpHelpUsTranslateSession')}
        link={'https://getsession.org/translate'}
      />
      <SessionSettingsTitleWithLink title={tr('helpFAQ')} link={'https://getsession.org/faq'} />
      <SessionSettingsTitleWithLink
        title={tr('helpSupport')}
        link={'https://sessionapp.zendesk.com/hc/en-us'}
      />
    </>
  );
};
