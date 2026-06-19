/**
 * Helpers para procesamiento de eventos
 *
 * Funciones auxiliares para generar event_id y manejar abandono
 */

import type { DlAny } from '../types';
import { generateEventId } from '../utils';
import {
  markCartIntent,
  markCheckoutIntent,
  clearAbandonIntents,
} from '../abandon';

/**
 * Genera event_id para un evento del dataLayer
 */
export async function generateEventIdForEvent(event: DlAny): Promise<string> {
  const { event: eventName, ts } = event;

  // Extraer items/SKUs según el tipo de evento
  let items: string[] = [];
  let transactionId: string | undefined;
  let value: number | undefined;

  if ('ecommerce' in event) {
    if ('items' in event.ecommerce) {
      items = event.ecommerce.items.map((i) => i.item_id);
    }

    if ('transaction_id' in event.ecommerce) {
      transactionId = event.ecommerce.transaction_id;
    }

    if ('value' in event.ecommerce) {
      value = event.ecommerce.value;
    }
  }

  // Purchase: event_id DETERMINISTA por orden (no depende de ts/value), idéntico
  // al que dispara el servidor en Meta CAPI (`purchase_${orderId}` en payments-ms)
  // y a `$insert_id` de PostHog. Sin esto, el píxel del browser usaba un hash con
  // Date.now() y nunca deduplicaba contra el evento server-side → Purchase doble.
  if (eventName === 'purchase' && transactionId) {
    return `purchase_${transactionId}`;
  }

  return generateEventId(eventName, ts, items, transactionId, value);
}

/**
 * Maneja el tracking de abandono según el tipo de evento
 */
export function handleAbandonTracking(event: DlAny): void {
  switch (event.event) {
    case 'add_to_cart':
      // Registrar intención de carrito
      markCartIntent(
        event.ecommerce.items.map((i) => ({ item_id: i.item_id, quantity: i.quantity || 1 })),
        event.ecommerce.value,
        event.ecommerce.currency
      );
      break;

    case 'begin_checkout':
    case 'add_payment_info':
      // Registrar intención de checkout
      markCheckoutIntent(
        event.event,
        event.ecommerce.items.map((i) => ({ item_id: i.item_id, quantity: i.quantity || 1 })),
        event.ecommerce.value,
        event.ecommerce.currency
      );
      break;

    case 'purchase':
      // Limpiar intenciones al completar compra
      clearAbandonIntents();
      break;
  }
}
