/**
 * Cliente de página multimedia
 */

'use client';

import { useState, useEffect } from 'react';
import MultimediaBannerCarousel from './MultimediaBannerCarousel';
import ProductSection from './ProductSection';
import FAQAccordion from './FAQAccordion';
import FormPageRenderer from './FormPageRenderer';
import LiveStreamPageRenderer from './LiveStreamPageRenderer';
import type { MultimediaPageData } from '@/services/multimedia-pages.service';
import type { ProductCardProps } from '@/app/productos/components/ProductCard';

interface MultimediaPageClientProps {
  pageData: MultimediaPageData;
  /** Productos del catálogo destacados en un Live (resueltos en el servidor) */
  livestreamProducts?: ProductCardProps[];
}

export default function MultimediaPageClient({
  pageData,
  livestreamProducts = [],
}: MultimediaPageClientProps) {
  // Estado local para manejar actualizaciones en tiempo real (preview)
  const [data, setData] = useState<MultimediaPageData>(pageData);

  // Efecto para escuchar mensajes del Dashboard (Preview)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verificar si es un mensaje de actualización de preview
      if (event.data?.type === 'PREVIEW_UPDATE' && event.data?.payload) {
        console.log('Preview update received:', event.data.payload);
        setData(event.data.payload as MultimediaPageData);
      }
    };

    window.addEventListener('message', handleMessage);

    // Avisar al padre que estamos listos para recibir datos
    window.parent.postMessage({ type: 'PREVIEW_READY' }, '*');

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const { page, banners, faqs, product_cards } = data;

  // Render livestream page if page_type is 'livestream'
  if (page.page_type === 'livestream' && page.livestream_config) {
    return (
      <LiveStreamPageRenderer
        pageData={page}
        banners={banners}
        faqs={faqs}
        livestreamProducts={livestreamProducts}
        productCards={product_cards}
      />
    );
  }

  // Render form page if page_type is 'form'
  if (page.page_type === 'form') {
    return <FormPageRenderer pageData={page} banners={banners} faqs={faqs} />;
  }

  return (
    <div className="min-h-screen bg-white -mt-12">
      {/* Carrusel de Banners */}
      <MultimediaBannerCarousel banners={banners} />

      {/* Sección de Título y Descripción de Productos */}
      {(page.products_section_title || page.products_section_description) && (
        <section className="w-full bg-white py-6 md:py-8">
          <div className="w-full mx-auto px-4 sm:px-6 lg:px-8" style={{ maxWidth: '1440px' }}>
            {page.products_section_title && (
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
                {page.products_section_title}
              </h2>
            )}
            {page.products_section_description && (
              <p className="text-lg md:text-xl lg:text-2xl text-gray-600 mb-8">
                {page.products_section_description}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Secciones de Productos con Tabs */}
      {page.sections && page.sections.length > 0 && product_cards && (
        <ProductSection
          sections={page.sections}
          productCards={product_cards}
        />
      )}

      {/* FAQs con Acordeón */}
      {faqs.length > 0 && <FAQAccordion faqs={faqs} />}
    </div>
  );
}
