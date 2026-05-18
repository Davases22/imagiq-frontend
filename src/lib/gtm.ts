/**
 * Utilidades para Google Tag Manager
 *
 * Helper functions para enviar eventos y datos a GTM sin exponer
 * ningún Container ID en el frontend.
 */

import type { DataLayerObject } from './analytics/types/dataLayer';

/**
 * Push de datos al dataLayer de GTM
 *
 * @param data - Objeto con los datos a enviar
 * @example
 * ```ts
 * gtmPush({ event: 'page_view', page: '/products' });
 * ```
 */
export function gtmPush(data: DataLayerObject): void {
  try {
    if (typeof window !== 'undefined') {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(data);
    }
  } catch (error) {
    console.debug('GTM push error:', error);
  }
}

/**
 * Envía un evento a Google Tag Manager
 *
 * @param eventName - Nombre del evento (ej: 'add_to_cart', 'purchase', etc.)
 * @param eventData - Datos adicionales del evento (opcional)
 * @example
 * ```ts
 * gtmEvent('add_to_cart', {
 *   item_id: '12345',
 *   item_name: 'Product Name',
 *   price: 99.99,
 *   quantity: 1
 * });
 * ```
 */
export function gtmEvent(eventName: string, eventData?: Record<string, unknown>): void {
  gtmPush({
    event: eventName,
    ...eventData,
  });
}

/**
 * Envía un evento de página vista a GTM
 *
 * @param pagePath - Ruta de la página
 * @param pageTitle - Título de la página (opcional)
 * @example
 * ```ts
 * gtmPageView('/products/123', 'Product Name');
 * ```
 */
export function gtmPageView(pagePath: string, pageTitle?: string): void {
  gtmPush({
    event: 'page_view',
    page_path: pagePath,
    page_title: pageTitle || document.title,
  });
}

/**
 * Envía un evento de conversión/compra a GTM (Enhanced Ecommerce)
 *
 * @param transactionData - Datos de la transacción
 * @example
 * ```ts
 * gtmPurchase({
 *   transaction_id: 'T12345',
 *   value: 299.99,
 *   currency: 'USD',
 *   tax: 24.99,
 *   shipping: 10.00,
 *   items: [
 *     {
 *       item_id: 'SKU123',
 *       item_name: 'Product Name',
 *       price: 99.99,
 *       quantity: 3
 *     }
 *   ]
 * });
 * ```
 */
export function gtmPurchase(transactionData: {
  transaction_id: string;
  value: number;
  currency?: string;
  tax?: number;
  shipping?: number;
  items: Array<{
    item_id: string;
    item_name: string;
    price: number;
    quantity: number;
    item_category?: string;
    item_brand?: string;
  }>;
}): void {
  gtmPush({
    event: 'purchase',
    ecommerce: {
      currency: transactionData.currency || 'COP',
      transaction_id: transactionData.transaction_id,
      value: transactionData.value,
      tax: transactionData.tax || 0,
      shipping: transactionData.shipping || 0,
      items: transactionData.items,
    },
  });
}

/**
 * Envía un evento de agregar al carrito (Enhanced Ecommerce)
 *
 * @param item - Datos del producto
 * @example
 * ```ts
 * gtmAddToCart({
 *   item_id: 'SKU123',
 *   item_name: 'Product Name',
 *   price: 99.99,
 *   quantity: 1,
 *   item_category: 'Electronics'
 * });
 * ```
 */
export function gtmAddToCart(item: {
  item_id: string;
  item_name: string;
  price: number;
  quantity: number;
  item_category?: string;
  item_brand?: string;
}): void {
  gtmPush({
    event: 'add_to_cart',
    ecommerce: {
      items: [item],
    },
  });
}

/**
 * Envía un evento de remover del carrito (Enhanced Ecommerce)
 *
 * @param item - Datos del producto
 */
export function gtmRemoveFromCart(item: {
  item_id: string;
  item_name: string;
  price: number;
  quantity: number;
}): void {
  gtmPush({
    event: 'remove_from_cart',
    ecommerce: {
      items: [item],
    },
  });
}

/**
 * Envía un evento de ver producto (Enhanced Ecommerce)
 *
 * @param item - Datos del producto
 * @example
 * ```ts
 * gtmViewItem({
 *   item_id: 'SKU123',
 *   item_name: 'Product Name',
 *   price: 99.99,
 *   item_category: 'Electronics'
 * });
 * ```
 */
export function gtmViewItem(item: {
  item_id: string;
  item_name: string;
  price: number;
  item_category?: string;
  item_brand?: string;
}): void {
  gtmPush({
    event: 'view_item',
    ecommerce: {
      items: [item],
    },
  });
}

/**
 * Envía un evento de inicio de checkout (Enhanced Ecommerce)
 *
 * @param checkoutData - Datos del checkout
 * @example
 * ```ts
 * gtmBeginCheckout({
 *   value: 299.99,
 *   currency: 'USD',
 *   items: [...]
 * });
 * ```
 */
export function gtmBeginCheckout(checkoutData: {
  value: number;
  currency?: string;
  items: Array<{
    item_id: string;
    item_name: string;
    price: number;
    quantity: number;
  }>;
}): void {
  gtmPush({
    event: 'begin_checkout',
    ecommerce: {
      currency: checkoutData.currency || 'COP',
      value: checkoutData.value,
      items: checkoutData.items,
    },
  });
}

/**
 * Identifica al usuario en GTM (para remarketing y analytics)
 * IMPORTANTE: Solo usar IDs hasheados o anónimos
 *
 * @param userId - ID hasheado o anónimo del usuario
 * @example
 * ```ts
 * gtmIdentifyUser('user_abc123_hashed');
 * ```
 */
export function gtmIdentifyUser(userId: string): void {
  gtmPush({
    user_id: userId,
  });
}

/**
 * Gestión de consentimiento para GTM (GDPR/CCPA)
 *
 * @param consent - Objeto con el estado del consentimiento
 * @example
 * ```ts
 * gtmConsent({
 *   analytics: true,
 *   marketing: false,
 *   preferences: true
 * });
 * ```
 */
export function gtmConsent(consent: {
  analytics?: boolean;
  marketing?: boolean;
  preferences?: boolean;
}): void {
  gtmPush({
    event: 'consent_update',
    consent: {
      analytics_storage: consent.analytics ? 'granted' : 'denied',
      ad_storage: consent.marketing ? 'granted' : 'denied',
      ad_user_data: consent.marketing ? 'granted' : 'denied',
      ad_personalization: consent.marketing ? 'granted' : 'denied',
      functionality_storage: consent.preferences ? 'granted' : 'denied',
      personalization_storage: consent.preferences ? 'granted' : 'denied',
    },
  });
}
