import { useDispatch } from 'react-redux';

import { tr } from '../../../../localization/localeTools';
import { type UserSettingsModalState } from '../../../../state/ducks/modalDialog';
import { PanelButtonGroup, PanelLabelWithDescription } from '../../../buttons/panel/PanelButton';
import {
  ModalBasicHeader,
  SessionWrapperModal,
  WrapperModalWidth,
} from '../../../SessionWrapperModal';
import { ModalBackButton } from '../../shared/ModalBackButton';
import {
  useUserSettingsBackAction,
  useUserSettingsCloseAction,
  useUserSettingsTitle,
} from './userSettingsHooks';
import { SessionButtonColor } from '../../../basic/SessionButton';
import { saveLogToDesktop } from '../../../../util/logger/renderer_process_logging';
import { SettingsPanelButtonInlineBasic } from '../components/SettingsPanelButtonInlineBasic';
import { SettingsExternalLinkBasic } from '../components/SettingsExternalLinkBasic';
import { showLinkVisitWarningDialog } from '../../OpenUrlModal';

export function HelpSettingsPage(modalState: UserSettingsModalState) {
  const backAction = useUserSettingsBackAction(modalState);
  const closeAction = useUserSettingsCloseAction(modalState);
  const title = useUserSettingsTitle(modalState);

  const dispatch = useDispatch();

  return (
    <SessionWrapperModal
      headerChildren={
        <ModalBasicHeader
          title={title}
          bigHeader={true}
          showExitIcon={true}
          extraLeftButton={backAction ? <ModalBackButton onClick={backAction} /> : undefined}
        />
      }
      onClose={closeAction || undefined}
      shouldOverflow={true}
      allowOutsideClick={false}
      $contentMinWidth={WrapperModalWidth.normal}
    >
      <PanelLabelWithDescription title={{ token: 'logs' }} />
      <PanelButtonGroup>
        <SettingsPanelButtonInlineBasic
          baseDataTestId="export-logs"
          text={{ token: 'helpReportABug' }}
          subText={{ token: 'helpReportABugExportLogsSaveToDesktopDescription' }}
          onClick={async () => saveLogToDesktop()}
          buttonColor={SessionButtonColor.Primary}
          buttonText={tr('helpReportABugExportLogs')}
        />
      </PanelButtonGroup>
      <PanelLabelWithDescription title={{ token: 'links' }} />
      <PanelButtonGroup>
        <SettingsExternalLinkBasic
          baseDataTestId="faq"
          text={{ token: 'helpFAQ' }}
          subText={{ token: 'helpFAQDescription' }}
          onClick={async () => {
            showLinkVisitWarningDialog('https://getsession.org/faq', dispatch);
          }}
        />
        <SettingsExternalLinkBasic
          baseDataTestId="translate"
          text={{ token: 'translate' }}
          subText={{ token: 'helpTranslateSessionDescription' }}
          onClick={async () => {
            showLinkVisitWarningDialog('https://getsession.org/translate', dispatch);
          }}
        />

        <SettingsExternalLinkBasic
          baseDataTestId="feedback"
          text={{ token: 'feedback' }}
          subText={{ token: 'feedbackDescription' }}
          onClick={async () => {
            showLinkVisitWarningDialog('https://getsession.org/survey', dispatch);
          }}
        />
        <SettingsExternalLinkBasic
          baseDataTestId="support"
          text={{ token: 'helpSupport' }}
          subText={{ token: 'supportDescription' }}
          onClick={async () => {
            showLinkVisitWarningDialog('https://sessionapp.zendesk.com/hc/en-us', dispatch);
          }}
        />
      </PanelButtonGroup>
    </SessionWrapperModal>
  );
}
