import { useState } from 'react';
import useKey from 'react-use/lib/useKey';
import { clone } from 'lodash';

import { PubkeyType } from 'libsession_util_nodejs';
import { useDispatch } from 'react-redux';
import { ConvoHub } from '../../session/conversations';
import { updateGroupMembersModal, updateInviteContactModal } from '../../state/ducks/modalDialog';
import { SpacerLG } from '../basic/Text';

import { useIsPrivate, useIsPublic } from '../../hooks/useParamSelector';
import { useSet } from '../../hooks/useSet';
import { PubKey } from '../../session/types';
import { SessionUtilUserGroups } from '../../session/utils/libsession/libsession_utils_user_groups';
import { groupInfoActions } from '../../state/ducks/metaGroups';
import { useSelectedIsGroupV2 } from '../../state/selectors/selectedConversation';
import { MemberListItem } from '../MemberListItem';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SessionToggle } from '../basic/SessionToggle';
import { hasClosedGroupV2QAButtons } from '../../shared/env_vars';
import { ConversationTypeEnum } from '../../models/types';
import { Localizer } from '../basic/Localizer';
import { localize } from '../../localization/localeTools';
import { useContactsToInviteTo } from '../../hooks/useContactsToInviteToGroup';
import { SessionSearchInput } from '../SessionSearchInput';
import { NoResultsForSearch } from '../search/NoResults';
import { SessionWrapperModal2 } from '../SessionWrapperModal2';
import { useHotkey } from '../../hooks/useHotkey';
import { searchActions } from '../../state/ducks/search';
import { ToastUtils } from '../../session/utils';

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
    ToastUtils.pushToastInfo(
      'sendingInvites',
      localize('groupInviteSending').withArgs({ count: pubkeys.length }).toString()
    );
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

function ContactsToInvite({
  validContactsForInvite,
  selectedContacts,
  selectContact,
  unselectContact,
}: {
  validContactsForInvite: Array<PubkeyType>;
  selectedContacts: Array<string>;
  selectContact: (member: string) => void;
  unselectContact: (member: string) => void;
}) {
  const hasContacts = validContactsForInvite.length > 0;

  return hasContacts ? (
    validContactsForInvite.map((member: string) => (
      <MemberListItem
        key={`contacts-list-${member}`}
        pubkey={member}
        isSelected={selectedContacts.includes(member)}
        onSelect={selectContact}
        onUnselect={unselectContact}
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
  );
}

const InviteContactsDialogInner = (props: Props) => {
  const { conversationId } = props;
  const dispatch = useDispatch();

  const { contactsToInvite, isSearch, searchTerm, hasSearchResults } = useContactsToInviteTo(
    'invite-contact-to',
    conversationId
  );
  const isPrivate = useIsPrivate(conversationId);
  const isPublic = useIsPublic(conversationId);
  const isGroupV2 = useSelectedIsGroupV2();
  const [shareHistory, setShareHistory] = useState(false);

  const { uniqueValues: selectedContacts, addTo, removeFrom, empty } = useSet<string>();

  if (isPrivate) {
    throw new Error('InviteContactsDialogInner must be a group');
  }

  const closeDialog = () => {
    dispatch(updateInviteContactModal(null));
    dispatch(searchActions.clearSearch());
  };

  const onClickOK = () => {
    if (selectedContacts.length <= 0) {
      closeDialog();
      return;
    }
    if (isPublic) {
      void submitForOpenGroup(conversationId, clone(selectedContacts));
      empty();
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
  useHotkey('Escape', closeDialog);

  useKey((event: KeyboardEvent) => {
    return event.key === 'Enter';
  }, onClickOK);

  const hasContacts = contactsToInvite.length > 0;

  return (
    <SessionWrapperModal2
      title={localize('membersInvite').toString()}
      onClose={closeDialog}
      showExitIcon={true}
      modalDataTestId="invite-contacts-dialog"
      $contentMaxWidth="500px"
      $contentMinWidth="500px"
      buttonChildren={
        <>
          <SpacerLG />
          <div className="session-modal__button-group">
            <SessionButton
              text={localize('okay').toString()}
              buttonType={SessionButtonType.Simple}
              disabled={!hasContacts}
              onClick={onClickOK}
              dataTestId="session-confirm-ok-button"
            />
            <SessionButton
              text={localize('cancel').toString()}
              buttonColor={SessionButtonColor.Danger}
              buttonType={SessionButtonType.Simple}
              onClick={closeDialog}
              dataTestId="session-confirm-cancel-button"
            />
          </div>
        </>
      }
    >
      <SpacerLG />

      {isGroupV2 && hasClosedGroupV2QAButtons() && (
        <>
          <span
            style={{
              display: 'flex',
              justifyContent: 'space-evenly',
              alignItems: 'center',
              width: '400px',
            }}
          >
            Share History?{'  '}
            <SessionToggle active={shareHistory} onClick={() => setShareHistory(!shareHistory)} />
          </span>
        </>
      )}
      <SessionSearchInput searchType="invite-contact-to" />
      {isSearch && !hasSearchResults ? (
        <NoResultsForSearch searchTerm={searchTerm || ''} />
      ) : (
        <div className="contact-selection-list">
          <ContactsToInvite
            validContactsForInvite={contactsToInvite}
            selectedContacts={selectedContacts}
            selectContact={addTo}
            unselectContact={removeFrom}
          />
        </div>
      )}
    </SessionWrapperModal2>
  );
};

export const InviteContactsDialog = InviteContactsDialogInner;
