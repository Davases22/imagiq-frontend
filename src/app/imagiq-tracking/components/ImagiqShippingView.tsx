"use client";

import { useEffect, useState } from "react";
import { TrackingHeader } from "@/app/tracking-service/components";
import Image from "next/image";
import dynamic from "next/dynamic";
import { WHATSAPP_NUMERO } from "@/components/sections/soporte/whatsapp/constants";

const DeliveryMap = dynamic(() => import("./DeliveryMap").then((mod) => ({ default: mod.DeliveryMap })), {
  ssr: false,
  loading: () => (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center animate-pulse" />
          <div>
            <div className="h-5 w-32 bg-gray-300 rounded animate-pulse mb-1" />
            <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>
      <div className="w-full h-[350px] bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">Cargando mapa...</div>
      </div>
    </div>
  ),
});

interface Product {
  id: string;
  nombre: string;
  desdetallada?: string;
  imagen?: string;
  cantidad: number;
  precio?: number;
  numero_guia?: string;
}

interface TiendaOrigen {
  direccion?: string;
  descripcion?: string;
  telefono?: string;
  latitud?: string;
  longitud?: string;
}

interface ImagiqShippingViewProps {
  orderNumber: string;
  estimatedInitDate: string;
  estimatedFinalDate: string;
  direccionEntrega?: string;
  ciudadEntrega?: string;
  nombreDestinatario?: string;
  telefonoDestinatario?: string;
  products?: Product[];
  tiendaOrigen?: TiendaOrigen;
  latitudDestino?: number;
  longitudDestino?: number;
}

export function ImagiqShippingView({
  orderNumber,
  estimatedInitDate,
  estimatedFinalDate,
  direccionEntrega,
  ciudadEntrega,
  products = [],
  tiendaOrigen,
  latitudDestino,
  longitudDestino,
}: Readonly<ImagiqShippingViewProps>) {
  const [currentProductIndex, setCurrentProductIndex] = useState(0);

  // Formatear teléfono para llamadas (usar el de la tienda si está disponible)
  const phoneForCall = tiendaOrigen?.telefono ? tiendaOrigen.telefono.replaceAll(/[\s()-]/g, "") : "+573001234567";

  // WhatsApp siempre usa el número fijo
  // Numero centralizado: antes estaba escrito a mano y se quedo en el
// 322 863 9389 cuando se migro al 300 651 5136.
  const whatsappPhoneNumber = WHATSAPP_NUMERO;

  // Mensaje predeterminado para WhatsApp
  const whatsappMessage = encodeURIComponent("Hola tienda imagiq, me gustaría realizar una consulta acerca...");

  useEffect(() => {
    setCurrentProductIndex(0);
  }, [products]);

  const hasMultipleProducts = products.length > 1;
  const currentProduct =
    products.length > 0 ? products[currentProductIndex] : undefined;

  const goToPrevProduct = () => {
    if (!hasMultipleProducts) return;
    setCurrentProductIndex((prevIndex) =>
      prevIndex === 0 ? products.length - 1 : prevIndex - 1
    );
  };

  const goToNextProduct = () => {
    if (!hasMultipleProducts) return;
    setCurrentProductIndex((prevIndex) =>
      prevIndex === products.length - 1 ? 0 : prevIndex + 1
    );
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-8">
      {/* Header Section */}
      <TrackingHeader
        orderNumber={orderNumber}
        estimatedInitDate={estimatedInitDate}
        estimatedFinalDate={estimatedFinalDate}
      />

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Map */}
        <div>
          {/* Delivery Map - Always show */}
          <DeliveryMap
            direccionOrigen={tiendaOrigen?.direccion}
            descripcionOrigen={tiendaOrigen?.descripcion}
            direccionDestino={direccionEntrega}
            ciudadDestino={ciudadEntrega}
            latitudOrigen={tiendaOrigen?.latitud ? Number.parseFloat(String(tiendaOrigen.latitud).trim()) : undefined}
            longitudOrigen={tiendaOrigen?.longitud ? Number.parseFloat(String(tiendaOrigen.longitud).trim()) : undefined}
            latitudDestino={latitudDestino}
            longitudDestino={longitudDestino}
          />
        </div>

        {/* Right Column - Products */}
        <div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
            {/* Content */}
            {products.length > 0 ? (
              <div className="p-6 pb-3">
                <div className="space-y-4">
                  {/* Header: Productos en tu pedido (izq) + Nombre y Precio (der) */}
                  <div className="pb-3 border-b border-gray-200">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      {/* Izquierda: Ícono + "Productos en tu pedido" */}
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center flex-shrink-0">
                          <svg
                            className="w-5 h-5 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
                            />
                          </svg>
                        </div>
                        <div>
                          <h2 className="font-semibold text-black text-sm">
                            Productos en tu pedido
                          </h2>
                          <p className="text-sm text-gray-500">
                            {products.length}{" "}
                            {products.length === 1 ? "producto" : "productos"}
                          </p>
                        </div>
                      </div>

                      {/* Derecha: Nombre del producto y Precio */}
                      <div className="text-right">
                        <h3 className="font-semibold text-gray-900 text-sm mb-1">
                          {currentProduct?.desdetallada || currentProduct?.nombre || "Producto sin nombre"}
                        </h3>
                        {currentProduct?.precio && (
                          <div className="flex flex-col items-end">
                            <span className="text-lg font-bold text-[#17407A]">
                              $
                              {currentProduct.precio.toLocaleString("es-CO")}
                            </span>
                            {currentProduct.numero_guia && (
                              <span className="text-xs text-gray-500 mt-1">
                                Guía: {currentProduct.numero_guia}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Imagen centrada sin fondo */}
                  <div className="relative w-full h-[405px] flex items-center justify-center">
                    {currentProduct?.imagen ? (
                      <div className="relative w-full h-full">
                        <Image
                          src={currentProduct.imagen}
                          alt={currentProduct.nombre}
                          fill
                          className="object-contain"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          priority
                        />
                      </div>
                    ) : (
                      <svg
                        className="w-32 h-32 text-gray-300"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    )}

                    {hasMultipleProducts && (
                      <>
                        <button
                          type="button"
                          onClick={goToPrevProduct}
                          aria-label="Ver producto anterior"
                          className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 rounded-full p-2 shadow-lg transition disabled:opacity-40"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 19l-7-7 7-7"
                            />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={goToNextProduct}
                          aria-label="Ver siguiente producto"
                          className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 rounded-full p-2 shadow-lg transition disabled:opacity-40"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </button>
                        <div className="absolute bottom-4 right-4 bg-gray-900/80 text-white text-xs font-medium px-3 py-1 rounded-full">
                          Producto {currentProductIndex + 1} de {products.length}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 p-12">
                <div className="flex flex-col items-center justify-center text-center h-full">
                  <div className="w-32 h-32 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mb-4">
                    <svg
                      className="w-16 h-16 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                      />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-gray-700 mb-2">
                    Detalles del pedido
                  </h3>
                  <p className="text-sm text-gray-500 max-w-xs">
                    Los detalles de los productos se mostrarán aquí una vez que estén disponibles
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Contact Support - Full Width */}
      <div className="mt-2">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-[#17407A]"
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
            href={`tel:${phoneForCall}`}
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
            href={`https://wa.me/${whatsappPhoneNumber}?text=${whatsappMessage}`}
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
