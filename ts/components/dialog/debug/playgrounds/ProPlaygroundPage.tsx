import useUpdate from 'react-use/lib/useUpdate';
import { ProDebugSection } from '../FeatureFlags';
import { SpacerLG } from '../../../basic/Text';
import { ProCTAVariant, useShowSessionProInfoDialogCbWithVariant } from '../../SessionProInfoModal';
import { Flex } from '../../../basic/Flex';
import { LucideIcon } from '../../../icon/LucideIcon';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';
import { DebugButton } from '../components';
import { DebugMenuPageProps, DebugMenuSection } from '../DebugMenuModal';

export function ProPlaygroundPage(props: DebugMenuPageProps) {
  const forceUpdate = useUpdate();
  const handleClick = useShowSessionProInfoDialogCbWithVariant();

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
        <DebugButton onClick={() => handleClick(ProCTAVariant.GENERIC)}>Generic</DebugButton>
        <DebugButton onClick={() => handleClick(ProCTAVariant.MESSAGE_CHARACTER_LIMIT)}>
          Character Limit
        </DebugButton>
        <DebugButton onClick={() => handleClick(ProCTAVariant.PINNED_CONVERSATION_LIMIT)}>
          Pinned Conversations
        </DebugButton>
        <DebugButton
          onClick={() => handleClick(ProCTAVariant.PINNED_CONVERSATION_LIMIT_GRANDFATHERED)}
        >
          Pinned Conversations (Grandfathered)
        </DebugButton>
        <DebugButton onClick={() => handleClick(ProCTAVariant.ANIMATED_DISPLAY_PICTURE)}>
          Animated Profile Picture
        </DebugButton>
        <DebugButton onClick={() => handleClick(ProCTAVariant.ANIMATED_DISPLAY_PICTURE_ACTIVATED)}>
          Animated Profile Picture (Has pro)
        </DebugButton>
        <h3 style={{ width: '100%' }} >Pro Group CTAs  <i>WIP</i>
        </h3>
        <DebugButton onClick={() => handleClick(ProCTAVariant.GROUP_ACTIVATED)}>
          Group Activated
        </DebugButton>
        <DebugButton onClick={() => handleClick(ProCTAVariant.GROUP_NON_ADMIN)}>
          Group (Non-Admin)
        </DebugButton>
        <DebugButton onClick={() => handleClick(ProCTAVariant.GROUP_ADMIN)}>
          Group (Admin)
        </DebugButton>
        <h3 style={{ width: '100%' }} >Special CTAs</h3>
        <DebugButton onClick={() => handleClick(ProCTAVariant.EXPIRING_SOON)}>
          Expiring Soon
        </DebugButton>
        <DebugButton onClick={() => handleClick(ProCTAVariant.EXPIRED)}>Expired</DebugButton>
      </DebugMenuSection>
    </>
  );
}
