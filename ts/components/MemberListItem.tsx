import styled from 'styled-components';

import { GroupPubkeyType, MemberStateGroupV2, PubkeyType } from 'libsession_util_nodejs';
import { isEmpty } from 'lodash';
import type { SessionDataTestId } from 'react';
import {
  useNicknameOrProfileNameOrShortenedPubkey,
  useWeAreAdmin,
} from '../hooks/useParamSelector';
import { promoteUsersInGroup } from '../interactions/conversationInteractions';
import { PubKey } from '../session/types';
import { UserUtils } from '../session/utils';
import { GroupInvite } from '../session/utils/job_runners/jobs/GroupInviteJob';
import { hasClosedGroupV2QAButtons } from '../shared/env_vars';
import {
  useMemberHasAcceptedInvite,
  useMemberIsNominatedAdmin,
  useMemberPendingRemoval,
  useMemberStatus,
} from '../state/selectors/groups';
import { Avatar, AvatarSize, CrownIcon } from './avatar/Avatar';
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
import { isUsAnySogsFromCache } from '../session/apis/open_group_api/sogsv3/knownBlindedkeys';
import { localize } from '../localization/localeTools';

const AvatarContainer = styled.div`
  position: relative;
`;

const AvatarItem = (props: { memberPubkey: string; isAdmin: boolean }) => {
  const { memberPubkey, isAdmin } = props;
  return (
    <AvatarContainer>
      <Avatar size={AvatarSize.XS} pubkey={memberPubkey} />
      {isAdmin && <CrownIcon />}
    </AvatarContainer>
  );
};

const StyledSessionMemberItem = styled.button<{
  inMentions?: boolean;
  zombie?: boolean;
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
  opacity: ${props => (props.zombie ? 0.5 : 1)};
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

  &:hover {
    background-color: var(--conversation-tab-background-hover-color);
  }
`;

const StyledInfo = styled.div`
  display: flex;
  align-items: center;
  min-width: 0;
`;

const StyledName = styled.span<{ maxName?: string }>`
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  ${props => props.maxName && `max-width: ${props.maxName};`}
`;

const StyledCheckContainer = styled.div`
  display: flex;
  align-items: center;
`;

type MemberListItemProps<T extends string> = {
  pubkey: T;
  isSelected: boolean;
  // this bool is used to make a zombie appear with less opacity than a normal member
  isZombie?: boolean;
  inMentions?: boolean; // set to true if we are rendering members but in the Mentions picker
  disableBg?: boolean;
  withBorder?: boolean;
  maxNameWidth?: string;
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
      return window.i18n('groupInviteFailed');
    case 'INVITE_NOT_SENT':
      return window.i18n('groupInviteNotSent');
    case 'INVITE_SENDING':
      return window.i18n('groupInviteSending', { count: 1 });
    case 'INVITE_SENT':
      return window.i18n('groupInviteSent');
    case 'INVITE_UNKNOWN': // fallback, hopefully won't happen in production
      return window.i18n('groupInviteStatusUnknown');
    case 'PROMOTION_UNKNOWN': // fallback, hopefully won't happen in production
      return window.i18n('adminPromotionStatusUnknown');
    case 'REMOVED_UNKNOWN': // fallback, hopefully won't happen in production
    case 'REMOVED_MEMBER': // we want pending removal members at the end of the "invite" states
    case 'REMOVED_MEMBER_AND_MESSAGES':
      return window.i18n('groupPendingRemoval');
    case 'PROMOTION_FAILED':
      return window.i18n('adminPromotionFailed');
    case 'PROMOTION_NOT_SENT':
      return window.i18n('adminPromotionNotSent');
    case 'PROMOTION_SENDING':
      return window.i18n('adminSendingPromotion', { count: 1 });
    case 'PROMOTION_SENT':
      return window.i18n('adminPromotionSent');
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
  const canResendPromotion = hasClosedGroupV2QAButtons() && nominatedAdmin;

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
      text={window.i18n('resend')}
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
    !hasClosedGroupV2QAButtons() ||
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
      text={window.i18n('promote')}
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
  isZombie,
  onSelect,
  onUnselect,
  groupPk,
  disabled,
  withBorder,
  maxNameWidth,
  hideRadioButton,
}: MemberListItemProps<T>) => {
  const memberName = useNicknameOrProfileNameOrShortenedPubkey(pubkey);
  const ourName = isUsAnySogsFromCache(pubkey) ? localize('you').toString() : null;

  return (
    <StyledSessionMemberItem
      onClick={() => {
        // eslint-disable-next-line no-unused-expressions
        isSelected ? onUnselect?.(pubkey) : onSelect?.(pubkey);
      }}
      data-testid={dataTestId}
      zombie={isZombie}
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
          <StyledName data-testid={'contact'} maxName={maxNameWidth}>
            {ourName || memberName}
          </StyledName>
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
