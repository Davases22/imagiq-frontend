import { SimpleTrackingHeader } from "./SimpleTrackingHeader";
import { TrackingTimeline } from "./TrackingTimeline";
import { PDFViewer } from "./PDFViewer";
import { useState, useEffect, useMemo } from "react";
import { WHATSAPP_NUMERO } from "@/components/sections/soporte/whatsapp/constants";

interface ShippingOrderViewProps {
  orderNumber: string;
  estimatedInitDate: string;
  estimatedFinalDate: string;
  trackingSteps: Array<{
    evento: string;
    time_stamp: string;
  }>;
  pdfBase64: string;
  shipments?: Array<{ numero_guia: string }>;
  selectedShipmentIndex?: number;
  onSelectShipment?: (index: number) => void;
  onGuideChange?: (guideNumber: string) => void; // Nueva función callback para cambio de guía
  products?: Array<{
    id: string;
    nombre: string;
    imagen?: string;
    precio?: number;
    numero_guia?: string;
    desdetallada?: string; // Added to match Imagiq structure if needed
    cantidad?: number; // Cantidad del producto
  }>;
  shippingType?: "pickup" | "imagiq" | "coordinadora";
}

export function ShippingOrderView({
  orderNumber,
  estimatedInitDate,
  estimatedFinalDate,
  trackingSteps,
  pdfBase64,
  shipments = [],
  selectedShipmentIndex = 0,
  onSelectShipment,
  onGuideChange, // Nueva prop
  products = [],
  shippingType = "coordinadora",
}: Readonly<ShippingOrderViewProps>) {
  const isCoordinadora = shippingType === "coordinadora";
  const [activeTab, setActiveTab] = useState<'guide' | 'products'>(isCoordinadora ? 'products' : 'guide');
  
  const [currentProductIndex, setCurrentProductIndex] = useState(0);
  const [currentGuideIndex, setCurrentGuideIndex] = useState(0);

  // Group products by guide number for Coordinadora
  const productsByGuide = useMemo(() => {
    if (!isCoordinadora || products.length === 0) return [];
    
    // Group products by numero_guia
    const grouped = products.reduce((acc, product) => {
      const guia = product.numero_guia || 'sin-guia';
      if (!acc[guia]) {
        acc[guia] = [];
      }
      acc[guia].push(product);
      return acc;
    }, {} as Record<string, typeof products>);
    
    // Convert to array format
    return Object.entries(grouped).map(([guia, prods]) => ({
      numero_guia: guia,
      products: prods
    }));
  }, [products, isCoordinadora]);

  // Get current guide and products
  const currentGuide = productsByGuide[currentGuideIndex];
  const currentGuideProducts = currentGuide?.products || [];
  const currentProduct = currentGuideProducts[currentProductIndex];

  // For non-Coordinadora, use original logic
  const currentShipment = shipments[selectedShipmentIndex];
  const guideProducts = products.filter(p =>
    !p.numero_guia || !currentShipment || p.numero_guia === currentShipment.numero_guia
  );

  const hasMultipleProducts = isCoordinadora ? currentGuideProducts.length > 1 : guideProducts.length > 1;
  const hasMultipleGuides = productsByGuide.length > 1;
  const displayProduct = isCoordinadora ? currentProduct : (guideProducts.length > 0 ? guideProducts[currentProductIndex] : undefined);

  // Use displayProduct for consistency across both modes
  const activeProduct = displayProduct;

  useEffect(() => {
    setCurrentProductIndex(0);
    setCurrentGuideIndex(0);
  }, [selectedShipmentIndex, products]);

  // Navigation functions for guides
  const goToPrevGuide = () => {
    if (!hasMultipleGuides) return;
    const newIndex = currentGuideIndex === 0 ? productsByGuide.length - 1 : currentGuideIndex - 1;
    setCurrentGuideIndex(newIndex);
    setCurrentProductIndex(0); // Reset product index when changing guide

    // Notificar el cambio de guía al componente padre
    const newGuide = productsByGuide[newIndex];
    if (newGuide && onGuideChange) {
      onGuideChange(newGuide.numero_guia);
    }
  };

  const goToNextGuide = () => {
    if (!hasMultipleGuides) return;
    const newIndex = currentGuideIndex === productsByGuide.length - 1 ? 0 : currentGuideIndex + 1;
    setCurrentGuideIndex(newIndex);
    setCurrentProductIndex(0); // Reset product index when changing guide

    // Notificar el cambio de guía al componente padre
    const newGuide = productsByGuide[newIndex];
    if (newGuide && onGuideChange) {
      onGuideChange(newGuide.numero_guia);
    }
  };

  // Navigation functions for products within a guide
  const goToPrevProduct = () => {
    if (!hasMultipleProducts) return;
    if (isCoordinadora) {
      setCurrentProductIndex((prev) =>
        prev === 0 ? currentGuideProducts.length - 1 : prev - 1
      );
    } else {
      setCurrentProductIndex((prev) =>
        prev === 0 ? guideProducts.length - 1 : prev - 1
      );
    }
  };

  const goToNextProduct = () => {
    if (!hasMultipleProducts) return;
    if (isCoordinadora) {
      setCurrentProductIndex((prev) =>
        prev === currentGuideProducts.length - 1 ? 0 : prev + 1
      );
    } else {
      setCurrentProductIndex((prev) =>
        prev === guideProducts.length - 1 ? 0 : prev + 1
      );
    }
  };

  const handleDownload = () => {
    if (!pdfBase64) return;
    const byteCharacters = atob(pdfBase64);
    const byteNumbers = new Array(byteCharacters.length)
      .fill(0)
      .map((_, i) => byteCharacters.charCodeAt(i));
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Guia-${orderNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full">
      <div className="flex flex-col md:flex-row gap-4 md:gap-8">
        {/* Left Column: Timeline */}
        <div className="md:w-1/2 w-full">
          <SimpleTrackingHeader
            orderNumber={orderNumber}
            estimatedInitDate={estimatedInitDate}
            estimatedFinalDate={estimatedFinalDate}
            guideNumber={isCoordinadora ? currentGuide?.numero_guia : currentShipment?.numero_guia}
            shippingType={shippingType}
          />

          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">
              Historial de eventos
            </h3>
            <TrackingTimeline events={trackingSteps} />
          </div>
        </div>

        {/* Right Column: PDF Viewer OR Products */}
        <div className="md:w-1/2 w-full">
          {/* Tab Switcher */}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setActiveTab('guide')}
              className={`py-2 px-4 text-sm font-bold rounded-lg transition-all ${activeTab === 'guide' ? 'bg-black text-white' : 'bg-gray-100 text-black hover:bg-gray-200'}`}
            >
              Guía de envío
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`py-2 px-4 text-sm font-bold rounded-lg transition-all ${activeTab === 'products' ? 'bg-black text-white' : 'bg-gray-100 text-black hover:bg-gray-200'}`}
            >
              Productos
            </button>
            <span className="text-xs text-gray-500 ml-2">← Pulsa para cambiar</span>
          </div>

          {activeTab === 'guide' ? (
            <PDFViewer
              pdfBase64={pdfBase64}
              orderNumber={orderNumber}
              onDownload={handleDownload}
              shipments={shipments}
              selectedShipmentIndex={selectedShipmentIndex}
              onSelectShipment={onSelectShipment}
            />
          ) : (
            // Product View
            <div className={`w-full rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden ${isCoordinadora ? 'h-[600px]' : 'h-[600px]'}`}>
              {(isCoordinadora ? currentGuideProducts.length > 0 : guideProducts.length > 0) ? (
                isCoordinadora ? (
                  // Vista para Coordinadora con navegación por guías
                  <div className="h-full flex flex-col">
                    {/* Navigation for guides */}
                    {hasMultipleGuides && (
                      <div className="px-5 pt-4 pb-2 flex items-center justify-center gap-3 border-b border-gray-200">
                        <button
                          onClick={goToPrevGuide}
                          className="p-2 rounded-full bg-blue-100 hover:bg-blue-200 transition text-blue-600"
                          aria-label="Guía anterior"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <span className="text-sm font-semibold text-black min-w-[120px] text-center">
                          Guía {currentGuideIndex + 1} de {productsByGuide.length}
                        </span>
                        <button
                          onClick={goToNextGuide}
                          className="p-2 rounded-full bg-blue-100 hover:bg-blue-200 transition text-blue-600"
                          aria-label="Guía siguiente"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    )}

                    {/* Navigation for products within current guide */}
                    {hasMultipleProducts && (
                      <div className="px-5 pt-2 pb-2 flex items-center justify-center gap-3">
                        <button
                          onClick={goToPrevProduct}
                          className="p-1 rounded-full bg-gray-100 hover:bg-gray-200 transition"
                          aria-label="Producto anterior"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <span className="text-xs font-medium text-gray-600 min-w-[100px] text-center">
                          Producto {currentProductIndex + 1} de {currentGuideProducts.length}
                        </span>
                        <button
                          onClick={goToNextProduct}
                          className="p-1 rounded-full bg-gray-100 hover:bg-gray-200 transition"
                          aria-label="Producto siguiente"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    )}

                    {/* Product Info Compact */}
                    <div className="px-5 pt-2 pb-3 border-b border-gray-100">
                      <h3 className="font-semibold text-gray-900 text-sm mb-1">
                        {activeProduct?.desdetallada || activeProduct?.nombre || "Producto"}
                      </h3>
                      <div className="flex items-center justify-between mb-2">
                        {activeProduct?.precio && (
                          <span className="text-lg font-bold text-[#17407A]">
                            ${activeProduct.precio.toLocaleString("es-CO")}
                          </span>
                        )}
                        <div className="text-right">
                          {/* Mostrar cantidad del producto */}
                          <div className="text-sm text-gray-600">
                            Cantidad: <span className="font-medium">{activeProduct?.cantidad || 1}</span>
                          </div>
                        </div>
                      </div>
                      {/* Mostrar número de guía del producto */}
                      {activeProduct?.numero_guia && (
                        <div className="bg-gray-50 px-3 py-2 rounded-lg">
                          <div className="text-xs text-gray-500 mb-1">Número de Guía</div>
                          <div className="text-sm font-mono font-medium text-gray-900">
                            {activeProduct.numero_guia}
                          </div>
                          <a
                            href={`https://www.coordinadora.com/portafolio-de-servicios/servicios-en-linea/rastrear-guias/?guia=${activeProduct.numero_guia}&tipo=guia`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 underline hover:text-blue-800 mt-1 inline-block"
                          >
                            Rastrear en Coordinadora
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Image Area - Compact */}
                    <div className="relative flex-1 flex items-center justify-center bg-white p-4 min-h-[300px]">
                      {activeProduct?.imagen ? (
                        <img
                          src={activeProduct.imagen}
                          alt={activeProduct.nombre}
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : (
                        <div className="text-gray-300 flex flex-col items-center">
                          <svg className="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-sm">Sin imagen</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  // Vista original para Pickup/Imagiq
                  <div className="p-6 h-full flex flex-col">
                  {/* Header: Info + Price */}
                  <div className="flex items-start justify-between gap-4 mb-6 pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="font-semibold text-black text-sm">Productos en esta guía</h2>
                        <p className="text-sm text-gray-500">
                          {guideProducts.length} {guideProducts.length === 1 ? "producto" : "productos"}
                        </p>
                      </div>
                    </div>

                    <div className="text-right flex-1 ml-4 justify-end">
                      <h3 className="font-semibold text-gray-900 text-sm mb-1 text-right">
                        {activeProduct?.desdetallada || activeProduct?.nombre || "Producto"}
                      </h3>
                      {activeProduct?.precio && (
                        <span className="text-lg font-bold text-[#17407A]">
                          ${activeProduct.precio.toLocaleString("es-CO")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Image Area */}
                  <div className="relative flex-1 flex items-center justify-center min-h-[400px] bg-white rounded-lg overflow-hidden">
                    {activeProduct?.imagen ? (
                      <div className="relative w-full h-full p-8 flex items-center justify-center">
                        <img
                          src={activeProduct.imagen}
                          alt={activeProduct.nombre}
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="text-gray-300 flex flex-col items-center">
                        <svg className="w-20 h-20 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm">Sin imagen</span>
                      </div>
                    )}

                    {/* Navigation Arrows */}
                    {hasMultipleProducts && (
                      <>
                        <button
                          onClick={goToPrevProduct}
                          className="absolute left-4 top-1/2 -translate-y-1/2 bg-white text-gray-800 p-2 rounded-full shadow-lg hover:bg-gray-50 transition z-10"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={goToNextProduct}
                          className="absolute right-4 top-1/2 -translate-y-1/2 bg-white text-gray-800 p-2 rounded-full shadow-lg hover:bg-gray-50 transition z-10"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        <div className="absolute bottom-4 right-4 bg-black/80 text-white text-xs font-medium px-3 py-1 rounded-full z-10">
                          {currentProductIndex + 1} / {guideProducts.length}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-10 text-center text-gray-500">
                  <p>No hay productos asociados a esta guía.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Contact Support Section - Full Width */}
      <div className="w-full px-4 sm:px-8 mt-10 mb-8">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-black"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          ¿Necesitas ayuda?
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Nuestro equipo está disponible para ayudarte en días hábiles y horas laborales.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <a
            href="tel:6017441176"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-black text-white rounded-lg hover:brightness-110 transition text-sm font-medium shadow-sm"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
            Llamar ahora
          </a>
          <a
            href={`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent("Hola tienda imagiq, me gustaría realizar una consulta acerca...")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:brightness-110 transition text-sm font-medium shadow-sm"
          >
            <svg
              className="w-4 h-4"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
            Enviar WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
