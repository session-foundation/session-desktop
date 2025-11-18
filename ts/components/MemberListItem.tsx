import styled, { css } from 'styled-components';

import { GroupPubkeyType, MemberStateGroupV2, PubkeyType } from 'libsession_util_nodejs';
import { isEmpty } from 'lodash';
import type { SessionDataTestId } from 'react';
import { useWeAreAdmin } from '../hooks/useParamSelector';
import { promoteUsersInGroup } from '../interactions/conversationInteractions';
import { PubKey } from '../session/types';
import { UserUtils } from '../session/utils';
import { GroupInvite } from '../session/utils/job_runners/jobs/GroupInviteJob';
import {
  useMemberHasAcceptedInvite,
  useMemberIsNominatedAdmin,
  useMemberPendingRemoval,
  useMemberStatus,
} from '../state/selectors/groups';
import { Avatar, AvatarSize } from './avatar/Avatar';
import { Flex } from './basic/Flex';
import {
  SessionButton,
  SessionButtonColor,
  SessionButtonShape,
  SessionButtonType,
} from './basic/SessionButton';
import { SessionRadio } from './basic/SessionRadio';
import {
  MetaGroupWrapperActions,
  UserGroupsWrapperActions,
} from '../webworker/workers/browser/libsession_worker_interface';
import { assertUnreachable } from '../types/sqlSharedTypes';
import { tr } from '../localization/localeTools';
import { ContactName } from './conversation/ContactName/ContactName';
import type { ContactNameSuffixInMemberList } from './conversation/ContactName/ContactNameContext';
import { getFeatureFlag } from '../state/ducks/types/releasedFeaturesReduxTypes';

const AvatarContainer = styled.div`
  position: relative;
`;

const AvatarItem = (props: { memberPubkey: string; isAdmin: boolean }) => {
  const { memberPubkey, isAdmin } = props;
  return (
    <AvatarContainer>
      <Avatar size={AvatarSize.XS} pubkey={memberPubkey} showCrown={isAdmin} />
    </AvatarContainer>
  );
};

const StyledSessionMemberItem = styled.button<{
  inMentions?: boolean;
  selected?: boolean;
  disableBg?: boolean;
  withBorder?: boolean;
}>`
  cursor: ${props => (props.disabled ? 'not-allowed' : 'pointer')};
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  font-family: var(--font-default);
  padding: 0px var(--margins-sm);
  height: ${props => (props.inMentions ? '40px' : '50px')};
  width: 100%;
  transition: var(--default-duration);
  background-color: ${props =>
    !props.disableBg && props.selected
      ? 'var(--conversation-tab-background-selected-color) !important'
      : null};

  ${props => props.inMentions && 'max-width: 300px;'}
  ${props =>
    props.withBorder &&
    `&:not(button:last-child) {
    border-bottom: 1px solid var(--border-color);
  }`}

  ${props =>
    !props.inMentions
      ? css`
          &:hover {
            background-color: var(--conversation-tab-background-hover-color);
          }
        `
      : ''}
`;

const StyledInfo = styled.div`
  display: flex;
  align-items: center;
  min-width: 0;
`;

const StyledCheckContainer = styled.div`
  display: flex;
  align-items: center;
`;

type MemberListItemProps<T extends string> = {
  pubkey: T;
  isSelected: boolean;
  inMentions?: boolean; // set to true if we are rendering members but in the Mentions picker
  disableBg?: boolean;
  withBorder?: boolean;
  isAdmin?: boolean; // if true,  we add a small crown on top of their avatar
  onSelect?: (pubkey: T) => void;
  onUnselect?: (pubkey: T) => void;
  dataTestId?: SessionDataTestId;
  displayGroupStatus?: boolean;
  groupPk?: string;
  disabled?: boolean;
  hideRadioButton?: boolean;
};

const ResendContainer = ({
  displayGroupStatus,
  groupPk,
  pubkey,
}: Pick<MemberListItemProps<string>, 'displayGroupStatus' | 'pubkey' | 'groupPk'>) => {
  const weAreAdmin = useWeAreAdmin(groupPk);

  if (
    weAreAdmin &&
    displayGroupStatus &&
    groupPk &&
    PubKey.is03Pubkey(groupPk) &&
    PubKey.is05Pubkey(pubkey) &&
    !UserUtils.isUsFromCache(pubkey)
  ) {
    return (
      <Flex
        $container={true}
        $flexGap="var(--margins-sm)"
        margin="0 0 0 auto"
        padding="0 var(--margins-lg)"
      >
        <ResendButton groupPk={groupPk} pubkey={pubkey} />
        <PromoteButton groupPk={groupPk} pubkey={pubkey} />
      </Flex>
    );
  }
  return null;
};

