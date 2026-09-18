/**
 * Productos destacados de un Live, listos para el ProductCard del catálogo.
 * Solo servidor (usa api-server).
 */

import { getProductsByCodigoMarketBase } from "@/lib/api-server";
import { mapApiProductsToFrontend } from "@/lib/mappers/product-mapper";
import type { ProductCardProps } from "@/app/productos/components/ProductCard";
import type { LivestreamConfig } from "@/services/multimedia-pages.service";

export const MAX_LIVESTREAM_PRODUCTS = 12;

export async function getLivestreamProducts(
  config: LivestreamConfig | null | undefined
): Promise<ProductCardProps[]> {
  const ids = (config?.featured_products ?? [])
    .map((p) => p.id)
    .slice(0, MAX_LIVESTREAM_PRODUCTS);
  if (ids.length === 0) return [];

  try {
    const products = await getProductsByCodigoMarketBase(ids);
    return mapApiProductsToFrontend(products);
  } catch (error) {
    console.error("Error fetching livestream products:", error);
    return [];
  }
}
