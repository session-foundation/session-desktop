export const areLegacyGroupsReadOnly = (): boolean => {
  const theyAre = !!window.inboxStore?.getState()?.releasedFeatures.legacyGroupsReadOnly;

  return window.sessionFeatureFlags.forceLegacyGroupsDeprecated || theyAre;
};

/**
 * @returns true if legacy groups should not be polled anymore
 */
export function areLegacyGroupsReadOnlyOutsideRedux() {
  if (!window.inboxStore) {
    return false;
  }
  return areLegacyGroupsReadOnly();
}