const StyledGroupStatusText = styled.span<{ isFailure: boolean }>`
  color: ${props => (props.isFailure ? 'var(--danger-color)' : 'var(--text-secondary-color)')};
  font-size: var(--font-size-xs);
  margin-top: var(--margins-xs);
  min-width: 100px; // min-width so that the dialog does not resize when the status change to sending
  text-align: start;
`;

function localisedStatusFromMemberStatus(memberStatus: MemberStateGroupV2) {
  switch (memberStatus) {
    case 'INVITE_FAILED':
      return tr('groupInviteFailed');
    case 'INVITE_NOT_SENT':
      return tr('groupInviteNotSent');
    case 'INVITE_SENDING':
      return tr('groupInviteSending', { count: 1 });
    case 'INVITE_SENT':
      return tr('groupInviteSent');
    case 'INVITE_UNKNOWN': // fallback, hopefully won't happen in production
      return tr('groupInviteStatusUnknown');
    case 'PROMOTION_UNKNOWN': // fallback, hopefully won't happen in production
      return tr('adminPromotionStatusUnknown');
    case 'REMOVED_UNKNOWN': // fallback, hopefully won't happen in production
    case 'REMOVED_MEMBER': // we want pending removal members at the end of the "invite" states
    case 'REMOVED_MEMBER_AND_MESSAGES':
      return tr('groupPendingRemoval');
    case 'PROMOTION_FAILED':
      return tr('adminPromotionFailed');
    case 'PROMOTION_NOT_SENT':
      return tr('adminPromotionNotSent');
    case 'PROMOTION_SENDING':
      return tr('adminSendingPromotion', { count: 1 });
    case 'PROMOTION_SENT':
      return tr('adminPromotionSent');
    case 'PROMOTION_ACCEPTED':
      return null; // no statuses for accepted state;
    case 'INVITE_ACCEPTED':
      return null; // no statuses for accepted state
    default:
      assertUnreachable(memberStatus, 'Unhandled switch case');
      return Number.MAX_SAFE_INTEGER;
  }
}

const GroupStatusText = ({ groupPk, pubkey }: { pubkey: PubkeyType; groupPk: GroupPubkeyType }) => {
  const memberStatus = useMemberStatus(pubkey, groupPk);

  if (!memberStatus) {
    return null;
  }

  const statusText = localisedStatusFromMemberStatus(memberStatus);
  if (!statusText) {
    return null;
  }
  return (
    <StyledGroupStatusText
      data-testid={'contact-status'}
      isFailure={memberStatus === 'INVITE_FAILED' || memberStatus === 'PROMOTION_FAILED'}
    >
      {statusText}
    </StyledGroupStatusText>
  );
};

const GroupStatusContainer = ({
  displayGroupStatus,
  groupPk,
  pubkey,
}: Pick<MemberListItemProps<string>, 'displayGroupStatus' | 'pubkey' | 'groupPk'>) => {
  if (
    displayGroupStatus &&
    groupPk &&
    PubKey.is03Pubkey(groupPk) &&
    PubKey.is05Pubkey(pubkey) &&
    !UserUtils.isUsFromCache(pubkey)
  ) {
    return <GroupStatusText groupPk={groupPk} pubkey={pubkey} />;
  }
  return null;
};

