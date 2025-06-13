import { joinOpenGroupV2WithUIEvents } from '../session/apis/open_group_api/opengroupV2/JoinOpenGroupV2';
import { openGroupV2CompleteURLRegex } from '../session/apis/open_group_api/utils/OpenGroupUtils';
import { ToastUtils } from '../session/utils';

import { updateConfirmModal } from '../state/ducks/modalDialog';

export function copyBodyToClipboard(body?: string | null) {
  if (body) {
    window.clipboard.writeText(body);

    ToastUtils.pushCopiedToClipBoard();
  }
}

const acceptOpenGroupInvitationV2 = (completeUrl: string, roomName?: string) => {
  const onClickClose = () => {
    window.inboxStore?.dispatch(updateConfirmModal(null));
  };

  window.inboxStore?.dispatch(
    updateConfirmModal({
      title: window.i18n('communityJoin'),
      i18nMessage: {
        token: 'communityJoinDescription',
        args: {
          community_name: roomName || window.i18n('unknown'),
        },
      },
      onClickOk: async () => {
        await joinOpenGroupV2WithUIEvents(completeUrl, true);
      },

      onClickClose,
      okText: window.i18n('join'),
    })
  );
  // this function does not throw, and will showToasts if anything happens
};

/**
 * Accepts a v2 url open group invitation (with pubkey) or just log an error
 */
export const acceptOpenGroupInvitation = (completeUrl: string, roomName?: string) => {
  if (completeUrl.match(openGroupV2CompleteURLRegex)) {
    acceptOpenGroupInvitationV2(completeUrl, roomName);
  } else {
    window?.log?.warn('Invalid opengroup url:', completeUrl);
  }
};
