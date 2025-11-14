import { ProOriginatingPlatform } from 'libsession_util_nodejs';
import { assertUnreachable } from '../../../types/sqlSharedTypes';

// Mirrors backend enum
export enum ProStatus {
  NeverBeenPro = 0,
  Active = 1,
  Expired = 2,
}

// Mirrors backend enum
export enum ProAccessVariant {
  Nil = 0,
  OneMonth = 1,
  ThreeMonth = 2,
  TwelveMonth = 3,
}

// Mirrors backend enum
export enum ProItemStatus {
  Nil = 0,
  Unredeemed = 1,
  Redeemed = 2,
  Expired = 3,
  Revoked = 4,
}

// Mirrors backend enum
export enum ProPaymentProvider {
  Nil = 0,
  GooglePlayStore = 1,
  iOSAppStore = 2,
}

export function getProPaymentProviderFromProOriginatingPlatform(
  v: ProOriginatingPlatform
): ProPaymentProvider {
  switch (v) {
    case 'Nil':
      return ProPaymentProvider.Nil;
    case 'Google':
      return ProPaymentProvider.GooglePlayStore;
    case 'iOS':
      return ProPaymentProvider.iOSAppStore;
    default:
      assertUnreachable(v, 'getProPaymentProviderFromProOriginatingPlatform');
      throw new Error('getProPaymentProviderFromProOriginatingPlatform: case not handled');
  }
}

export function getProOriginatingPlatformFromProPaymentProvider(
  v: ProPaymentProvider
): ProOriginatingPlatform {
  switch (v) {
    case ProPaymentProvider.Nil:
      return 'Nil';
    case ProPaymentProvider.GooglePlayStore:
      return 'Google';
    case ProPaymentProvider.iOSAppStore:
      return 'iOS';
    default:
      assertUnreachable(v, 'getProOriginatingPlatformFromProPaymentProvider');
      throw new Error('getProOriginatingPlatformFromProPaymentProvider: case not handled');
  }
}
