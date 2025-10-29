import useUpdate from 'react-use/lib/useUpdate';
import { FlagToggle } from '../FeatureFlags';
import { useFeatureFlag } from '../../../../state/ducks/types/releasedFeaturesReduxTypes';
import { SessionButton } from '../../../basic/SessionButton';
import { SpacerLG, SpacerXS } from '../../../basic/Text';
import {
  SessionProInfoVariant,
  useShowSessionProInfoDialogCbWithVariant,
} from '../../SessionProInfoModal';
import { Flex } from '../../../basic/Flex';
import { LucideIcon } from '../../../icon/LucideIcon';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';

export function ProPlaygroundPage() {
  const forceUpdate = useUpdate();
  const handleClick = useShowSessionProInfoDialogCbWithVariant();

  return (
    <>
      <h2>Flags</h2>
      <Flex $container={true} $flexDirection="column" $flexGap="var(--margins-sm)">
        <FlagToggle
          forceUpdate={forceUpdate}
          flag="proAvailable"
          value={useFeatureFlag('proAvailable')}
        />
        <FlagToggle
          forceUpdate={forceUpdate}
          flag="mockCurrentUserHasPro"
          value={useFeatureFlag('mockCurrentUserHasPro')}
        />
        <FlagToggle
          forceUpdate={forceUpdate}
          flag="mockCurrentUserHasProExpired"
          value={useFeatureFlag('mockCurrentUserHasProExpired')}
        />
        <FlagToggle
          forceUpdate={forceUpdate}
          flag="mockOthersHavePro"
          value={useFeatureFlag('mockOthersHavePro')}
        />
      </Flex>
      <SpacerXS />
      <h2>Call to Actions (CTAs)</h2>
      <SpacerXS />
      <Flex
        $container={true}
        $flexGap="var(--margins-sm)"
        style={{ color: 'var(--warning-color)' }}
      >
        {' '}
        <LucideIcon unicode={LUCIDE_ICONS_UNICODE.TRIANGLE_ALERT} iconSize={'small'} />{' '}
        {'Pro CTAs only work if pro is available, toggle it above!'}
      </Flex>
      <SpacerLG />
      <Flex $container={true} $flexDirection="column" $flexGap="var(--margins-sm)">
        <SessionButton onClick={() => handleClick(SessionProInfoVariant.GENERIC)}>
          Generic
        </SessionButton>
        <SessionButton onClick={() => handleClick(SessionProInfoVariant.MESSAGE_CHARACTER_LIMIT)}>
          Character Count
        </SessionButton>
        <SessionButton onClick={() => handleClick(SessionProInfoVariant.PINNED_CONVERSATION_LIMIT)}>
          Pinned Conversations
        </SessionButton>
        <SessionButton
          onClick={() => handleClick(SessionProInfoVariant.PINNED_CONVERSATION_LIMIT_GRANDFATHERED)}
        >
          Pinned Conversations (Grandfathered)
        </SessionButton>
        <SessionButton onClick={() => handleClick(SessionProInfoVariant.PROFILE_PICTURE_ANIMATED)}>
          Animated Profile Picture
        </SessionButton>
        <SessionButton
          onClick={() => handleClick(SessionProInfoVariant.ALREADY_PRO_PROFILE_PICTURE_ANIMATED)}
        >
          Animated Profile Picture (Has pro)
        </SessionButton>
        <SessionButton onClick={() => handleClick(SessionProInfoVariant.ONE_TIME_EXPIRE_SOON)}>
          Expiring Soon
        </SessionButton>
        <SessionButton onClick={() => handleClick(SessionProInfoVariant.ONE_TIME_EXPIRED)}>
          Expired
        </SessionButton>
      </Flex>
    </>
  );
}
