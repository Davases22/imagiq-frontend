/**
 * Mapeador de eventos a formato Meta Pixel (Facebook Pixel)
 *
 * Transforma eventos del dataLayer al formato esperado por Meta Pixel.
 *
 * **Referencia**: https://developers.facebook.com/docs/meta-pixel/reference
 */

import type { DlAny, DlItem } from '../types';

/** Evento Meta Pixel */
export interface MetaEvent {
  name: 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'AddPaymentInfo' | 'Purchase' | 'Search' | 'CustomEvent';
  data: {
    content_ids?: string[];
    content_type?: 'product' | 'product_group';
    content_name?: string;
    contents?: Array<{ id: string; quantity: number; item_price?: number }>;
    value?: number;
    currency?: string;
    search_string?: string;
    num_items?: number;
    event_name?: string;
    [key: string]: unknown;
  };
}

/**
 * Transforma un evento del dataLayer a formato Meta Pixel
 *
 * @param event - Evento del dataLayer
 * @param eventId - Event ID para deduplicación (generado con utils/id.ts)
 * @param user - Datos de usuario para Advanced Matching (opcional)
 * @returns Evento formateado para Meta Pixel, o `null` si el evento debe
 *   OMITIRSE (p.ej. Purchase con value no finito o <= 0 — un Purchase sin
 *   precio válido dispara los diagnósticos "invalid prices" de Meta)
 *
 * @example
 * ```typescript
 * const dlEvent: DlViewItem = {
 *   event: 'view_item',
 *   ts: Date.now(),
 *   ecommerce: { items: [{ item_id: 'SKU123', item_name: 'Product', price: 100 }] }
 * };
 *
 * const eventId = await generateEventId('view_item', dlEvent.ts, ['SKU123']);
 * const metaEvent = toMetaEvent(dlEvent, eventId);
 * // { name: 'ViewContent', data: { content_ids: ['SKU123'], ... } }
 * ```
 */
export function toMetaEvent(
  event: DlAny,
  eventId: string,
  user?: { email?: string; phone?: string }
): MetaEvent | null {
  switch (event.event) {
    case 'view_item':
      return {
        name: 'ViewContent',
        data: {
          content_ids: event.ecommerce.items.map((i) => i.item_id),
          content_type: 'product',
          content_name: event.ecommerce.items[0]?.item_name,
          contents: mapContents(event.ecommerce.items),
          // value del producto visto (unidades COP) para optimización por valor
          value: event.ecommerce.items[0]?.price,
          currency: 'COP',
        },
      };

    case 'add_to_cart':
      return {
        name: 'AddToCart',
        data: {
          content_ids: event.ecommerce.items.map((i) => i.item_id),
          content_type: 'product',
          contents: mapContents(event.ecommerce.items),
          value: event.ecommerce.value,
          currency: event.ecommerce.currency || 'COP',
          num_items: event.ecommerce.items.reduce((sum, i) => sum + (i.quantity || 1), 0),
        },
      };

    case 'begin_checkout':
      return {
        name: 'InitiateCheckout',
        data: {
          content_ids: event.ecommerce.items.map((i) => i.item_id),
          content_type: 'product',
          contents: mapContents(event.ecommerce.items),
          value: event.ecommerce.value,
          currency: event.ecommerce.currency || 'COP',
          num_items: event.ecommerce.items.reduce((sum, i) => sum + (i.quantity || 1), 0),
        },
      };

    case 'add_payment_info':
      return {
        name: 'AddPaymentInfo',
        data: {
          content_ids: event.ecommerce.items.map((i) => i.item_id),
          content_type: 'product',
          contents: mapContents(event.ecommerce.items),
          value: event.ecommerce.value,
          currency: event.ecommerce.currency || 'COP',
        },
      };

    case 'purchase': {
      // Hardening del value: coercionar a número y validar. Un Purchase con
      // value no finito (string de pg-numeric, NaN) o <= 0 se OMITE — es
      // exactamente lo que Meta marca como "invalid prices" / "all same
      // price"; el CAPI server-side (payments-ms) carga la orden con el
      // valor real de ordenes.total_amount.
      const purchaseValue = Number(event.ecommerce.value);
      if (!Number.isFinite(purchaseValue) || purchaseValue <= 0) {
        return null;
      }
      return {
        name: 'Purchase',
        data: {
          content_ids: event.ecommerce.items.map((i) => i.item_id),
          content_type: 'product',
          contents: mapContents(event.ecommerce.items),
          value: purchaseValue,
          currency: event.ecommerce.currency || 'COP',
          num_items: event.ecommerce.items.reduce((sum, i) => sum + (i.quantity || 1), 0),
        },
      };
    }

    case 'search':
      return {
        name: 'Search',
        data: {
          search_string: event.search_term,
          content_type: 'product',
        },
      };

    case 'category_click':
      // Category Click va como evento custom
      return {
        name: 'CustomEvent',
        data: {
          event_name: 'CategoryClick',
          category_id: event.nav.category_id,
          category_name: event.nav.category_name,
          position: event.nav.position,
        },
      };

    default:
      return {
        name: 'CustomEvent',
        data: {
          event_name: 'UnknownEvent',
          event_data: event,
        },
      };
  }
}

/**
 * Mapea items del dataLayer a formato Meta Pixel `contents`
 *
 * @param items - Items del ecommerce
 * @returns Contents en formato Meta Pixel
 */
function mapContents(items: DlItem[]): Array<{ id: string; quantity: number; item_price?: number }> {
  return items.map((item) => ({
    id: item.item_id,
    quantity: item.quantity || 1,
    item_price: item.price,
  }));
}
