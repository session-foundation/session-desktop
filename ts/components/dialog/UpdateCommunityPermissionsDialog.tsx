/* eslint-disable @typescript-eslint/no-misused-promises */

import { useState } from 'react';
import {
  ModalActionsContainer,
  ModalBasicHeader,
  ModalBottomButtonWithBorder,
  SessionWrapperModal,
} from '../SessionWrapperModal';
import { SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { OpenGroupData } from '../../data/opengroups';
import { sogsV3SetRoomPermissions } from '../../session/apis/open_group_api/sogsv3/sogsV3RoomPermissions';
import { ConvoHub } from '../../session/conversations';
import { tr } from '../../localization/localeTools';
import { PanelToggleButton } from '../buttons/panel/PanelToggleButton';
import { PanelButtonGroup, PanelButtonTextWithSubText } from '../buttons/panel/PanelButton';
import { ModalDescription } from './shared/ModalDescriptionContainer';
import { ModalFlexContainer } from './shared/ModalFlexContainer';
import { getAppDispatch } from '../../state/dispatch';
import { updateCommunityPermissionsModal } from '../../state/ducks/modalDialog';
import type { WithConvoId } from '../../session/types/with';

export function UpdateCommunityPermissionsDialog(props: WithConvoId) {
  const [defaultRead, setDefaultRead] = useState(true);
  const [defaultWrite, setDefaultWrite] = useState(true);
  const [defaultAccessible, setDefaultAccessible] = useState(true);
  const [defaultUpload, setDefaultUpload] = useState(true);
  const dispatch = getAppDispatch();

  const convo = ConvoHub.use().get(props.conversationId);

  function onClickOK() {
    if (convo.isOpenGroupV2()) {
      const roomInfos = OpenGroupData.getV2OpenGroupRoom(convo.id);
      if (!roomInfos) {
        return;
      }
      void sogsV3SetRoomPermissions(roomInfos, {
        default_accessible: defaultAccessible,
        default_read: defaultRead,
        default_upload: defaultUpload,
        default_write: defaultWrite,
      });
    }

    closeDialog();
  }

  function closeDialog() {
    dispatch(updateCommunityPermissionsModal(null));
  }

  return (
    <SessionWrapperModal
      modalId="communityPermissionsModal"
      headerChildren={<ModalBasicHeader title={tr('communityChangePermissions')} />}
      onClose={closeDialog}
      buttonChildren={
        <ModalActionsContainer buttonType={SessionButtonType.Outline}>
          <ModalBottomButtonWithBorder
            text={tr('confirm')}
            onClick={onClickOK}
            dataTestId="save-button-profile-update"
            buttonColor={SessionButtonColor.PrimaryDark}
          />
          <ModalBottomButtonWithBorder
            text={tr('cancel')}
            buttonColor={SessionButtonColor.Danger}
            buttonType={SessionButtonType.Simple}
            onClick={closeDialog}
          />
        </ModalActionsContainer>
      }
    >
      <ModalFlexContainer>
        <ModalDescription
          dataTestId="modal-description"
          localizerProps={{ token: 'communityChangePermissionsDescription' }}
        />

        <PanelButtonGroup>
          <PanelToggleButton
            textElement={
              <PanelButtonTextWithSubText
                text={{ token: 'communityPermissionAccessEnable' }}
                subText={{ token: 'communityPermissionAccessDescription' }}
                textDataTestId="invalid-data-testid"
                subTextDataTestId="invalid-data-testid"
              />
            }
            active={defaultAccessible}
            onClick={async () => setDefaultAccessible(!defaultAccessible)}
            rowDataTestId="invalid-data-testid"
            toggleDataTestId="invalid-data-testid"
          />
          <PanelToggleButton
            textElement={
              <PanelButtonTextWithSubText
                text={{ token: 'communityPermissionReadEnable' }}
                subText={{ token: 'communityPermissionReadDescription' }}
                textDataTestId="invalid-data-testid"
                subTextDataTestId="invalid-data-testid"
              />
            }
            active={defaultRead}
            onClick={async () => setDefaultRead(!defaultRead)}
            rowDataTestId="invalid-data-testid"
            toggleDataTestId="invalid-data-testid"
          />
          <PanelToggleButton
            textElement={
              <PanelButtonTextWithSubText
                text={{ token: 'communityPermissionWriteEnable' }}
                subText={{ token: 'communityPermissionWriteDescription' }}
                textDataTestId="invalid-data-testid"
                subTextDataTestId="invalid-data-testid"
              />
            }
            active={defaultWrite}
            onClick={async () => setDefaultWrite(!defaultWrite)}
            rowDataTestId="invalid-data-testid"
            toggleDataTestId="invalid-data-testid"
          />
          <PanelToggleButton
            textElement={
              <PanelButtonTextWithSubText
                text={{ token: 'communityPermissionUploadEnable' }}
                subText={{ token: 'communityPermissionUploadDescription' }}
                textDataTestId="invalid-data-testid"
                subTextDataTestId="invalid-data-testid"
              />
            }
            active={defaultUpload}
            onClick={async () => setDefaultUpload(!defaultUpload)}
            rowDataTestId="invalid-data-testid"
            toggleDataTestId="invalid-data-testid"
          />
        </PanelButtonGroup>
      </ModalFlexContainer>
    </SessionWrapperModal>
  );
}

// private onKeyUp(event: any) {
//   switch (event.key) {
//     case 'Enter':
//       this.onClickOK();
//       break;
//     case 'Esc':
//     case 'Escape':
//       this.closeDialog();
//       break;
//     default:
//   }
// }
