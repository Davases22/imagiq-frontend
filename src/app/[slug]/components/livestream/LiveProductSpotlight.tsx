'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import type { ProductCardProps } from '@/app/productos/components/ProductCard';
import { posthogUtils } from '@/lib/posthogClient';

interface LiveProductSpotlightProps {
  products: ProductCardProps[];
  /** Milisegundos que se muestra cada producto antes de pasar al siguiente */
  intervalMs?: number;
}

const formatCOP = (value?: string): string | null => {
  const n = Number(value);
  if (!value || !Number.isFinite(n) || n <= 0) return null;
  return `$ ${Math.round(n).toLocaleString('es-CO')}`;
};

/**
 * Tarjeta compacta sobre el video (esquina inferior izquierda) que va
 * rotando entre los productos del Live, estilo "producto destacado" de
 * live shopping. Se pausa al pasar el mouse por encima.
 * Solo se muestra en desktop (md+): en móvil tapa demasiado el video y
 * los productos ya se ven en la grilla justo debajo.
 */
export default function LiveProductSpotlight({
  products,
  intervalMs = 7000,
}: LiveProductSpotlightProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (products.length <= 1 || paused) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % products.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [products.length, paused, intervalMs]);

  if (products.length === 0) return null;

  const product = products[index % products.length];
  const price = formatCOP(product.price);
  const originalPrice = formatCOP(product.originalPrice);
  const showOriginal = !!originalPrice && originalPrice !== price;
  const imageSrc = typeof product.image === 'string' ? product.image : product.image?.src;
  const href = `/productos/multimedia/${String(product.id).split('/')[0]}`;

  const handleClick = () => {
    posthogUtils.capture('live_product_spotlight_click', {
      product_id: product.id,
      product_name: product.name,
      position: index + 1,
      total: products.length,
    });
  };

  return (
    <div
      className="hidden md:block absolute left-4 bottom-16 z-10 w-[300px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-live="polite"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={product.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <Link
            href={href}
            onClick={handleClick}
            className="flex items-center gap-3 rounded-xl bg-white/95 backdrop-blur shadow-lg ring-1 ring-black/5 p-2.5 hover:bg-white transition-colors"
          >
            <div className="relative h-[72px] w-[72px] shrink-0 rounded-lg bg-gray-100 overflow-hidden">
              {imageSrc ? (
                <Image
                  src={imageSrc}
                  alt={product.name}
                  fill
                  sizes="72px"
                  className="object-contain p-1"
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-900 leading-tight line-clamp-2">
                {product.name}
              </p>
              <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
                {price && (
                  <span className="text-base font-bold text-gray-900">{price}</span>
                )}
                {showOriginal && (
                  <span className="text-xs text-gray-400 line-through">
                    {originalPrice}
                  </span>
                )}
              </div>
              <span className="mt-0.5 inline-block text-xs font-medium text-blue-600">
                Ver producto
              </span>
            </div>
            {products.length > 1 && (
              <span className="self-start text-[10px] font-medium text-gray-500 bg-gray-100 rounded-full px-1.5 py-0.5">
                {index + 1}/{products.length}
              </span>
            )}
          </Link>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
