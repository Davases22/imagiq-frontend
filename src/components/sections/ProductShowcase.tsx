"use client";

import { useMemo, useState, useCallback } from "react";
import { useProducts } from "@/features/products/useProducts";
import { useFavorites } from "@/features/products/useProducts";
import ProductCard, { ProductCardProps } from "@/app/productos/components/ProductCard";
import SkeletonCard from "@/components/SkeletonCard";
import GuestDataModal from "@/app/productos/components/GuestDataModal";

interface ProductShowcaseProps {
  initialProducts?: ProductCardProps[];
}

export default function ProductShowcase({ initialProducts }: ProductShowcaseProps = {}) {
  // Solo hacer fetch si NO hay datos iniciales del servidor
  const shouldFetch = !initialProducts || initialProducts.length === 0;

  const filters = useMemo(() =>
    shouldFetch ? {
      limit: 300, // Límite muy alto para asegurar que incluya todos los productos
      page: 1,
      minStock: 1,
    } : null,
  [shouldFetch]);

  const { products: apiProducts, loading: apiLoading } = useProducts(filters);

  // Usar productos iniciales si están disponibles, sino usar los de la API
  const allProducts = initialProducts && initialProducts.length > 0 ? initialProducts : apiProducts;
  const loading = initialProducts && initialProducts.length > 0 ? false : apiLoading;

  // Hook de favoritos
  const { addToFavorites, removeFromFavorites, isFavorite } = useFavorites();

  // Estados para el modal de invitado
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [pendingFavorite, setPendingFavorite] = useState<string | null>(null);

  // SKUs específicos para el showcase (de más caro a más económico)
  const products = useMemo(() => {
    if (!allProducts || allProducts.length === 0) return [];

    const showcaseSKUs = [
      'SM-S948BZVKLTC',   // Galaxy S26 Ultra 5G
      'SM-S947BZVJLTC',   // Galaxy S26+ 5G
      'SM-S942BZVKLTC',   // Galaxy S26 5G
      'SM-R640NZKALTA',   // Galaxy Buds 4 Pro
    ];

    const findBySku = (sku: string) =>
      allProducts.find(p => {
        const api = p.apiProduct;
        if (!api) return false;
        if (Array.isArray(api.sku) && api.sku.some(s => s === sku)) return true;
        if (Array.isArray(api.skuPostback) && (api.skuPostback as string[]).some(s => s === sku)) return true;
        return false;
      });

    const result: ProductCardProps[] = [];
    for (const sku of showcaseSKUs) {
      const found = findBySku(sku);
      if (found && !result.some(p => p.id === found.id)) {
        result.push(found);
      }
    }

    return result;
  }, [allProducts]);

  // Manejar toggle de favoritos
  const handleToggleFavorite = useCallback(async (productId: string) => {
    // Verificar si el usuario está autenticado o tiene datos guardados
    const userData = localStorage.getItem("imagiq_user");
    const parsedUser = userData ? JSON.parse(userData) : null;

    // Si no hay usuario guardado, mostrar modal de invitado
    if (!parsedUser?.id) {
      setPendingFavorite(productId);
      setShowGuestModal(true);
      return;
    }

    // Si ya es favorito, remover
    if (isFavorite(productId)) {
      try {
        await removeFromFavorites(productId, parsedUser);
      } catch (error) {
        console.error("Error removing favorite:", error);
      }
    } else {
      // Si no es favorito, agregar
      try {
        await addToFavorites(productId, parsedUser);
      } catch (error) {
        console.error("Error adding favorite:", error);
      }
    }
  }, [isFavorite, addToFavorites, removeFromFavorites]);

  // Manejar envío del modal de invitado
  const handleGuestSubmit = useCallback(async (guestData: {
    nombre: string;
    apellido: string;
    email: string;
    telefono: string;
    tipo_documento?: string;
    numero_documento?: string;
  }) => {
    if (!pendingFavorite) return;

    try {
      // addToFavorites filtrará automáticamente los campos no permitidos
      const userInfo = await addToFavorites(pendingFavorite, guestData);
      // Si recibimos información del usuario, guardarla (incluyendo tipo_documento y numero_documento si existen)
      if (userInfo) {
        // Mantener los campos de documento en localStorage aunque no se envíen al backend
        const userDataToSave = {
          ...userInfo,
          ...(guestData.tipo_documento && { tipo_documento: guestData.tipo_documento }),
          ...(guestData.numero_documento && { numero_documento: guestData.numero_documento }),
        };
        localStorage.setItem("imagiq_user", JSON.stringify(userDataToSave));
      }
      setShowGuestModal(false);
      setPendingFavorite(null);

    } catch (error) {
      console.error("Error handling guest favorite:", error);
      // Aquí podrías mostrar un error al usuario si lo deseas
    }
  }, [pendingFavorite, addToFavorites]);

  if (loading) {
    return (
      <section className="w-full flex justify-center bg-white pt-[25px] pb-0">
        <div className="w-full" style={{ maxWidth: "1440px" }}>
          {/* Desktop: Grid 4 columnas */}
          <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-[25px]">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="w-full">
                <SkeletonCard />
              </div>
            ))}
          </div>

          {/* Mobile: Scroll horizontal */}
          <div className="md:hidden overflow-x-auto scrollbar-hide">
            <div className="flex gap-[25px] px-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="shrink-0 w-[calc(100vw-32px)] sm:w-[280px]">
                  <SkeletonCard />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!products || products.length === 0) {
    return null;
  }

  return (
    <section className="w-full flex justify-center bg-white pt-[25px] pb-0">
      <div className="w-full" style={{ maxWidth: "1440px" }}>
        {/* Desktop: Grid 4 columnas */}
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-[25px]">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              {...product}
              forceNuevo
              isFavorite={isFavorite(product.id)}
              onToggleFavorite={handleToggleFavorite}
            />
          ))}
        </div>

        {/* Mobile: Scroll horizontal */}
        <div className="md:hidden overflow-x-auto scrollbar-hide">
          <div className="flex gap-3 px-4">
            {products.map((product) => (
              <div
                key={product.id}
                className="shrink-0 w-[75vw] sm:w-[280px]"
              >
                <ProductCard
                  {...product}
                  forceNuevo
                  isFavorite={isFavorite(product.id)}
                  onToggleFavorite={handleToggleFavorite}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal de datos de invitado */}
      {showGuestModal && (
        <GuestDataModal
          isOpen={showGuestModal}
          onClose={() => {
            setShowGuestModal(false);
            setPendingFavorite(null);
          }}
          onSubmit={handleGuestSubmit}
        />
      )}
    </section>
  );
}
