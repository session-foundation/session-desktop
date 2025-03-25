import { CSSProperties } from 'react';
import clsx from 'clsx';

import {
  useIsPrivate,
  useNicknameOrProfileNameOrShortenedPubkey,
} from '../../hooks/useParamSelector';
import { Emojify } from './Emojify';
import { PubKey } from '../../session/types';

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
};

export const ContactName = (props: Props) => {
  const { pubkey, name, profileName, module, boldProfileName, shouldShowPubkey } = props;
  const prefix = module || 'module-contact-name';

  const convoName = useNicknameOrProfileNameOrShortenedPubkey(pubkey);
  const isPrivate = useIsPrivate(pubkey);
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
  const textProfile = profileName || name || convoName || PubKey.shorten(pubkey);

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
          <Emojify text={textProfile} sizeClass="small" isGroup={!isPrivate} />
        </div>
      ) : null}
      {shouldShowPubkey ? <div className={`${prefix}__profile-number`}>{pubkey}</div> : null}
    </span>
  );
};
