import { memo, SessionDataTestId, useState } from 'react';
import styled from 'styled-components';
import clsx from 'clsx';

import { useDisableDrag } from '../../hooks/useDisableDrag';
import { useEncryptedFileFetch } from '../../hooks/useEncryptedFileFetch';
import {
  useAvatarPath,
  useConversationUsername,
  useIsClosedGroup,
  useIsPublic,
} from '../../hooks/useParamSelector';
import { SessionIcon } from '../icon';
import { AvatarPlaceHolder } from './AvatarPlaceHolder/AvatarPlaceHolder';
import { ClosedGroupAvatar } from './AvatarPlaceHolder/ClosedGroupAvatar';
import { useIsMessageSelectionMode } from '../../state/selectors/selectedConversation';
import { PlusAvatarButton } from '../buttons/PlusAvatarButton';
import { StyledAvatar } from './AvatarPlaceHolder/StyledAvatar';

export enum AvatarSize {
  XS = 28,
  S = 36,
  M = 48,
  L = 80,
  XL = 110,
  HUGE = 300,
}

type Props = {
  forcedAvatarPath?: string | null;
  forcedName?: string;
  pubkey: string;
  size: AvatarSize;
  base64Data?: string; // if this is not empty, it will be used to render the avatar with base64 encoded data
  onAvatarClick?: () => void;
  dataTestId?: SessionDataTestId;
  imageDataTestId?: SessionDataTestId;
  /**
   * If this is set, show the `+` button to change the avatar.
   * This will be the callback to call on click on that `+` button.
   */
  onPlusAvatarClick?: () => void;
};

const Identicon = (props: Pick<Props, 'forcedName' | 'pubkey' | 'size'>) => {
  const { size, forcedName, pubkey } = props;
  const displayName = useConversationUsername(pubkey);
  const userName = forcedName || displayName || '0';

  return <AvatarPlaceHolder diameter={size} name={userName} pubkey={pubkey} />;
};

const CrownWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  bottom: 11%;
  right: 11%;
  height: 18px;
  width: 18px;
  transform: translate(20%, 20%); // getting over 23% creates a glitch
  background: var(--background-primary-color);
  border-radius: 50%;
`;

export const CrownIcon = () => {
  return (
    <CrownWrapper>
      <SessionIcon
        iconColor="#f7c347"
        iconSize={'small'}
        iconType="crown"
        iconPadding="1px 0 0 0 "
      />
    </CrownWrapper>
  );
};

const NoImage = memo(
  (
    props: Pick<Props, 'forcedName' | 'size' | 'pubkey' | 'onAvatarClick'> & {
      isClosedGroup: boolean;
    }
  ) => {
    const { forcedName, size, pubkey, isClosedGroup, onAvatarClick } = props;

    if (pubkey && isClosedGroup) {
      return <ClosedGroupAvatar size={size} convoId={pubkey} onAvatarClick={onAvatarClick} />;
    }

    return <Identicon size={size} forcedName={forcedName} pubkey={pubkey} />;
  }
);

const AvatarImage = (
  props: Pick<Props, 'base64Data' | 'dataTestId'> & {
    avatarPath?: string;
    name?: string; // display name, profileName or pubkey, whatever is set first
    imageBroken: boolean;
    handleImageError: () => any;
  }
) => {
  const { avatarPath, base64Data, imageBroken, dataTestId, handleImageError } = props;

  const disableDrag = useDisableDrag();

  if ((!avatarPath && !base64Data) || imageBroken) {
    return null;
  }
  const dataToDisplay = base64Data ? `data:image/jpeg;base64,${base64Data}` : avatarPath;

  return (
    <img
      onError={handleImageError}
      onDragStart={disableDrag}
      src={dataToDisplay}
      data-testid={dataTestId}
    />
  );
};

const AvatarInner = (props: Props) => {
  const {
    base64Data,
    size,
    pubkey,
    forcedAvatarPath,
    forcedName,
    dataTestId,
    imageDataTestId,
    onAvatarClick,
    onPlusAvatarClick,
  } = props;
  const [imageBroken, setImageBroken] = useState(false);

  const isSelectingMessages = useIsMessageSelectionMode();

  const isClosedGroup = useIsClosedGroup(pubkey);
  const avatarPath = useAvatarPath(pubkey);
  const name = useConversationUsername(pubkey);
  const isCommunity = useIsPublic(pubkey);
  // contentType is not important
  const { urlToLoad } = useEncryptedFileFetch(forcedAvatarPath || avatarPath || '', '', true);

  const handleImageError = () => {
    window.log.warn(
      'Avatar: Image failed to load; failing over to placeholder',
      urlToLoad,
      forcedAvatarPath || avatarPath
    );
    setImageBroken(true);
  };

  /**
   * base64Data is used for in memory avatars (like before joining a community from the Join a Community left pane section)
   * Somehow, sometimes (only in the left pane) urlToLoad is set (to a wrong avatar) but `forcedAvatarPath || avatarPath` are both unset.
   * I suspect that it comes from the virtualisation of the list, but I am not 100% sure.
   * I didn't find the root cause but to avoid it we enforce that urlToLoad is used only when one of the avatar path is set.
   */
  const hasImage = (base64Data || ((forcedAvatarPath || avatarPath) && urlToLoad)) && !imageBroken;

  const isClickable = !!onAvatarClick || (isCommunity && onPlusAvatarClick);

  return (
    <StyledAvatar
      $diameter={size}
      className={clsx('module-avatar', isClickable && 'module-avatar-clickable')}
      onClick={e => {
        if (isSelectingMessages) {
          // we could toggle the selection of this message,
          // but this just disable opening the new Conversation dialog with that user while selecting messages
          return;
        }
        if (isCommunity && onPlusAvatarClick) {
          e.stopPropagation();
          e.preventDefault();
          onPlusAvatarClick();
        } else if (onAvatarClick) {
          e.stopPropagation();
          e.preventDefault();
          onAvatarClick();
        }
      }}
      role="button"
      data-testid={dataTestId}
    >
      {hasImage ? (
        <AvatarImage
          avatarPath={urlToLoad}
          base64Data={base64Data}
          imageBroken={imageBroken}
          name={forcedName || name}
          handleImageError={handleImageError}
          dataTestId={imageDataTestId}
        />
      ) : (
        <NoImage
          pubkey={pubkey}
          isClosedGroup={isClosedGroup}
          size={size}
          forcedName={forcedName}
          onAvatarClick={onAvatarClick}
        />
      )}
      {onPlusAvatarClick ? (
        <PlusAvatarButton onClick={onPlusAvatarClick} dataTestId="image-upload-section" />
      ) : null}
    </StyledAvatar>
  );
};

export const Avatar = AvatarInner;
