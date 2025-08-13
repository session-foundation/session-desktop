export type JobRunnerType =
  | 'UserSyncJob'
  | 'GroupSyncJob'
  | 'FetchMsgExpirySwarmJob'
  | 'UpdateMsgExpirySwarmJob'
  | 'FakeSleepForJob'
  | 'FakeSleepForMultiJob'
  | 'AvatarDownloadJob'
  | 'AvatarMigrateJob'
  | 'GroupInviteJob'
  | 'GroupPromoteJob'
  | 'GroupPendingRemovalJob';
