/**
 * Meta Pixel (Facebook Pixel) Utilities
 *
 * Helper functions para interactuar con Meta Pixel de forma type-safe.
 * Incluye soporte para eventos estándar y personalizados.
 *
 * @see https://developers.facebook.com/docs/meta-pixel/reference
 */

/**
 * Verifica si Meta Pixel está disponible
 */
function isMetaPixelAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.fbq === 'function';
}

/**
 * Ejecuta un comando de Meta Pixel de forma segura
 */
function safeFbq(command: string, ...args: unknown[]): void {
  try {
    if (isMetaPixelAvailable()) {
      // @ts-expect-error: fbq acepta múltiples overloads
      window.fbq && window.fbq(command, ...(args as []));
    }
  } catch (error) {
    console.debug('Meta Pixel error:', error);
  }
}

/**
 * Track eventos estándar de Meta Pixel
 *
 * @example
 * ```ts
 * fbqTrack('ViewContent', {
 *   content_name: 'Product Name',
 *   content_ids: ['1234'],
 *   content_type: 'product',
 *   value: 29.99,
 *   currency: 'USD'
 * });
 * ```
 */
import type { MetaPixelEventParams } from "@/types/meta-pixel";

export function fbqTrack(
  eventName: string,
  parameters?: MetaPixelEventParams
): void {
  safeFbq('track', eventName, parameters);
}

/**
 * Track eventos personalizados de Meta Pixel
 *
 * @example
 * ```ts
 * fbqTrackCustom('Newsletter_Signup', {
 *   source: 'homepage_banner'
 * });
 * ```
 */
export function fbqTrackCustom(
  eventName: string,
  parameters?: MetaPixelEventParams
): void {
  safeFbq('trackCustom', eventName, parameters);
}

/**
 * Track evento PageView
 * Normalmente se llama automáticamente en el bootstrap,
 * pero puedes usarlo para SPAs en cambios de ruta
 */
export function fbqPageView(): void {
  safeFbq('track', 'PageView');
}

/**
 * Track evento ViewContent
 * Se usa cuando un usuario ve un producto o contenido
 */
export function fbqViewContent(params: {
  content_name: string;
  content_ids: string[];
  content_type?: 'product' | 'product_group';
  value?: number;
  currency?: string;
}): void {
  safeFbq('track', 'ViewContent', {
    content_type: params.content_type || 'product',
    currency: params.currency || 'COP',
    ...params,
  });
}

/**
 * Track evento Search
 * Se usa cuando un usuario realiza una búsqueda
 */
export function fbqSearch(params: {
  search_string: string;
  content_category?: string;
  content_ids?: string[];
  value?: number;
  currency?: string;
}): void {
  safeFbq('track', 'Search', {
    currency: params.currency || 'COP',
    ...params,
  });
}

/**
 * Track evento AddToCart
 * Se usa cuando un usuario agrega un producto al carrito
 */
export function fbqAddToCart(params: {
  content_name: string;
  content_ids: string[];
  content_type?: 'product' | 'product_group';
  value: number;
  currency?: string;
}): void {
  safeFbq('track', 'AddToCart', {
    content_type: params.content_type || 'product',
    currency: params.currency || 'COP',
    ...params,
  });
}

/**
 * Track evento AddToWishlist
 * Se usa cuando un usuario agrega un producto a favoritos/wishlist
 */
export function fbqAddToWishlist(params: {
  content_name: string;
  content_ids: string[];
  content_category?: string;
  value?: number;
  currency?: string;
}): void {
  safeFbq('track', 'AddToWishlist', {
    currency: params.currency || 'COP',
    ...params,
  });
}

/**
 * Track evento InitiateCheckout
 * Se usa cuando un usuario inicia el proceso de checkout
 */
export function fbqInitiateCheckout(params: {
  content_ids: string[];
  content_category?: string;
  num_items: number;
  value: number;
  currency?: string;
}): void {
  safeFbq('track', 'InitiateCheckout', {
    currency: params.currency || 'COP',
    ...params,
  });
}

/**
 * Track evento AddPaymentInfo
 * Se usa cuando un usuario agrega información de pago
 */
export function fbqAddPaymentInfo(params: {
  content_ids?: string[];
  content_category?: string;
  value?: number;
  currency?: string;
}): void {
  safeFbq('track', 'AddPaymentInfo', {
    currency: params.currency || 'COP',
    ...params,
  });
}

/**
 * Track evento Purchase
 * Se usa cuando un usuario completa una compra
 *
 * @example
 * ```ts
 * fbqPurchase({
 *   content_ids: ['1234', '5678'],
 *   content_type: 'product',
 *   value: 59.98,
 *   currency: 'USD',
 *   num_items: 2
 * });
 * ```
 */
export function fbqPurchase(params: {
  content_ids: string[];
  content_type?: 'product' | 'product_group';
  value: number;
  currency?: string;
  num_items?: number;
}): void {
  safeFbq('track', 'Purchase', {
    content_type: params.content_type || 'product',
    currency: params.currency || 'COP',
    ...params,
  });
}

/**
 * Track evento Lead
 * Se usa cuando un usuario completa un formulario de leads
 */
export function fbqLead(params?: {
  content_name?: string;
  content_category?: string;
  value?: number;
  currency?: string;
}): void {
  safeFbq('track', 'Lead', {
    currency: params?.currency || 'COP',
    ...params,
  });
}

/**
 * Track evento CompleteRegistration
 * Se usa cuando un usuario completa un registro
 */
export function fbqCompleteRegistration(params?: {
  content_name?: string;
  status?: string;
  value?: number;
  currency?: string;
}): void {
  safeFbq('track', 'CompleteRegistration', {
    currency: params?.currency || 'COP',
    ...params,
  });
}

/**
 * Track evento Contact
 * Se usa cuando un usuario contacta con la empresa
 */
export function fbqContact(): void {
  safeFbq('track', 'Contact');
}

/**
 * Track evento Subscribe
 * Se usa cuando un usuario se suscribe (newsletter, etc)
 */
export function fbqSubscribe(params?: {
  value?: number;
  currency?: string;
  predicted_ltv?: number;
}): void {
  safeFbq('track', 'Subscribe', {
    currency: params?.currency || 'COP',
    ...params,
  });
}

/**
 * Gestión de consentimiento para Meta Pixel
 *
 * @example
 * ```ts
 * // Revocar consentimiento
 * fbqConsent('revoke');
 *
 * // Otorgar consentimiento
 * fbqConsent('grant');
 * ```
 */
export function fbqConsent(action: 'grant' | 'revoke'): void {
  safeFbq('consent', action);
}

/**
 * Exportar funciones adicionales para uso avanzado
 */
export const metaPixel = {
  track: fbqTrack,
  trackCustom: fbqTrackCustom,
  pageView: fbqPageView,
  viewContent: fbqViewContent,
  search: fbqSearch,
  addToCart: fbqAddToCart,
  addToWishlist: fbqAddToWishlist,
  initiateCheckout: fbqInitiateCheckout,
  addPaymentInfo: fbqAddPaymentInfo,
  purchase: fbqPurchase,
  lead: fbqLead,
  completeRegistration: fbqCompleteRegistration,
  contact: fbqContact,
  subscribe: fbqSubscribe,
  consent: fbqConsent,
  isAvailable: isMetaPixelAvailable,
};
