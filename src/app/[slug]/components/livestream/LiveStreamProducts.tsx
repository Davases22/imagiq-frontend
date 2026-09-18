'use client';

import { useCallback, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ProductCard, { type ProductCardProps } from '@/app/productos/components/ProductCard';
import GuestDataModal from '@/app/productos/components/GuestDataModal';
import { useFavorites } from '@/features/products/useProducts';

interface LiveStreamProductsProps {
  products: ProductCardProps[];
  isLive?: boolean;
  title?: string;
}

/**
 * Tira horizontal de productos del Live, estilo "live shopping":
 * usa la tarjeta real del catálogo (precio, colores, carrito, favoritos).
 */
export default function LiveStreamProducts({
  products,
  isLive = false,
  title = 'Productos de este Live',
}: LiveStreamProductsProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const { addToFavorites, removeFromFavorites, isFavorite } = useFavorites();
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [pendingFavorite, setPendingFavorite] = useState<string | null>(null);

  const handleToggleFavorite = useCallback(
    async (productId: string) => {
      const userData = localStorage.getItem('imagiq_user');
      const parsedUser = userData ? JSON.parse(userData) : null;

      if (!parsedUser?.id) {
        setPendingFavorite(productId);
        setShowGuestModal(true);
        return;
      }

      try {
        if (isFavorite(productId)) {
          await removeFromFavorites(productId, parsedUser);
        } else {
          await addToFavorites(productId, parsedUser);
        }
      } catch (error) {
        console.error('Error al actualizar favorito:', error);
      }
    },
    [isFavorite, addToFavorites, removeFromFavorites],
  );

  const handleGuestSubmit = useCallback(
    async (guestData: {
      nombre: string;
      apellido: string;
      email: string;
      telefono: string;
      tipo_documento?: string;
      numero_documento?: string;
    }) => {
      if (!pendingFavorite) return;
      try {
        const userInfo = await addToFavorites(pendingFavorite, guestData);
        if (userInfo) {
          localStorage.setItem(
            'imagiq_user',
            JSON.stringify({
              ...userInfo,
              ...(guestData.tipo_documento && { tipo_documento: guestData.tipo_documento }),
              ...(guestData.numero_documento && { numero_documento: guestData.numero_documento }),
            }),
          );
        }
        setShowGuestModal(false);
        setPendingFavorite(null);
      } catch (error) {
        console.error('Error al agregar favorito:', error);
      }
    },
    [pendingFavorite, addToFavorites],
  );

  const scrollBy = (direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(el.clientWidth * 0.8, 300), behavior: 'smooth' });
  };

  if (products.length === 0) return null;

  return (
    <section aria-label={title} className="w-full mt-4 md:mt-6">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600" />
            </span>
          )}
          <h3 className="text-lg md:text-xl font-bold text-gray-900">{title}</h3>
          <span className="text-xs font-medium text-gray-600 bg-gray-100 rounded-full px-2 py-0.5">
            {products.length}
          </span>
        </div>
        {products.length > 1 && (
          <div className="hidden md:flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollBy(-1)}
              className="h-9 w-9 rounded-full border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50"
              aria-label="Ver productos anteriores"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => scrollBy(1)}
              className="h-9 w-9 rounded-full border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50"
              aria-label="Ver más productos"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      <div
        ref={scrollerRef}
        className="flex gap-4 md:gap-[25px] overflow-x-auto scrollbar-hide snap-x snap-mandatory scroll-smooth pb-2 -mx-4 px-4 sm:mx-0 sm:px-0"
      >
        {products.map((product) => (
          <div key={product.id} className="shrink-0 w-[260px] md:w-[280px] snap-start">
            <ProductCard
              {...product}
              isFavorite={isFavorite(product.id)}
              onToggleFavorite={handleToggleFavorite}
            />
          </div>
        ))}
      </div>

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
