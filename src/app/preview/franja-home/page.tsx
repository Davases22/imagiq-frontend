/**
 * Vista previa de una franja de la home, para embeber desde el dashboard.
 *
 * Renderiza los ProductCard REALES: es el mismo componente, con los mismos
 * datos, que ve el comprador. Una réplica en el dashboard se desincronizaría
 * en cuanto la tarjeta de la web cambiara, y justamente lo que se quiere
 * comprobar aquí es cómo va a quedar de verdad.
 *
 * Se consume como <iframe src="/preview/franja-home?codigos=A,B,C,D">.
 */

import type { Metadata } from "next";
import { getProductsByCodigos } from "@/lib/api-server";
import { mapApiProductsToFrontend } from "@/lib/mappers/product-mapper";
import PreviewFranjaClient from "./PreviewFranjaClient";

// Es una herramienta interna: no tiene por qué aparecer en buscadores.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PreviewFranjaHome({
  searchParams,
}: {
  searchParams: Promise<{ codigos?: string }>;
}) {
  const { codigos = "" } = await searchParams;

  const lista = codigos
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 8);

  const bundles = await getProductsByCodigos(lista);
  const productos = mapApiProductsToFrontend(bundles);

  // Se respeta el orden pedido: getProductsByCodigos ya lo conserva, pero el
  // mapper podría agrupar, así que se reordena por si acaso.
  const porCodigo = new Map(
    productos.map((p) => [p.apiProduct?.codigoMarketBase ?? "", p])
  );
  const ordenados = lista
    .map((c) => porCodigo.get(c))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  if (ordenados.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center px-4 text-center text-sm text-gray-500">
        {lista.length === 0
          ? "Sin productos fijados en esta franja."
          : "Ninguno de estos productos está en el catálogo."}
      </div>
    );
  }

  return <PreviewFranjaClient productos={ordenados} />;
}
