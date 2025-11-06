import useUpdate from 'react-use/lib/useUpdate';
import { ProDebugSection } from '../FeatureFlags';
import { SpacerLG } from '../../../basic/Text';
import {
  SessionProInfoVariant,
  useShowSessionProInfoDialogCbWithVariant,
} from '../../SessionProInfoModal';
import { Flex } from '../../../basic/Flex';
import { LucideIcon } from '../../../icon/LucideIcon';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';
import { DebugButton } from '../components';
import { DebugMenuSection } from '../DebugMenuModal';

export function ProPlaygroundPage() {
  const forceUpdate = useUpdate();
  const handleClick = useShowSessionProInfoDialogCbWithVariant();

  return (
    <>
      <ProDebugSection forceUpdate={forceUpdate} />
      <h2>Call to Actions (CTAs)</h2>
      <Flex
        $container={true}
        $flexGap="var(--margins-sm)"
        style={{ color: 'var(--warning-color)' }}
      >
        <LucideIcon unicode={LUCIDE_ICONS_UNICODE.TRIANGLE_ALERT} iconSize={'small'} />{' '}
        {'Pro CTAs only work if pro is available, toggle it above!'}
      </Flex>
      <SpacerLG />
      <DebugMenuSection title="CTAs" rowWrap={true}>
        <DebugButton onClick={() => handleClick(SessionProInfoVariant.GENERIC)}>
          Generic
        </DebugButton>
        <DebugButton onClick={() => handleClick(SessionProInfoVariant.MESSAGE_CHARACTER_LIMIT)}>
          Character Limit
        </DebugButton>
        <DebugButton onClick={() => handleClick(SessionProInfoVariant.PINNED_CONVERSATION_LIMIT)}>
          Pinned Conversations
        </DebugButton>
        <DebugButton
          onClick={() => handleClick(SessionProInfoVariant.PINNED_CONVERSATION_LIMIT_GRANDFATHERED)}
        >
          Pinned Conversations (Grandfathered)
        </DebugButton>
        <DebugButton onClick={() => handleClick(SessionProInfoVariant.PROFILE_PICTURE_ANIMATED)}>
          Animated Profile Picture
        </DebugButton>
        <DebugButton
          onClick={() => handleClick(SessionProInfoVariant.ALREADY_PRO_PROFILE_PICTURE_ANIMATED)}
        >
          Animated Profile Picture (Has pro)
        </DebugButton>
      </DebugMenuSection>
    </>
  );
}
