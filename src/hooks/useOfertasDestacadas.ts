/**
 * Hook para obtener las ofertas destacadas desde el dashboard
 * Consume el endpoint /api/multimedia/ofertas-destacadas/activas
 */

import { useState, useEffect } from "react";

export interface OfertaDestacada {
  uuid: string;
  producto_id: string;
  orden: number;
  activo: boolean;
  // Estos campos se rellenan desde el backend cuando se consultan los productos
  producto_nombre?: string;
  producto_imagen?: string | null;
  link_url?: string | null;
}

interface UseOfertasDestacadasReturn {
  productos: OfertaDestacada[];
  loading: boolean;
  error: string | null;
}

const API_BASE_URL = "";

export function useOfertasDestacadas(): UseOfertasDestacadasReturn {
  const [productos, setProductos] = useState<OfertaDestacada[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchOfertasDestacadas = async () => {
      try {
        setLoading(true);
        setError(null);

        // Obtener ofertas activas
        const ofertasResponse = await fetch(
          `${API_BASE_URL}/api/multimedia/ofertas-destacadas/activas`,
          {
            headers: {
              "Content-Type": "application/json",
              "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
            },
          }
        );

        if (!isMounted) return;

        if (!ofertasResponse.ok) {
          throw new Error("Error al cargar ofertas destacadas");
        }

        const ofertasData = await ofertasResponse.json();

        // El endpoint devuelve un array directo, no envuelto en {success, data}
        const ofertas = Array.isArray(ofertasData)
          ? ofertasData as OfertaDestacada[]
          : [];

        console.log('[Ofertas] Ofertas recibidas:', ofertas);

        if (ofertas.length === 0) {
          setProductos([]);
          setLoading(false);
          return;
        }

        // Enriquecer con datos de productos
        const productosEnriquecidos = await Promise.all(
          ofertas.map(async (oferta) => {
            try {
              console.log(`[Ofertas] Enriqueciendo oferta con producto_id: ${oferta.producto_id}`);
              const productResponse = await fetch(
                `${API_BASE_URL}/api/products/filtered?codigoMarket=${oferta.producto_id}`,
                {
                  headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
                  },
                }
              );

              if (productResponse.ok) {
                const productData = await productResponse.json();
                console.log(`[Ofertas] Producto ${oferta.producto_id} data:`, productData);

                if (productData.products && productData.products.length > 0) {
                  const product = productData.products[0];

                  // Obtener imagen: priorizar imagePreviewUrl, luego urlImagenes
                  const imagen = product.imagePreviewUrl?.[0] || product.urlImagenes?.[0] || null;

                  // Obtener nombre: priorizar modelo, luego nombre, luego titulo
                  const nombre = product.modelo || product.nombre || product.titulo || 'Producto';

                  const enriquecido = {
                    ...oferta,
                    producto_nombre: nombre,
                    producto_imagen: imagen,
                    link_url: `/productos/${oferta.producto_id}`,
                  };
                  console.log(`[Ofertas] Producto ${oferta.producto_id} enriquecido:`, enriquecido);
                  return enriquecido;
                } else {
                  console.warn(`[Ofertas] Producto ${oferta.producto_id} no tiene products en la respuesta`);
                }
              } else {
                console.error(`[Ofertas] Error HTTP ${productResponse.status} para producto ${oferta.producto_id}`);
              }
            } catch (err) {
              console.error(
                `Error cargando producto ${oferta.producto_id}:`,
                err
              );
            }

            // Si el producto no existe o hay error, retornar null para filtrarlo después
            return null;
          })
        );

        // Filtrar productos que no existen (null) y ordenar por orden
        const productosValidos = productosEnriquecidos
          .filter((p): p is NonNullable<typeof p> => p !== null)
          .sort((a, b) => (a?.orden ?? 0) - (b?.orden ?? 0));

        if (isMounted) {
          setProductos(productosValidos);
        }
      } catch (err) {
        if (!isMounted) return;
        console.error("Error fetching ofertas destacadas:", err);
        setError("Error al cargar ofertas destacadas");
        setProductos([]);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchOfertasDestacadas();

    return () => {
      isMounted = false;
    };
  }, []);

  return { productos, loading, error };
}
