import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy cacheado del catálogo: /api/products/filtered?codigoMarket=X
 *
 * Esta llamada es el gate de TODA la PDP (view/viewpremium/multimedia): sin
 * ella no hay MPN y Flixmedia no puede arrancar. Hoy cada navegador la paga
 * completa contra Railway (~0.3-1.5s). Este proxy la cachea con el Data Cache
 * de Next (revalidate 30s) compartido entre todos los usuarios: el primer
 * visitante de un producto la paga una vez, el resto la recibe en ~20-80ms.
 *
 * El catálogo es público (las páginas de listado lo consultan sin login). El
 * backend refleja los cambios de Novasoft en ~1 min, así que esta capa se
 * mantiene corta (30s + 30s stale). El consumidor (useProduct) además refresca
 * en background contra el endpoint directo, así que un cambio de precio/stock
 * se corrige solo segundos después del primer render.
 *
 * GET /api/pcache/product?codigoMarket=<id>
 */

// Corto a propósito: el backend refleja cambios de Novasoft en ~1 min
// (CatalogSyncService); una capa larga aquí sumaría minutos de precio viejo.
const PRODUCT_REVALIDATE_SECONDS = 30;

function backendUrl(): string {
  return (
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3001"
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const codigoMarket = searchParams.get("codigoMarket");

  if (!codigoMarket || codigoMarket.length > 100) {
    return NextResponse.json(
      { success: false, error: "missing_or_invalid_codigoMarket" },
      { status: 400 }
    );
  }

  try {
    const apiKey = process.env.NEXT_PUBLIC_API_KEY;
    const url = `${backendUrl()}/api/products/filtered?codigoMarket=${encodeURIComponent(codigoMarket)}`;
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(apiKey && { "X-API-Key": apiKey }),
      },
      next: { revalidate: PRODUCT_REVALIDATE_SECONDS },
    });

    if (!response.ok) {
      // No cachear errores del backend: el cliente hace fallback al endpoint directo
      return NextResponse.json(
        { success: false, error: "upstream_error" },
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control":
          "public, max-age=0, s-maxage=30, stale-while-revalidate=30",
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "upstream_unreachable" },
      { status: 502 }
    );
  }
}
