/**
 * Índice de utilidades para analytics
 */

export { eventId, generateEventId, toBase64Url } from './id';
export {
  normalizeEmail,
  normalizePhone,
  sha256Hex,
  hashEmail,
  hashPhone,
  hashUserData,
  normalizeUserDataForPixel,
} from './hash';
export { canSendAnalytics, canSendAds, isAdsConsentResolved, logConsentBlocked } from './consent';
