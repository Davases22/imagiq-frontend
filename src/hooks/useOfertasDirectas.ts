/**
 * Hook para obtener las ofertas destacadas desde el endpoint directo
 * Consume el endpoint /api/products/ofertas-destacadas/direct
 *
 * CACHE PERSISTENTE: Los datos se mantienen en memoria entre montajes del componente
 * para evitar mostrar el skeleton loader cuando se reabre el dropdown
 */

import { useState, useEffect } from "react";

export interface OfertaDirecta {
    uuid: string;
    codigo_market: string;
    nombre: string;
    orden: number;
    activo: boolean;
    created_at: string;
    updated_at: string;
    categoria_id: string;
    categoria: {
        uuid: string;
        nombre: string;
        nombreVisible: string;
        descripcion: string;
        imagen: string;
        activo: boolean;
        orden: number;
        createdAt: string;
        updatedAt: string;
    };
    producto: {
        codigoMarket: string;
        nombreMarket: string;
        imagen: string;
        categoria: string;
        menu: string;
        sku: string;
    };
}

interface UseOfertasDirectasReturn {
    ofertas: OfertaDirecta[];
    loading: boolean;
    error: string | null;
}

const API_BASE_URL = "";

// Cache persistente fuera del componente para mantener datos entre montajes
let cachedOfertas: OfertaDirecta[] | null = null;
let isFetching = false;
let fetchPromise: Promise<void> | null = null;
let imagesPrefetched = false;

// Prefetch ofertas images so they're in browser cache before dropdown opens
function prefetchOfertasImages(ofertas: OfertaDirecta[]): void {
  if (imagesPrefetched || typeof window === 'undefined') return;
  imagesPrefetched = true;

  ofertas.forEach((oferta) => {
    const imageUrl = oferta.producto?.imagen;
    if (!imageUrl) return;

    // Prefetch the Next.js optimized URL (what <Image fill> will request)
    const optimizedImg = new window.Image();
    optimizedImg.src = `/_next/image?url=${encodeURIComponent(imageUrl)}&w=256&q=75`;
    if ('decode' in optimizedImg) {
      optimizedImg.decode().catch(() => {});
    }
  });
}

export function useOfertasDirectas(): UseOfertasDirectasReturn {
    const [ofertas, setOfertas] = useState<OfertaDirecta[]>(cachedOfertas || []);
    const [loading, setLoading] = useState(!cachedOfertas);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const fetchOfertasDirectas = async () => {
            if (cachedOfertas) {
                return;
            }

            if (isFetching && fetchPromise) {
                await fetchPromise;
                if (isMounted && cachedOfertas) {
                    setOfertas(cachedOfertas);
                    setLoading(false);
                }
                return;
            }

            try {
                isFetching = true;
                setLoading(true);
                setError(null);

                fetchPromise = (async () => {
                    const url = `${API_BASE_URL}/api/products/ofertas-destacadas/direct`;

                    const response = await fetch(url, {
                        headers: {
                            "Content-Type": "application/json",
                            "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
                        },
                    });

                    if (!response.ok) {
                        throw new Error("Error al cargar ofertas destacadas");
                    }

                    const data = await response.json();

                    let ofertasData: OfertaDirecta[] = [];
                    if (data.success && data.data) {
                        if (Array.isArray(data.data)) {
                            ofertasData = data.data as OfertaDirecta[];
                        } else if (typeof data.data === 'object') {
                            ofertasData = Object.values(data.data) as OfertaDirecta[];
                        }
                    }

                    const ofertasActivas = ofertasData
                        .filter((oferta) => oferta.activo)
                        .sort((a, b) => a.orden - b.orden);

                    cachedOfertas = ofertasActivas;
                    prefetchOfertasImages(ofertasActivas);

                    if (isMounted) {
                        setOfertas(ofertasActivas);
                    }
                })();

                await fetchPromise;
            } catch (err) {
                if (!isMounted) return;
                console.error("Error fetching ofertas directas:", err);
                setError("Error al cargar ofertas destacadas");
                setOfertas([]);
            } finally {
                isFetching = false;
                fetchPromise = null;
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchOfertasDirectas();

        return () => {
            isMounted = false;
        };
    }, []);

    return { ofertas, loading, error };
}
