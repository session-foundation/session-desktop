import { CSSProperties } from 'react';
import clsx from 'clsx';

import {
  useConversationRealName,
  useConversationUsernameNoFallback,
  useIsPrivate,
  useIsPublic,
  useNickname,
} from '../../../hooks/useParamSelector';
import { Emojify } from '../Emojify';
import { PubKey } from '../../../session/types';
import { tr } from '../../../localization/localeTools';
import { isUsAnySogsFromCache } from '../../../session/apis/open_group_api/sogsv3/knownBlindedkeys';
import type { ContactNameContext } from './ContactNameContext';
import { useProBadgeOnClickCb } from '../../menuAndSettingsHooks/useProBadgeOnClickCb';
import { useUserHasPro } from '../../../hooks/useHasPro';
import { ProIcon } from '../../buttons/ProButton';

const boldProfileNameCtx: Array<ContactNameContext> = [
  'conversation-list-item',
  'quoted-message-composition',
  'message-author',
];

const showPubkeyCtx: Array<ContactNameContext> = ['message-author'];

const ntsIsYouCtx: Array<ContactNameContext> = [
  'message-author',
  'quote-author',
  'quoted-message-composition',
  'message-search-result',
  'react-list-modal',
];

const commonStyles: CSSProperties = {
  minWidth: 0,
  textOverflow: 'ellipsis',
  overflow: 'hidden',
};

const boldStyles: CSSProperties = {
  fontWeight: 'bold',
  ...commonStyles,
};

export const ContactName = ({
  pubkey,
  module,
  contactNameContext,
  conversationId,
}: {
  pubkey: string;
  module?:
    | 'module-conversation__user'
    | 'module-message-search-result__header__name'
    | 'module-message__author';
  contactNameContext: ContactNameContext;
  conversationId?: string;
}) => {
  const prefix = module || 'module-contact-name';
  const isPublic = useIsPublic(conversationId);
  const shortPubkey = PubKey.shorten(pubkey);

  const isMe = isUsAnySogsFromCache(pubkey);

  const noFallback = useConversationUsernameNoFallback(pubkey);
  const realName = useConversationRealName(pubkey);
  const nickname = useNickname(pubkey);
  const isPrivate = useIsPrivate(pubkey);

  const displayName = isMe
    ? // we want to show "You" instead of Note to Self in some places (like quotes)
      ntsIsYouCtx.includes(contactNameContext)
      ? tr('you')
      : tr('noteToSelf')
    : // we want to show the nickname in brackets if a nickname is set for search results
      contactNameContext === 'conversation-list-item-search' && nickname && realName
      ? `${nickname} (${realName})`
      : noFallback;

  const shouldShowShortenPkAsName = !displayName;

  const shouldShowPubkey =
    !shouldShowShortenPkAsName && isPublic && showPubkeyCtx.includes(contactNameContext);
  const boldProfileName = boldProfileNameCtx.includes(contactNameContext);

  const displayedName = shouldShowShortenPkAsName ? shortPubkey : displayName;

  const userHasPro = useUserHasPro(pubkey);

  const showProBadge = useProBadgeOnClickCb({
    context: 'contact-name',
    args: { userHasPro, isMe, contactNameContext },
  });

  return (
    <span
      className={clsx(prefix)}
      dir="auto"
      data-testid={`${prefix}__profile-name` as const}
      style={{
        textOverflow: 'inherit',
        display: 'flex',
        flexDirection: 'row',
        gap: 'var(--margins-xs)',
      }}
    >
      {displayedName ? (
        <div
          style={boldProfileName ? boldStyles : commonStyles}
          className={`${prefix}__profile-name`}
        >
          <Emojify text={displayedName} sizeClass="small" isGroup={!isPrivate} />
        </div>
      ) : null}
      {showProBadge.show ? <ProIcon iconSize={'small'} style={{ flexShrink: 0}} /> : null}
      {shouldShowPubkey ? <div className={`${prefix}__profile-number`}>{shortPubkey}</div> : null}
    </span>
  );
};
