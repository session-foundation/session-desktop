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
import { useCurrentUserHasPro, useUserHasPro } from '../../../hooks/useHasPro';
import { ProIconButton } from '../../buttons/ProButton';
import { useMessageIdFromContext } from '../../../contexts/MessageIdContext';
import { useMessageDirection } from '../../../state/selectors';
import { useShowUserDetailsCbFromConversation } from '../../menuAndSettingsHooks/useShowUserDetailsCb';

const boldProfileNameCtx: Array<ContactNameContext> = [
  'conversation-list-item',
  'quoted-message-composition',
  'message-author',
  'message-info-author',
  'member-list-item',
  'contact-list-row',
];

const showPubkeyCtx: Array<ContactNameContext> = ['message-author'];

const ntsIsYouCtx: Array<ContactNameContext> = [
  'message-author',
  'quote-author',
  'quoted-message-composition',
  'message-search-result',
  'react-list-modal',
  'member-list-item',
];

const forceSingleLineCtx: Array<ContactNameContext> = [
  'message-info-author',
  'member-list-item',
  'contact-list-row',
];

const commonNameStyles: CSSProperties = {
  minWidth: 0,
  textOverflow: 'ellipsis',
  overflow: 'hidden',
  fontWeight: 'bold',
  fontSize: 'var(--font-size-md)',
};

const forceSingleLineStyle: CSSProperties = {
  whiteSpace: 'nowrap',
};

const boldStyles: CSSProperties = {
  fontWeight: 'bold',
};

export const ContactName = ({
  pubkey,
  module,
  contactNameContext,
  conversationId,
  style,
  extraNameStyle,
}: {
  pubkey: string;
  module?:
    | 'module-conversation__user'
    | 'module-message-search-result__header__name'
    | 'module-message__author';
  contactNameContext: ContactNameContext;
  conversationId?: string;
  style?: CSSProperties;
  extraNameStyle?: CSSProperties;
}) => {
  const prefix = module || 'module-contact-name';
  const isPublic = useIsPublic(conversationId);
  const shortPubkey = PubKey.shorten(pubkey);

  const isMe = isUsAnySogsFromCache(pubkey);

  const noFallback = useConversationUsernameNoFallback(pubkey);
  const realName = useConversationRealName(pubkey);
  const nickname = useNickname(pubkey);
  const isPrivate = useIsPrivate(pubkey);
  const currentUserHasPro = useCurrentUserHasPro();

  const msgId = useMessageIdFromContext();

  const msgDirection = useMessageDirection(msgId);

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
  const forceSingleLine = forceSingleLineCtx.includes(contactNameContext);

  const displayedName = shouldShowShortenPkAsName ? shortPubkey : displayName;

  const userHasPro = useUserHasPro(pubkey);

  const showConversationSettingsCb = useShowUserDetailsCbFromConversation(pubkey);

  const showProBadge = useProBadgeOnClickCb({
    context: 'contact-name',
    args: {
      userHasPro,
      isMe,
      contactNameContext,
      currentUserHasPro,
      isBlinded: PubKey.isBlinded(pubkey),
      providedCb: showConversationSettingsCb,
    },
  });

  let mergedNameStyle: CSSProperties = commonNameStyles;
  if (forceSingleLine) {
    mergedNameStyle = {
      ...mergedNameStyle,
      ...forceSingleLineStyle,
    };
  }
  if (boldProfileName) {
    mergedNameStyle = {
      ...mergedNameStyle,
      ...boldStyles,
    };
  }
  mergedNameStyle = {
    ...mergedNameStyle,
    ...extraNameStyle,
  };

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
        maxWidth: '100%',
        ...style,
      }}
    >
      {displayedName ? (
        <div style={mergedNameStyle} className={`${prefix}__profile-name`}>
          <Emojify text={displayedName} sizeClass="small" isGroup={!isPrivate} />
        </div>
      ) : null}
      {showProBadge.show ? (
        <ProIconButton
          iconSize={'small'}
          style={{
            backgroundColor:
              msgDirection === 'outgoing' ? 'var(--white-color)' : 'var(--primary-color)',
          }}
          dataTestId="pro-badge-contact-name"
          onClick={showProBadge.cb}
        />
      ) : null}
      {shouldShowPubkey ? <div className={`${prefix}__profile-number`}>{shortPubkey}</div> : null}
    </span>
  );
};
