import { useState } from 'react';
import useKey from 'react-use/lib/useKey';

import { PubkeyType } from 'libsession_util_nodejs';
import _, { difference, uniq } from 'lodash';
import { useDispatch } from 'react-redux';
import { VALIDATION } from '../../session/constants';
import { ConvoHub } from '../../session/conversations';
import { ToastUtils, UserUtils } from '../../session/utils';
import { updateInviteContactModal } from '../../state/ducks/modalDialog';
import { SpacerLG } from '../basic/Text';

import {
  useIsPrivate,
  useIsPublic,
  useSortedGroupMembers,
  useZombies,
} from '../../hooks/useParamSelector';
import { useSet } from '../../hooks/useSet';
import { ClosedGroup } from '../../session/group/closed-group';
import { PubKey } from '../../session/types';
import { SessionUtilUserGroups } from '../../session/utils/libsession/libsession_utils_user_groups';
import { groupInfoActions } from '../../state/ducks/metaGroups';
import { useContactsToInviteToGroup } from '../../state/selectors/conversations';
import { useMemberGroupChangePending } from '../../state/selectors/groups';
import { useSelectedIsGroupV2 } from '../../state/selectors/selectedConversation';
import { MemberListItem } from '../MemberListItem';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SessionSpinner } from '../loading';
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

const submitForClosedGroup = async (convoId: string, pubkeys: Array<string>) => {
  const convo = ConvoHub.use().get(convoId);
  if (!convo || !convo.isGroup()) {
    throw new Error('submitForClosedGroup group not found');
  }
  // closed group chats
  const ourPK = UserUtils.getOurPubKeyStrFromCache();
  // we only care about real members. If a member is currently a zombie we have to be able to add him back
  let existingMembers = convo.getGroupMembers() || [];
  // at least make sure it's an array
  if (!Array.isArray(existingMembers)) {
    existingMembers = [];
  }
  existingMembers = _.compact(existingMembers);
  const existingZombies = convo.getGroupZombies() || [];
  const newMembers = pubkeys.filter(d => !existingMembers.includes(d));

  if (newMembers.length > 0) {
    // Do not trigger an update if there is too many members
    // be sure to include current zombies in this count
    if (
      newMembers.length + existingMembers.length + existingZombies.length >
      VALIDATION.CLOSED_GROUP_SIZE_LIMIT
    ) {
      ToastUtils.pushTooManyMembers();
      return;
    }

    const allMembers = _.concat(existingMembers, newMembers, [ourPK]);
    const uniqMembers = _.uniq(allMembers);

    const groupId = convo.get('id');
    const groupName = convo.getNicknameOrRealUsernameOrPlaceholder();

    await ClosedGroup.initiateClosedGroupUpdate(groupId, groupName, uniqMembers);
  }
};

const InviteContactsDialogInner = (props: Props) => {
  const { conversationId } = props;
  const dispatch = useDispatch();

  const privateContactPubkeys = useContactsToInviteToGroup() as Array<PubkeyType>;

  const isProcessingUIChange = useMemberGroupChangePending();

  const isPrivate = useIsPrivate(conversationId);
  const isPublic = useIsPublic(conversationId);
  const membersFromRedux = useSortedGroupMembers(conversationId) || [];
  const zombiesFromRedux = useZombies(conversationId) || [];
  const isGroupV2 = useSelectedIsGroupV2();
  const [shareHistory, setShareHistory] = useState(false);

  const { uniqueValues: selectedContacts, addTo, removeFrom } = useSet<string>();

  if (isPrivate) {
    throw new Error('InviteContactsDialogInner must be a group');
  }
  const zombiesAndMembers = uniq([...membersFromRedux, ...zombiesFromRedux]);
  // filter our zombies and current members from the list of contact we can add

  const validContactsForInvite = isPublic
    ? privateContactPubkeys
    : difference(privateContactPubkeys, zombiesAndMembers);

  const closeDialog = () => {
    dispatch(updateInviteContactModal(null));
  };

  const onClickOK = () => {
    if (selectedContacts.length > 0) {
      if (isPublic) {
        void submitForOpenGroup(conversationId, selectedContacts);
      } else {
        if (PubKey.is03Pubkey(conversationId)) {
          const forcedAsPubkeys = selectedContacts as Array<PubkeyType>;
          const action = groupInfoActions.currentDeviceGroupMembersChange({
            addMembersWithoutHistory: shareHistory ? [] : forcedAsPubkeys,
            addMembersWithHistory: shareHistory ? forcedAsPubkeys : [],
            removeMembers: [],
            groupPk: conversationId,
            alsoRemoveMessages: false,
          });
          dispatch(action as any);
          return;
        }
        void submitForClosedGroup(conversationId, selectedContacts);
      }
    }

    closeDialog();
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
    <SessionWrapperModal title={titleText} onClose={closeDialog}>
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
      <SessionSpinner loading={isProcessingUIChange} />
      <SpacerLG />
      <div className="session-modal__button-group">
        <SessionButton
          text={okText}
          buttonType={SessionButtonType.Simple}
          disabled={!hasContacts || isProcessingUIChange}
          onClick={onClickOK}
          dataTestId="session-confirm-ok-button"
        />
        <SessionButton
          text={cancelText}
          buttonColor={SessionButtonColor.Danger}
          buttonType={SessionButtonType.Simple}
          onClick={closeDialog}
          disabled={isProcessingUIChange}
          dataTestId="session-confirm-cancel-button"
        />
      </div>
    </SessionWrapperModal>
  );
};

export const InviteContactsDialog = InviteContactsDialogInner;
