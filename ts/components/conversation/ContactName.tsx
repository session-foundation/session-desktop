import { CSSProperties } from 'react';
import clsx from 'clsx';

import {
  useIsPrivate,
  useNicknameOrProfileNameOrShortenedPubkey,
} from '../../hooks/useParamSelector';
import { Emojify } from './Emojify';
import { PubKey } from '../../session/types';
import { UserUtils } from '../../session/utils';
import { tr } from '../../localization/localeTools';

type Props = {
  pubkey: string;
  name?: string | null;
  profileName?: string | null;
  module?:
    | 'module-conversation__user'
    | 'module-message-search-result__header__name'
    | 'module-message__author';
  boldProfileName?: boolean;
  shouldShowPubkey: boolean;
  isPublic?: boolean;
};

export const ContactName = (props: Props) => {
  const { pubkey, name, profileName, module, boldProfileName, shouldShowPubkey, isPublic } = props;
  const prefix = module || 'module-contact-name';

  const convoName = useNicknameOrProfileNameOrShortenedPubkey(pubkey);
  const isPrivate = useIsPrivate(pubkey);
  const isYou = pubkey === UserUtils.getOurPubKeyStrFromCache();
  const shouldShowProfile = Boolean(convoName || profileName || name);

  const commonStyles = {
    minWidth: 0,
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  } as CSSProperties;

  const styles = (
    boldProfileName
      ? {
          fontWeight: 'bold',
          ...commonStyles,
        }
      : commonStyles
  ) as CSSProperties;

  const shortPubkey = PubKey.shorten(pubkey);
  const textProfile = profileName || name || convoName || shortPubkey;
  const displayedName =
    shouldShowProfile && isPublic && textProfile !== shortPubkey
      ? `${textProfile} ${shortPubkey}`.trim()
      : textProfile;

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
      {shouldShowProfile ? (
        <div style={styles} className={`${prefix}__profile-name`}>
          <Emojify
            text={isYou ? tr('you') : displayedName}
            sizeClass="small"
            isGroup={!isPrivate}
          />
        </div>
      ) : null}
      {shouldShowPubkey ? <div className={`${prefix}__profile-number`}>{pubkey}</div> : null}
    </span>
  );
};
