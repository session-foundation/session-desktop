import useUpdate from 'react-use/lib/useUpdate';
import { ProDebugSection } from '../FeatureFlags';
import { SpacerLG } from '../../../basic/Text';
import { useShowSessionCTACbWithVariant } from '../../SessionCTA';
import { Flex } from '../../../basic/Flex';
import { LucideIcon } from '../../../icon/LucideIcon';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';
import { DebugButton } from '../components';
import { DebugMenuPageProps, DebugMenuSection } from '../DebugMenuModal';
import { CTAVariant } from '../../cta/types';
import { getIsProAvailableMemo } from '../../../../hooks/useIsProAvailable';

export function ProPlaygroundPage(props: DebugMenuPageProps) {
  const forceUpdate = useUpdate();
  const handleClick = useShowSessionCTACbWithVariant();
  const proAvailable = getIsProAvailableMemo();

  if (!proAvailable) {
    return null;
  }

  return (
    <>
      <ProDebugSection {...props} forceUpdate={forceUpdate} />
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
        <h3 style={{ width: '100%' }}>Feature CTAs</h3>
        <DebugButton onClick={() => handleClick(CTAVariant.PRO_GENERIC)}>Generic</DebugButton>
        <DebugButton onClick={() => handleClick(CTAVariant.PRO_MESSAGE_CHARACTER_LIMIT)}>
          Character Limit
        </DebugButton>
        <DebugButton onClick={() => handleClick(CTAVariant.PRO_PINNED_CONVERSATION_LIMIT)}>
          Pinned Conversations
        </DebugButton>
        <DebugButton
          onClick={() => handleClick(CTAVariant.PRO_PINNED_CONVERSATION_LIMIT_GRANDFATHERED)}
        >
          Pinned Conversations (Grandfathered)
        </DebugButton>
        <DebugButton onClick={() => handleClick(CTAVariant.PRO_ANIMATED_DISPLAY_PICTURE)}>
          Animated Profile Picture
        </DebugButton>
        <DebugButton onClick={() => handleClick(CTAVariant.PRO_ANIMATED_DISPLAY_PICTURE_ACTIVATED)}>
          Animated Profile Picture (Has pro)
        </DebugButton>
        <h3 style={{ width: '100%' }}>
          Pro Group CTAs <i>WIP</i>
        </h3>
        <DebugButton onClick={() => handleClick(CTAVariant.PRO_GROUP_ACTIVATED)}>
          Group Activated
        </DebugButton>
        <DebugButton onClick={() => handleClick(CTAVariant.PRO_GROUP_NON_ADMIN)}>
          Group (Non-Admin)
        </DebugButton>
        <DebugButton onClick={() => handleClick(CTAVariant.PRO_GROUP_ADMIN)}>
          Group (Admin)
        </DebugButton>
        <h3 style={{ width: '100%' }}>Special CTAs</h3>
        <DebugButton onClick={() => handleClick(CTAVariant.PRO_EXPIRING_SOON)}>
          Expiring Soon
        </DebugButton>
        <DebugButton onClick={() => handleClick(CTAVariant.PRO_EXPIRED)}>Expired</DebugButton>
      </DebugMenuSection>
    </>
  );
}
