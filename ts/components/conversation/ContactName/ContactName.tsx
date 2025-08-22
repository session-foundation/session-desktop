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
import { assertUnreachable } from '../../../types/sqlSharedTypes';

/**
 * In some contexts, we want to bold the name of the contact.
 */
function isBoldProfileNameCtx(ctx: ContactNameContext) {
  // We are doing this as a switch instead of an array so we have to be explicit anytime we add a new context,
  // thanks to the assertUnreachable below
  switch (ctx) {
    case 'conversation-list-item':
    case 'quoted-message-composition':
    case 'message-author':
    case 'message-info-author':
    case 'member-list-item':
    case 'member-list-item-mention-row':
    case 'contact-list-row':
      return true;
    case 'quote-author':
    case 'conversation-list-item-search':
    case 'react-list-modal':
    case 'message-search-result':
      return false;
    default:
      assertUnreachable(ctx, 'isBoldProfileNameCtx');
      throw new Error('isBoldProfileNameCtx: unreachable');
  }
}

/**
 * In some contexts, we want to show the pubkey of the contact.
 */
function isShowPubkeyCtx(ctx: ContactNameContext) {
  // We are doing this as a switch instead of an array so we have to be explicit anytime we add a new context,
  // thanks to the assertUnreachable below
  switch (ctx) {
    case 'message-author':
    case 'message-info-author':
      return true;
    case 'member-list-item':
    case 'member-list-item-mention-row':
    case 'contact-list-row':
    case 'quote-author':
    case 'conversation-list-item':
    case 'quoted-message-composition':
    case 'conversation-list-item-search':
    case 'react-list-modal':
    case 'message-search-result':
      return false;
    default:
      assertUnreachable(ctx, 'isShowPubkeyCtx');
      throw new Error('isShowPubkeyCtx: unreachable');
  }
}

/**
 * In some contexts, we want to rename "Note To Self" to "You".
 */
function isShowNtsIsYouCtx(ctx: ContactNameContext) {
  // We are doing this as a switch instead of an array so we have to be explicit anytime we add a new context,
  // thanks to the assertUnreachable below
  switch (ctx) {
    case 'message-author':
    case 'quote-author':
    case 'quoted-message-composition':
    case 'react-list-modal':
    case 'message-search-result':
    case 'member-list-item':
    case 'member-list-item-mention-row':
      return true;
    case 'message-info-author':
    case 'contact-list-row':
    case 'conversation-list-item':
    case 'conversation-list-item-search':
      return false;
    default:
      assertUnreachable(ctx, 'isShowNtsIsYouCtx');
      throw new Error('isShowNtsIsYouCtx: unreachable');
  }
}

/**
 * Usually, we'd allow the name to be multiline. but in some contexts we want to force it to be single line.
 */
function isForceSingleLineCtx(ctx: ContactNameContext) {
  // We are doing this as a switch instead of an array so we have to be explicit anytime we add a new context,
  // thanks to the assertUnreachable below
  switch (ctx) {
    case 'message-info-author':
    case 'member-list-item':
    case 'member-list-item-mention-row':
    case 'contact-list-row':
      return true;
    case 'message-author':
    case 'quote-author':
    case 'quoted-message-composition':
    case 'react-list-modal':
    case 'message-search-result':
    case 'conversation-list-item':
    case 'conversation-list-item-search':
      return false;
    default:
      assertUnreachable(ctx, 'isForceSingleLineCtx');
      throw new Error('isForceSingleLineCtx: unreachable');
  }
}

/**
 * Usually, we'd allow the name to be multiline. but in some contexts we want to force it to be single line.
 */
function isShowUPMOnClickCtx(ctx: ContactNameContext) {
  // We are doing this as a switch instead of an array so we have to be explicit anytime we add a new context,
  // thanks to the assertUnreachable below
  switch (ctx) {
    case 'message-info-author':
      return true;
    case 'member-list-item':
    case 'member-list-item-mention-row':
    case 'contact-list-row':
    case 'message-author':
    case 'quote-author':
    case 'quoted-message-composition':
    case 'react-list-modal':
    case 'message-search-result':
    case 'conversation-list-item':
    case 'conversation-list-item-search':
      return false;
    default:
      assertUnreachable(ctx, 'isForceSingleLineCtx');
      throw new Error('isForceSingleLineCtx: unreachable');
  }
}

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
    ? // we want to show "You" instead of "Note to Self" in some places (like quotes)
      tr(isShowNtsIsYouCtx(contactNameContext) ? 'you' : 'noteToSelf')
    : // we want to show the realName in brackets if a nickname is set for search results
      contactNameContext === 'conversation-list-item-search' && nickname && realName
      ? `${nickname} (${realName})`
      : noFallback;

  const shouldShowShortenPkAsName = !displayName;

  const shouldShowPubkey =
    !shouldShowShortenPkAsName && isPublic && isShowPubkeyCtx(contactNameContext);
  const boldProfileName = isBoldProfileNameCtx(contactNameContext);
  const forceSingleLine = isForceSingleLineCtx(contactNameContext);

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
      onClick={(isShowUPMOnClickCtx(contactNameContext) && showConversationSettingsCb) || undefined}
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
