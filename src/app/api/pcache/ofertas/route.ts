import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy cacheado de la query de OFERTAS (/api/products/v2/filtered?conDescuento=true...).
 *
 * Esa query es la más pesada del sitio: filtra por descuento sobre TODO el
 * catálogo (comparación precioNormal vs precioEccommerce sin índice), sin
 * acotar por categoría, y trae 50 items. Medido: ~6s en frío contra Railway
 * vs ~0.8s de una categoría normal. Este proxy la cachea con el Data Cache de
 * Next (revalidate 300s) compartido entre TODOS los usuarios: el primer
 * visitante de una sección paga los ~6s una vez, el resto la recibe en ~ms.
 *
 * Repasa TODOS los query params al backend (conDescuento, seccion, sortBy,
 * limit, page, etc.) para que la cache-key sea por combinación exacta. El
 * consumidor (OfertasSection→useProducts) hace fallback al endpoint directo
 * si el proxy falla, así nunca rompe.
 *
 * GET /api/pcache/ofertas?<mismos params que /api/products/v2/filtered>
 */

const OFERTAS_REVALIDATE_SECONDS = 300; // 5 min: precio/stock de ofertas cambia lento

function backendUrl(): string {
  return (
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3001"
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Seguridad básica: exigir el filtro de descuento (este proxy es solo ofertas)
  if (searchParams.get("conDescuento") !== "true") {
    return NextResponse.json(
      { success: false, error: "not_an_offers_query" },
      { status: 400 }
    );
  }

  try {
    const apiKey = process.env.NEXT_PUBLIC_API_KEY;
    // Cache-key estable: ordenar los params alfabéticamente para que combinaciones
    // equivalentes con distinto orden compartan la misma entrada del Data Cache.
    // (TODO seguridad: allowlist estricta de params para evitar amplificación de
    // cache con claves basura — requiere inventario exacto de params de ofertas.)
    const sorted = new URLSearchParams(
      [...searchParams.entries()].sort(([a], [b]) => a.localeCompare(b))
    );
    const url = `${backendUrl()}/api/products/v2/filtered?${sorted.toString()}`;
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(apiKey && { "X-API-Key": apiKey }),
      },
      next: { revalidate: OFERTAS_REVALIDATE_SECONDS },
    });

    if (!response.ok) {
      // No cachear errores: el cliente cae al endpoint directo
      return NextResponse.json(
        { success: false, error: "upstream_error" },
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control":
          "public, max-age=120, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "upstream_unreachable" },
      { status: 502 }
    );
  }
}
