import { isEmpty, isString } from 'lodash';
import { FakeSleepForJob, FakeSleepForMultiJob } from './jobs/FakeSleepForJob';
import { AvatarDownload } from './jobs/AvatarDownloadJob';
import { UserSync } from './jobs/UserSyncJob';
import { PersistedJob, TypeOfPersistedData } from './PersistedJob';
import { assertUnreachable } from '../../../types/sqlSharedTypes';
import { AvatarMigrate } from './jobs/AvatarMigrateJob';
import { FetchMsgExpirySwarm } from './jobs/FetchMsgExpirySwarmJob';
import { GroupInvite } from './jobs/GroupInviteJob';
import { GroupPendingRemovals } from './jobs/GroupPendingRemovalsJob';
import { GroupSync } from './jobs/GroupSyncJob';
import { UpdateMsgExpirySwarm } from './jobs/UpdateMsgExpirySwarmJob';
import { AvatarReupload } from './jobs/AvatarReuploadJob';
import { UpdateProRevocationList } from './jobs/UpdateProRevocationListJob';

export function persistedJobFromData<T extends TypeOfPersistedData>(
  data: T
): PersistedJob<T> | null {
  if (!data || isEmpty(data.jobType) || !isString(data?.jobType)) {
    return null;
  }
  const { jobType } = data;

  switch (jobType) {
    case 'UserSyncJobType':
      return new UserSync.UserSyncJob(data) as unknown as PersistedJob<T>;
    case 'AvatarDownloadJobType':
      return new AvatarDownload.AvatarDownloadJob(data) as unknown as PersistedJob<T>;
    case 'AvatarReuploadJobType':
      return new AvatarReupload.AvatarReuploadJob(data) as unknown as PersistedJob<T>;
    case 'AvatarMigrateJobType':
      return new AvatarMigrate.AvatarMigrateJob(data) as unknown as PersistedJob<T>;
    case 'FetchMsgExpirySwarmJobType':
      return new FetchMsgExpirySwarm.FetchMsgExpirySwarmJob(data) as unknown as PersistedJob<T>;
    case 'GroupInviteJobType':
      return new GroupInvite.GroupInviteJob(data) as unknown as PersistedJob<T>;
    case 'GroupPendingRemovalJobType':
      return new GroupPendingRemovals.GroupPendingRemovalsJob(data) as unknown as PersistedJob<T>;
    case 'GroupSyncJobType':
      return new GroupSync.GroupSyncJob(data) as unknown as PersistedJob<T>;
    case 'UpdateMsgExpirySwarmJobType':
      return new UpdateMsgExpirySwarm.UpdateMsgExpirySwarmJob(data) as unknown as PersistedJob<T>;
    case 'UpdateProRevocationListJobType':
      return new UpdateProRevocationList.UpdateProRevocationListJob(
        data
      ) as unknown as PersistedJob<T>;

    case 'FakeSleepForJobType':
      return new FakeSleepForJob(data) as unknown as PersistedJob<T>;
    case 'FakeSleepForJobMultiType':
      return new FakeSleepForMultiJob(data) as unknown as PersistedJob<T>;
    default:
      try {
        assertUnreachable(jobType, `persistedJobFromData unknown job type: "${jobType}"`);
      } catch (e) {
        window?.log?.warn('assertUnreachable failed:', e.message);
      }
      return null;
  }
}
