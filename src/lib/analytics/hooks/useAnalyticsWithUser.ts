'use client';

import { useCallback, useMemo } from 'react';
import { processAnalyticsEvent } from '../controller';
import type { AnalyticsUserData } from '../controller';
import type {
  DlViewItem,
  DlAddToCart,
  DlPurchase,
  DlSearch,
  DlCheckoutProgress,
  DlCategoryClick,
} from '../types';
import { useAuthContext } from '@/features/auth/context';

/**
 * Hook personalizado para enviar eventos de analytics con datos de usuario
 *
 * Automáticamente incluye email y teléfono del usuario autenticado
 * para mejorar las conversiones mediante Enhanced Conversions (GA4) y Advanced Matching (Meta/TikTok)
 *
 * @example
 * ```typescript
 * const { trackViewItem, trackAddToCart } = useAnalyticsWithUser();
 *
 * // En tu componente de producto
 * useEffect(() => {
 *   trackViewItem({
 *     item_id: product.sku,
 *     item_name: product.name,
 *     price: product.price,
 *   });
 * }, [product.sku]);
 * ```
 */
export function useAnalyticsWithUser() {
  const { user, isAuthenticated } = useAuthContext();

  // Preparar datos de usuario una vez
  const userData: AnalyticsUserData | undefined = useMemo(() => {
    if (!isAuthenticated || !user) return undefined;

    return {
      id: user.id,
      email: user.email,
      phone: user.telefono,
      firstName: user.nombre,
      lastName: user.apellido,
      address: user.defaultAddress ? {
        city: user.defaultAddress.ciudad,
        state: user.defaultAddress.departamento,
        country: 'CO', // Colombia
      } : undefined,
    };
  }, [isAuthenticated, user]);

  /**
   * Track cuando un usuario ve un producto
   */
  const trackViewItem = useCallback(
    async (item: {
      item_id: string;
      item_name: string;
      item_brand?: string;
      item_category?: string;
      price: number;
      currency?: string;
    }) => {
      const event: DlViewItem = {
        event: 'view_item',
        ts: Date.now(),
        ecommerce: {
          items: [
            {
              ...item,
              item_brand: item.item_brand || 'Samsung',
              currency: item.currency || 'COP',
            },
          ],
        },
      };

      await processAnalyticsEvent(event, userData);
    },
    [userData]
  );

  /**
   * Track cuando un usuario añade un producto al carrito
   */
  const trackAddToCart = useCallback(
    async (item: {
      item_id: string;
      item_name: string;
      item_brand?: string;
      price: number;
      quantity: number;
      currency?: string;
    }) => {
      const totalValue = item.price * item.quantity;
      const event: DlAddToCart = {
        event: 'add_to_cart',
        ts: Date.now(),
        ecommerce: {
          items: [
            {
              ...item,
              item_brand: item.item_brand || 'Samsung',
              currency: item.currency || 'COP',
            },
          ],
          value: totalValue,
          currency: item.currency || 'COP',
        },
      };

      await processAnalyticsEvent(event, userData);
    },
    [userData]
  );

  /**
   * Track cuando un usuario hace una búsqueda
   */
  const trackSearch = useCallback(
    async (searchTerm: string, resultsCount?: number) => {
      const event: DlSearch = {
        event: 'search',
        ts: Date.now(),
        search_term: searchTerm,
        results: resultsCount,
      };

      await processAnalyticsEvent(event, userData);
    },
    [userData]
  );

  /**
   * Track cuando un usuario inicia el checkout
   */
  const trackBeginCheckout = useCallback(
    async (
      items: Array<{
        item_id: string;
        item_name: string;
        price: number;
        quantity: number;
      }>,
      totalValue: number
    ) => {
      const event: DlCheckoutProgress = {
        event: 'begin_checkout',
        ts: Date.now(),
        step: 1,
        ecommerce: {
          items: items.map((item) => ({
            ...item,
            currency: 'COP',
          })),
          value: totalValue,
          currency: 'COP',
        },
      };

      await processAnalyticsEvent(event, userData);
    },
    [userData]
  );

  /**
   * Track cuando un usuario añade información de pago
   */
  const trackAddPaymentInfo = useCallback(
    async (
      items: Array<{
        item_id: string;
        item_name: string;
        price: number;
        quantity: number;
      }>,
      totalValue: number
    ) => {
      const event: DlCheckoutProgress = {
        event: 'add_payment_info',
        ts: Date.now(),
        step: 2,
        ecommerce: {
          items: items.map((item) => ({
            ...item,
            currency: 'COP',
          })),
          value: totalValue,
          currency: 'COP',
        },
      };

      await processAnalyticsEvent(event, userData);
    },
    [userData]
  );

  /**
   * Track cuando un usuario completa una compra
   */
  const trackPurchase = useCallback(
    async (
      transactionId: string,
      items: Array<{
        item_id: string;
        item_name: string;
        item_brand?: string;
        price: number;
        quantity: number;
      }>,
      totalValue: number,
      couponCode?: string
    ) => {
      const event: DlPurchase = {
        event: 'purchase',
        ts: Date.now(),
        ecommerce: {
          transaction_id: transactionId,
          value: totalValue,
          currency: 'COP',
          coupon: couponCode,
          items: items.map((item) => ({
            ...item,
            item_brand: item.item_brand || 'Samsung',
            currency: 'COP',
          })),
        },
      };

      await processAnalyticsEvent(event, userData);
    },
    [userData]
  );

  /**
   * Track cuando un usuario hace clic en una categoría
   */
  const trackCategoryClick = useCallback(
    async (categoryId: string, categoryName: string, position?: number) => {
      const event: DlCategoryClick = {
        event: 'category_click',
        ts: Date.now(),
        nav: {
          category_id: categoryId,
          category_name: categoryName,
          position,
        },
      };

      await processAnalyticsEvent(event, userData);
    },
    [userData]
  );

  return {
    trackViewItem,
    trackAddToCart,
    trackSearch,
    trackBeginCheckout,
    trackAddPaymentInfo,
    trackPurchase,
    trackCategoryClick,
    userData, // Exportar para uso avanzado si es necesario
    isAuthenticated,
  };
}
