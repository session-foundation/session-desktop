import { UserSync } from '../session/utils/job_runners/jobs/UserSyncJob';
import { assertUnreachable } from '../types/sqlSharedTypes';
import { NetworkTime } from './NetworkTime';
import { Storage } from './storage';

type FeatureNameTracked = 'null';
let isNullFeatureReleased: boolean | undefined;

/**
 * This is only intended for testing. Do not call this in production.
 */
export function resetFeatureReleasedCachedValue() {
  isNullFeatureReleased = undefined;
}

// eslint-disable-next-line consistent-return
function getIsFeatureReleasedCached(featureName: FeatureNameTracked) {
  switch (featureName) {
    case 'null':
      return isNullFeatureReleased;
    default:
      assertUnreachable(featureName, 'case not handled for getIsFeatureReleasedCached');
  }
}

function setIsFeatureReleasedCached(featureName: FeatureNameTracked, value: boolean) {
  switch (featureName) {
    case 'null':
      isNullFeatureReleased = value;
      break;
    default:
      assertUnreachable(featureName, 'case not handled for setIsFeatureReleasedCached');
  }
}

// eslint-disable-next-line consistent-return
function getFeatureReleaseTimestamp(featureName: FeatureNameTracked) {
  switch (featureName) {
    case 'null':
      return 0;
    default:
      assertUnreachable(featureName, 'case not handled for getFeatureReleaseTimestamp');
  }
}

function featureStorageItemId(featureName: FeatureNameTracked) {
  return `featureReleased-${featureName}`;
}

export async function getIsFeatureReleased(featureName: FeatureNameTracked): Promise<boolean> {
  if (getIsFeatureReleasedCached(featureName) === undefined) {
    // read values from db and cache them as it looks like we did not
    const oldIsFeatureReleased = Boolean(Storage.get(featureStorageItemId(featureName)));
    // values do not exist in the db yet. Let's store false for now in the db and update our cached value.
    if (oldIsFeatureReleased === undefined) {
      await Storage.put(featureStorageItemId(featureName), false);
      setIsFeatureReleasedCached(featureName, false);
    } else {
      setIsFeatureReleasedCached(featureName, oldIsFeatureReleased);
    }
  }
  return Boolean(getIsFeatureReleasedCached(featureName));
}

async function checkIsFeatureReleased(featureName: FeatureNameTracked): Promise<boolean> {
  const featureAlreadyReleased = await getIsFeatureReleased(featureName);

  // Is it time to release the feature based on the network timestamp?
  if (!featureAlreadyReleased && NetworkTime.now() >= getFeatureReleaseTimestamp(featureName)) {
    window.log.info(`[releaseFeature]: It is time to release ${featureName}. Releasing it now`);
    await Storage.put(featureStorageItemId(featureName), true);
    setIsFeatureReleasedCached(featureName, true);
    // trigger a sync right away so our user data is online
    await UserSync.queueNewJobIfNeeded();
  }

  const isReleased = Boolean(getIsFeatureReleasedCached(featureName));
  // window.log.debug(
  //   `[releaseFeature]: "${featureName}" ${isReleased ? 'is released' : 'has not been released yet'}`
  // );
  return isReleased;
}

async function checkIsNullReleased() {
  return checkIsFeatureReleased('null');
}

function isNullReleasedCached(): boolean {
  return !!isNullFeatureReleased;
}

export const ReleasedFeatures = { checkIsNullReleased, isNullReleasedCached };
