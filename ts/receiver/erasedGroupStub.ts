import type { UserGroupsGet } from 'libsession_util_nodejs';

/**
 * Whether this UserGroups entry is what a config merge leaves of a group another of our devices
 * erased, rather than a group we are (or were) in.
 *
 * libsession applies each device's diff in turn, so when one device erases a group while another
 * changes one of its fields (marking it destroyed after seeing the group's info, say), the merge
 * recreates the erased entry holding only the changed fields: no name and no keys. A real kicked or
 * destroyed entry always keeps its name, so a removed entry without one can only be this.
 *
 * The other clients apply the same rule; keep them in step.
 */
export function isErasedGroupStub(group: UserGroupsGet) {
  // the wrapper returns an empty array, not null, for a key the entry doesn't have
  const hasBytes = (bytes: Uint8Array | null) => !!bytes && bytes.length > 0;

  return (
    (group.kicked || group.destroyed) &&
    !group.name &&
    !hasBytes(group.secretKey) &&
    !hasBytes(group.authData)
  );
}
