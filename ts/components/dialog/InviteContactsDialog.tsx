import { useState } from 'react';
import useKey from 'react-use/lib/useKey';

import { PubkeyType } from 'libsession_util_nodejs';
import { difference, uniq } from 'lodash';
import { useDispatch } from 'react-redux';
import { ConvoHub } from '../../session/conversations';
import { updateGroupMembersModal, updateInviteContactModal } from '../../state/ducks/modalDialog';
import { SpacerLG } from '../basic/Text';

import { useIsPrivate, useIsPublic, useSortedGroupMembers } from '../../hooks/useParamSelector';
import { useSet } from '../../hooks/useSet';
import { PubKey } from '../../session/types';
import { SessionUtilUserGroups } from '../../session/utils/libsession/libsession_utils_user_groups';
import { groupInfoActions } from '../../state/ducks/metaGroups';
import { useContactsToInviteToGroup } from '../../state/selectors/conversations';
import { useSelectedIsGroupV2 } from '../../state/selectors/selectedConversation';
import { MemberListItem } from '../MemberListItem';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SessionToggle } from '../basic/SessionToggle';
import { GroupInviteRequiredVersionBanner } from '../NoticeBanner';
import { hasClosedGroupV2QAButtons } from '../../shared/env_vars';
import { ConversationTypeEnum } from '../../models/types';
import { Localizer } from '../basic/Localizer';

type Props = {
  conversationId: string;
};

async function submitForOpenGroup(convoId: string, pubkeys: Array<string>) {
  const convo = ConvoHub.use().get(convoId);
  if (!convo || !convo.isPublic()) {
    throw new Error('submitForOpenGroup group not found');
  }
  try {
    const roomDetails = await SessionUtilUserGroups.getCommunityByConvoIdNotCached(convo.id);
    if (!roomDetails) {
      throw new Error(`getCommunityByFullUrl returned no result for ${convo.id}`);
    }
    const groupInvitation = {
      url: roomDetails?.fullUrlWithPubkey,
      name: convo.getNicknameOrRealUsernameOrPlaceholder(),
    };
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    pubkeys.forEach(async pubkeyStr => {
      const privateConvo = await ConvoHub.use().getOrCreateAndWait(
        pubkeyStr,
        ConversationTypeEnum.PRIVATE
      );

      if (privateConvo) {
        void privateConvo.sendMessage({
          body: '',
          attachments: undefined,
          groupInvitation,
          preview: undefined,
          quote: undefined,
        });
      }
    });
  } catch (e) {
    window.log.warn('submitForOpenGroup failed with:', e.message);
  }
}

const InviteContactsDialogInner = (props: Props) => {
  const { conversationId } = props;
  const dispatch = useDispatch();

  const privateContactPubkeys = useContactsToInviteToGroup() as Array<PubkeyType>;
  const isPrivate = useIsPrivate(conversationId);
  const isPublic = useIsPublic(conversationId);
  const membersFromRedux = useSortedGroupMembers(conversationId) || [];
  const isGroupV2 = useSelectedIsGroupV2();
  const [shareHistory, setShareHistory] = useState(false);

  const { uniqueValues: selectedContacts, addTo, removeFrom, empty } = useSet<string>();

  if (isPrivate) {
    throw new Error('InviteContactsDialogInner must be a group');
  }
  const members = uniq(membersFromRedux);

  const validContactsForInvite = isPublic
    ? privateContactPubkeys
    : difference(privateContactPubkeys, members);

  const closeDialog = () => {
    dispatch(updateInviteContactModal(null));
  };

  const onClickOK = () => {
    if (selectedContacts.length <= 0) {
      closeDialog();
      return;
    }
    if (isPublic) {
      void submitForOpenGroup(conversationId, selectedContacts);
      return;
    }
    if (!PubKey.is03Pubkey(conversationId)) {
      throw new Error('Only communities and 03-groups are allowed here');
    }
    const forcedAsPubkeys = selectedContacts as Array<PubkeyType>;
    const action = groupInfoActions.currentDeviceGroupMembersChange({
      addMembersWithoutHistory: shareHistory ? [] : forcedAsPubkeys,
      addMembersWithHistory: shareHistory ? forcedAsPubkeys : [],
      removeMembers: [],
      groupPk: conversationId,
      alsoRemoveMessages: false,
    });
    dispatch(action as any);
    empty();
    // We want to show the dialog where "invite sending" is visible (i.e. the current group members) instead of this one
    // once we hit "invite"
    closeDialog();
    dispatch(updateGroupMembersModal({ conversationId }));
  };

  useKey((event: KeyboardEvent) => {
    return event.key === 'Enter';
  }, onClickOK);

  useKey((event: KeyboardEvent) => {
    return event.key === 'Esc' || event.key === 'Escape';
  }, closeDialog);

  const titleText = window.i18n('membersInvite');
  const cancelText = window.i18n('cancel');
  const okText = window.i18n('okay');

  const hasContacts = validContactsForInvite.length > 0;

  return (
    <SessionWrapperModal title={titleText} onClose={closeDialog} showExitIcon={true}>
      {hasContacts && isGroupV2 && <GroupInviteRequiredVersionBanner />}

      <SpacerLG />

      {/* TODO: localize those strings once out releasing those buttons for real Remove after QA */}
      {isGroupV2 && hasClosedGroupV2QAButtons() && (
        <>
          <span style={{ display: 'flex', alignItems: 'center' }}>
            Share History?{'  '}
            <SessionToggle active={shareHistory} onClick={() => setShareHistory(!shareHistory)} />
          </span>
        </>
      )}
      <div className="contact-selection-list">
        {hasContacts ? (
          validContactsForInvite.map((member: string) => (
            <MemberListItem
              key={`contacts-list-${member}`}
              pubkey={member}
              isSelected={selectedContacts.includes(member)}
              onSelect={addTo}
              onUnselect={removeFrom}
              disableBg={true}
              maxNameWidth="100%"
            />
          ))
        ) : (
          <>
            <SpacerLG />
            <p className="no-contacts">
              <Localizer token="contactNone" />
            </p>
            <SpacerLG />
          </>
        )}
      </div>
      <SpacerLG />
      <SpacerLG />
      <div className="session-modal__button-group">
        <SessionButton
          text={okText}
          buttonType={SessionButtonType.Simple}
          disabled={!hasContacts}
          onClick={onClickOK}
          dataTestId="session-confirm-ok-button"
        />
        <SessionButton
          text={cancelText}
          buttonColor={SessionButtonColor.Danger}
          buttonType={SessionButtonType.Simple}
          onClick={closeDialog}
          dataTestId="session-confirm-cancel-button"
        />
      </div>
    </SessionWrapperModal>
  );
};

export const InviteContactsDialog = InviteContactsDialogInner;
