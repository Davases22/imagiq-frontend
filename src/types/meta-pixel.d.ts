/**
 * TypeScript definitions for Meta Pixel (Facebook Pixel)
 * @see https://developers.facebook.com/docs/meta-pixel/reference
 */

declare global {
  interface Window {
    /**
     * Meta Pixel (Facebook Pixel) global function
     */
    // NOTE: This shape must stay structurally identical to the Window.fbq
    // declaration in src/lib/analytics/types/dataLayer.ts. TypeScript merges
    // both global augmentations; divergent shapes break emit.meta.ts.
    fbq?: {
      (command: 'track', eventName: string, parameters?: Record<string, unknown>, options?: Record<string, unknown>): void;
      (command: 'trackCustom', eventName: string, parameters?: Record<string, unknown>, options?: Record<string, unknown>): void;
      (command: 'init', pixelId: string, options?: Record<string, unknown>): void;
      (command: 'consent', action: 'grant' | 'revoke'): void;
      callMethod?: (...args: unknown[]) => void;
      queue?: unknown[];
      loaded?: boolean;
      version?: string;
      push?: (...args: unknown[]) => void;
    };

    /**
     * Internal Meta Pixel reference
     */
    _fbq?: Window['fbq'];
  }
}

/**
 * Meta Pixel Standard Events
 * @see https://developers.facebook.com/docs/meta-pixel/reference#standard-events
 */
export type MetaPixelStandardEvent =
  | 'AddPaymentInfo'
  | 'AddToCart'
  | 'AddToWishlist'
  | 'CompleteRegistration'
  | 'Contact'
  | 'CustomizeProduct'
  | 'Donate'
  | 'FindLocation'
  | 'InitiateCheckout'
  | 'Lead'
  | 'PageView'
  | 'Purchase'
  | 'Schedule'
  | 'Search'
  | 'StartTrial'
  | 'SubmitApplication'
  | 'Subscribe'
  | 'ViewContent';

/**
 * Meta Pixel Event Parameters
 */
export interface MetaPixelEventParams {
  content_category?: string;
  content_ids?: string[];
  content_name?: string;
  content_type?: 'product' | 'product_group';
  contents?: Array<{
    id: string;
    quantity: number;
    item_price?: number;
  }>;
  currency?: string;
  num_items?: number;
  predicted_ltv?: number;
  search_string?: string;
  status?: string;
  value?: number;
  // Allow custom parameters for trackCustom events
  [key: string]: string | number | boolean | undefined | unknown[] | Record<string, unknown>;
}

/**
 * Meta Pixel Purchase Event Parameters
 */
export interface MetaPixelPurchaseParams extends MetaPixelEventParams {
  content_ids: string[];
  value: number;
  currency?: string;
  num_items?: number;
}

/**
 * Meta Pixel ViewContent Event Parameters
 */
export interface MetaPixelViewContentParams {
  content_name: string;
  content_ids: string[];
  content_type?: 'product' | 'product_group';
  value?: number;
  currency?: string;
}

/**
 * Meta Pixel AddToCart Event Parameters
 */
export interface MetaPixelAddToCartParams {
  content_name: string;
  content_ids: string[];
  content_type?: 'product' | 'product_group';
  value: number;
  currency?: string;
}

export {};
