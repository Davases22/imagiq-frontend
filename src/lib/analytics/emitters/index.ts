/**
 * Índice de emisores de eventos
 */

export { sendGa4 } from './emit.ga4';
export { sendMeta, sendMetaCustom, setMetaAdvancedMatching, applyKnownUserAM } from './emit.meta';
export { sendTiktok } from './emit.tiktok';
export { sendMetaCapi } from './emit.meta-capi';
export { sendTikTokCapi } from './emit.tiktok-capi';
