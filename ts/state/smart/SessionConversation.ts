import { connect } from 'react-redux';
import { SessionConversation } from '../../components/conversation/SessionConversation';
import { mapDispatchToProps } from '../actions';
import { StateType } from '../reducer';
import { getHasOngoingCallWithFocusedConvo } from '../selectors/call';
import {
  getIsSelectedConvoInitialLoadingInProgress,
  getSelectedConversation,
  getSelectedMessageIds,
  getSortedMessagesOfSelectedConversation,
  isRightPanelShowing,
} from '../selectors/conversations';
import { getSelectedConversationKey } from '../selectors/selectedConversation';
import { getStagedAttachmentsForCurrentConversation } from '../selectors/stagedAttachments';
import { getOurDisplayNameInProfile, getOurNumber } from '../selectors/user';
import { HTMLDirection } from '../../util/i18n/rtlSupport';

type SmartSessionConversationOwnProps = {
  htmlDirection: HTMLDirection;
};

const mapStateToProps = (state: StateType, ownProps: SmartSessionConversationOwnProps) => {
  return {
    selectedConversation: getSelectedConversation(state),
    selectedConversationKey: getSelectedConversationKey(state),
    messagesProps: getSortedMessagesOfSelectedConversation(state),
    ourDisplayNameInProfile: getOurDisplayNameInProfile(state),
    ourNumber: getOurNumber(state),
    isRightPanelShowing: isRightPanelShowing(state),
    selectedMessages: getSelectedMessageIds(state),
    stagedAttachments: getStagedAttachmentsForCurrentConversation(state),
    hasOngoingCallWithFocusedConvo: getHasOngoingCallWithFocusedConvo(state),
    isSelectedConvoInitialLoadingInProgress: getIsSelectedConvoInitialLoadingInProgress(state),
    htmlDirection: ownProps.htmlDirection,
  };
};

const smart = connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, ownProps) => {
    return {
      ...stateProps,
      router: ownProps,
      actions: dispatchProps,
    };
  }
);
export const SmartSessionConversation = smart(SessionConversation);
