/**
 * Type definitions for promotional banners
 */

export interface BannerConfig {
  id: string;
  title?: string;
  subtitle?: string;
  description?: string;
  imageUrl: string;
  imageUrlMobile?: string;
  buttonText?: string;
  buttonLink?: string;
  backgroundColor?: string;
  textColor?: string;
  enabled: boolean;
  /**
   * Natural dimensions of the uploaded banner. Used to reserve aspect-ratio
   * space (avoids CLS) and let the image render at its real proportion
   * instead of a fixed height crop.
   */
  imageWidth?: number;
  imageHeight?: number;
  imageWidthMobile?: number;
  imageHeightMobile?: number;
  /** @deprecated Use natural image dimensions; kept for backwards compatibility. */
  height?: string;
  /** @deprecated Use natural image dimensions; kept for backwards compatibility. */
  heightMobile?: string;
}

export type BannerPosition = 'above-products' | 'below-title' | 'below-products';
