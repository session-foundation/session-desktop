import { LUCIDE_ICONS_UNICODE } from '../../icon/lucide';
import { LucideIcon } from '../../icon/LucideIcon';

/**
 * Used only for our own avatar display at the top-left of the app (ActionPanel).
 * It only supports the XL avatar size.
 */
export const GearAvatarButton = () => {
  return (
    <LucideIcon
      unicode={LUCIDE_ICONS_UNICODE.SETTINGS}
      iconSize={'small'}
      iconColor="var(--black-color)"
      dataTestId="settings-section"
      style={{
        position: 'absolute',
        top: '54%',
        insetInlineEnd: '23%',
        backgroundColor: 'var(--primary-color)',
        padding: 'var(--margins-xxs)',
        borderRadius: '50%',
        boxShadow: '0px 0px 3px 2px var(--border-color)',
      }}
    />
  );
};
