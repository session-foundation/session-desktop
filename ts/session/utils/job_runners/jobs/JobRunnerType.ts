export type JobRunnerType =
  | 'UserSyncJob'
  | 'GroupSyncJob'
  | 'FetchMsgExpirySwarmJob'
  | 'UpdateMsgExpirySwarmJob'
  | 'FakeSleepForJob'
  | 'FakeSleepForMultiJob'
  | 'AvatarDownloadJob'
  | 'AvatarReuploadJob'
  | 'AvatarMigrateJob'
  | 'GroupInviteJob'
  | 'GroupPromoteJob'
  | 'GroupPendingRemovalJob'
  | 'UpdateProRevocationListJob';
