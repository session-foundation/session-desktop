/* eslint-disable @typescript-eslint/no-misused-promises */
import autoBind from 'auto-bind';

import { motion } from 'framer-motion';
import { Component } from 'react';
import styled from 'styled-components';
import { ConversationModel } from '../../models/conversation';
import { updateGroupPermissionsModal } from '../../state/ducks/modalDialog';
import { THEME_GLOBALS } from '../../themes/globals';
import { ModalBasicHeader, SessionWrapperModal } from '../SessionWrapperModal';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SpacerMD } from '../basic/Text';
import { OpenGroupData } from '../../data/opengroups';
import {
  OpenGroupRoomPermissionType,
  sogsV3SetRoomPermissions,
} from '../../session/apis/open_group_api/sogsv3/sogsV3RoomPermissions';
import { ConvoHub } from '../../session/conversations';
import { tr } from '../../localization/localeTools';
import { PanelToggleButton } from '../buttons/panel/PanelToggleButton';
import { PanelButtonTextWithSubText } from '../buttons/panel/PanelButton';

const StyledErrorMessage = styled(motion.p)`
  text-align: center;
  color: var(--danger-color);
  display: block;
  user-select: none;
`;

type Props = {
  conversationId: string;
};

interface State {
  errorDisplayed: boolean;
  errorMessage: string;
  default_read: boolean;
  default_write: boolean;
  default_accessible: boolean;
  default_upload: boolean;
}

export class UpdateGroupPermissionsDialog extends Component<Props, State> {
  private readonly convo: ConversationModel;

  constructor(props: Props) {
    super(props);

    autoBind(this);
    this.convo = ConvoHub.use().get(props.conversationId);

    this.state = {
      default_read: true,
      default_write: true,
      default_accessible: true,
      default_upload: true,
      errorDisplayed: false,
      errorMessage: 'placeholder',
    };
  }

  public componentDidMount() {
    window.addEventListener('keyup', this.onKeyUp);
  }

  public componentWillUnmount() {
    window.removeEventListener('keyup', this.onKeyUp);
  }

  public onClickOK() {
    const { default_accessible, default_read, default_upload, default_write } = this.state;

    if (this.convo.isPublic()) {
      const roomInfos = OpenGroupData.getV2OpenGroupRoom(this.convo.id);
      if (!roomInfos) {
        return;
      }
      void sogsV3SetRoomPermissions(roomInfos, {
        default_accessible,
        default_read,
        default_upload,
        default_write,
      });
    }

    this.closeDialog();
  }

  public render() {
    const okText = 'Apply';
    const cancelText = tr('cancel');

    const errorMsg = this.state.errorMessage;

    return (
      <SessionWrapperModal
        modalId='groupPermissionsModal'
        headerChildren={<ModalBasicHeader title={tr('groupChangePermissions')} />}
        onClose={() => this.closeDialog()}
      >
        {this.state.errorDisplayed ? (
          <>
            <SpacerMD />
            <StyledErrorMessage
              initial={{ opacity: 0 }}
              animate={{ opacity: this.state.errorDisplayed ? 1 : 0 }}
              transition={{ duration: THEME_GLOBALS['--duration-modal-error-shown'] }}
              style={{ marginTop: this.state.errorDisplayed ? '0' : '-5px' }}
            >
              {errorMsg}
            </StyledErrorMessage>
            <SpacerMD />
          </>
        ) : null}

        <p
          style={{
            maxWidth: '400px',
            marginBlock: '1em 2em',
            opacity: 0.5,
          }}
        >
          For compatibility reasons, we don't know which permissions were enabled to begin with, but
          you can set new values below regardless.
        </p>

        <PanelToggleButton
          textElement={
            <PanelButtonTextWithSubText
              text={{ token: 'groupPermissionAccessEnable' }}
              subText={{ token: 'groupPermissionAccessDescription' }}
              textDataTestId='test-ignore'
              subTextDataTestId='test-ignore'
            />
          }
          active={this.state.default_accessible}
          onClick={async () => this.onPermissionChanged('default_accessible')}
          rowDataTestId='test-ignore'
          toggleDataTestId='test-ignore'
        />
        <PanelToggleButton
          textElement={
            <PanelButtonTextWithSubText
              text={{ token: 'groupPermissionReadEnable' }}
              subText={{ token: 'groupPermissionReadDescription' }}
              textDataTestId='test-ignore'
              subTextDataTestId='test-ignore'
            />
          }
          active={this.state.default_read}
          onClick={async () => this.onPermissionChanged('default_read')}
          rowDataTestId='test-ignore'
          toggleDataTestId='test-ignore'
        />
        <PanelToggleButton
          textElement={
            <PanelButtonTextWithSubText
              text={{ token: 'groupPermissionWriteEnable' }}
              subText={{ token: 'groupPermissionWriteDescription' }}
              textDataTestId='test-ignore'
              subTextDataTestId='test-ignore'
            />
          }
          active={this.state.default_write}
          onClick={async () => this.onPermissionChanged('default_write')}
          rowDataTestId='test-ignore'
          toggleDataTestId='test-ignore'
        />
        <PanelToggleButton
          textElement={
            <PanelButtonTextWithSubText
              text={{ token: 'groupPermissionUploadEnable' }}
              subText={{ token: 'groupPermissionUploadDescription' }}
              textDataTestId='test-ignore'
              subTextDataTestId='test-ignore'
            />
          }
          active={this.state.default_upload}
          onClick={async () => this.onPermissionChanged('default_upload')}
          rowDataTestId='test-ignore'
          toggleDataTestId='test-ignore'
        />

        <div className="session-modal__button-group">
          <SessionButton
            text={okText}
            onClick={this.onClickOK}
            buttonType={SessionButtonType.Simple}
          />
          <SessionButton
            text={cancelText}
            buttonColor={SessionButtonColor.Danger}
            buttonType={SessionButtonType.Simple}
            onClick={this.closeDialog}
          />
        </div>
      </SessionWrapperModal>
    );
  }

  private onKeyUp(event: any) {
    switch (event.key) {
      case 'Enter':
        this.onClickOK();
        break;
      case 'Esc':
      case 'Escape':
        this.closeDialog();
        break;
      default:
    }
  }

  private closeDialog() {
    window.removeEventListener('keyup', this.onKeyUp);

    window.inboxStore?.dispatch(updateGroupPermissionsModal(null));
  }

  private onPermissionChanged(perm: OpenGroupRoomPermissionType) {
    this.setState(state => {
      return {
        ...state,
        [perm]: !state[perm],
      };
    });
  }
}
