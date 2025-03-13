/* eslint-disable @typescript-eslint/no-misused-promises */
import autoBind from 'auto-bind';

import { motion } from 'framer-motion';
import { Component } from 'react';
import styled from 'styled-components';
import { ConversationModel } from '../../models/conversation';
import { updateGroupPermissionsModal } from '../../state/ducks/modalDialog';
import { THEME_GLOBALS } from '../../themes/globals';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SpacerMD } from '../basic/Text';
import { SessionToggleWithDescription } from '../settings/SessionSettingListItem';
import { OpenGroupData } from '../../data/opengroups';
import {
  OpenGroupRoomPermissionType,
  sogsV3SetRoomPermissions,
} from '../../session/apis/open_group_api/sogsv3/sogsV3RoomPermissions';
import { ConvoHub } from '../../session/conversations';

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
      default_read: this.convo.attributes.default_read ?? true,
      default_write: this.convo.attributes.default_write ?? true,
      default_accessible: this.convo.attributes.default_accessible ?? true,
      default_upload: this.convo.attributes.default_upload ?? true,
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
    const cancelText = window.i18n('cancel');

    const errorMsg = this.state.errorMessage;

    return (
      <SessionWrapperModal
        title={window.i18n('groupChangePermissions')}
        onClose={() => this.closeDialog()}
        additionalClassName="update-group-dialog"
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

        <SessionToggleWithDescription
          title="Enable room visibility"
          description="Anyone can see the room (+a)"
          active={this.state.default_accessible}
          onClickToggle={() => this.onPermissionChanged('default_accessible')}
        />
        <SessionToggleWithDescription
          title="Enable reading"
          description="Anyone can read messages (+r)"
          active={this.state.default_read}
          onClickToggle={() => this.onPermissionChanged('default_read')}
        />
        <SessionToggleWithDescription
          title="Enable writing"
          description="Anyone can send messages (+w)"
          active={this.state.default_write}
          onClickToggle={() => this.onPermissionChanged('default_write')}
        />
        <SessionToggleWithDescription
          title="Enable uploads"
          description="Anyone can upload files (+u)"
          active={this.state.default_upload}
          onClickToggle={() => this.onPermissionChanged('default_upload')}
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