const ResendButton = ({ groupPk, pubkey }: { pubkey: PubkeyType; groupPk: GroupPubkeyType }) => {
  const acceptedInvite = useMemberHasAcceptedInvite(pubkey, groupPk);
  const nominatedAdmin = useMemberIsNominatedAdmin(pubkey, groupPk);
  const memberStatus = useMemberStatus(pubkey, groupPk);

  // as soon as the `admin` flag is set in the group for that member, we should be able to resend a promote as we cannot remove an admin.
  const canResendPromotion = getFeatureFlag('useClosedGroupV2QAButtons') && nominatedAdmin;

  // we can always remove/and readd a non-admin member. So we consider that a member who accepted the invite cannot be resent an invite.
  const canResendInvite = !acceptedInvite;

  const shouldShowResendButton = canResendInvite || canResendPromotion;

  if (!shouldShowResendButton) {
    return null;
  }

  const resendButtonDisabled =
    memberStatus === 'INVITE_SENDING' ||
    memberStatus === 'PROMOTION_SENDING' ||
    memberStatus === 'REMOVED_MEMBER' ||
    memberStatus === 'REMOVED_MEMBER_AND_MESSAGES' ||
    memberStatus === 'REMOVED_UNKNOWN';

  return (
    <SessionButton
      dataTestId={'resend-invite-button'}
      buttonShape={SessionButtonShape.Square}
      buttonType={SessionButtonType.Solid}
      text={tr('resend')}
      disabled={resendButtonDisabled}
      onClick={async () => {
        const group = await UserGroupsWrapperActions.getGroup(groupPk);
        const member = await MetaGroupWrapperActions.memberGet(groupPk, pubkey);
        if (!group || !group.secretKey || isEmpty(group.secretKey) || !member) {
          window.log.warn('tried to resend invite but we do not have correct details');
          return;
        }

        // if we tried to invite that member as admin right away, let's retry it as such.
        await GroupInvite.addJob({
          groupPk,
          member: pubkey,
          inviteAsAdmin: member.nominatedAdmin,
        });
      }}
    />
  );
};

const PromoteButton = ({ groupPk, pubkey }: { pubkey: PubkeyType; groupPk: GroupPubkeyType }) => {
  const memberAcceptedInvite = useMemberHasAcceptedInvite(pubkey, groupPk);
  const memberIsNominatedAdmin = useMemberIsNominatedAdmin(pubkey, groupPk);
  const memberIsPendingRemoval = useMemberPendingRemoval(pubkey, groupPk);
  // When invite-as-admin was used to invite that member, the resend button is available to resend the promote message.
  // We want to show that button only to promote a normal member who accepted a normal invite but wasn't promoted yet.
  // ^ this is only the case for testing. The UI will be different once we release the promotion process
  if (
    !getFeatureFlag('useClosedGroupV2QAButtons') ||
    !memberAcceptedInvite ||
    memberIsNominatedAdmin ||
    memberIsPendingRemoval
  ) {
    return null;
  }
  return (
    <SessionButton
      dataTestId={'resend-promote-button'}
      buttonShape={SessionButtonShape.Square}
      buttonType={SessionButtonType.Solid}
      buttonColor={SessionButtonColor.Danger}
      text={tr('promote')}
      onClick={() => {
        void promoteUsersInGroup({
          groupPk,
          toPromote: [pubkey],
        });
      }}
    />
  );
};

export const MemberListItem = <T extends string>({
  isSelected,
  pubkey,
  dataTestId,
  disableBg,
  displayGroupStatus,
  inMentions,
  isAdmin,
  onSelect,
  onUnselect,
  groupPk,
  disabled,
  withBorder,
  conversationId,
  hideRadioButton,
  contactNameSuffix,
}: MemberListItemProps<T> & {
  conversationId?: string;
  contactNameSuffix?: ContactNameSuffixInMemberList;
}) => {
  return (
    <StyledSessionMemberItem
      onClick={() => {
        // eslint-disable-next-line no-unused-expressions
        isSelected ? onUnselect?.(pubkey) : onSelect?.(pubkey);
      }}
      data-testid={dataTestId}
      inMentions={inMentions}
      selected={isSelected}
      disableBg={disableBg}
      withBorder={withBorder}
      disabled={disabled}
    >
      <StyledInfo>
        <AvatarItem memberPubkey={pubkey} isAdmin={isAdmin || false} />
        <Flex
          $container={true}
          $flexDirection="column"
          margin="0 var(--margins-md)"
          $alignItems="flex-start"
          minWidth="0"
        >
          <ContactName
            contactNameContext={`member-list-item${contactNameSuffix ?? ''}`}
            pubkey={pubkey}
            conversationId={conversationId}
          />
          <GroupStatusContainer
            pubkey={pubkey}
            displayGroupStatus={displayGroupStatus}
            groupPk={groupPk}
          />
        </Flex>
      </StyledInfo>

      <ResendContainer pubkey={pubkey} displayGroupStatus={displayGroupStatus} groupPk={groupPk} />

      {!inMentions && !hideRadioButton && (
        <StyledCheckContainer>
          <SessionRadio
            active={isSelected}
            value={pubkey}
            inputName={pubkey}
            inputDataTestId="select-contact"
          />
        </StyledCheckContainer>
      )}
    </StyledSessionMemberItem>
  );
};
