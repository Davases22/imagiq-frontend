import React from "react";
import { Store } from "lucide-react";
import type { FormattedStore } from "@/types/store";

interface StorePickupSelectorProps {
  deliveryMethod: string;
  onMethodChange: (method: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
  availableStoresWhenCanPickUpFalse?: FormattedStore[];
  hasActiveTradeIn?: boolean;
  canPickUp?: boolean | null;
  onStoreEditToggle?: (edit: boolean) => void;
  storeEdit?: boolean;
  selectedStore?: FormattedStore | null;
}

export const StorePickupSelector: React.FC<StorePickupSelectorProps> = ({
  deliveryMethod,
  onMethodChange,
  disabled = false,
  isLoading = false,
  availableStoresWhenCanPickUpFalse = [],
  hasActiveTradeIn = false,
  canPickUp = null,
  onStoreEditToggle,
  storeEdit = false,
  selectedStore = null,
}) => {
  // Solo mostrar el mensaje si está deshabilitado, hay trade-in activo y hay tiendas disponibles
  const showStoresInfo = disabled && hasActiveTradeIn && !isLoading && availableStoresWhenCanPickUpFalse.length > 0;

  return (
    <div className="space-y-3">
      <label
        htmlFor="tienda"
        className={`flex flex-col gap-3 p-4 border rounded-lg max-md:rounded-t-none transition-all ${disabled || isLoading
          ? "border-gray-200 bg-gray-100 cursor-not-allowed opacity-60"
          : deliveryMethod === "tienda"
            ? "border-blue-500 cursor-pointer"
            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50 cursor-pointer"
          }`}
      >
        <div className="flex items-center gap-4">
          <input
            type="radio"
            id="tienda"
            name="delivery"
            checked={deliveryMethod === "tienda"}
            onChange={(e) => {
              if (!disabled && !isLoading && e.target.checked) {
                onMethodChange("tienda");
              }
            }}
            disabled={disabled || isLoading}
            className="accent-blue-600 w-5 h-5"
          />
          <div className="flex items-center gap-3 flex-1">
            <Store className={`w-5 h-5 ${deliveryMethod === "tienda" ? "text-blue-600" : "text-gray-600"}`} />
            <div className="flex-1">
              <div className="font-semibold text-gray-900">Recoger en tienda</div>
              <div className="text-sm text-gray-600">
                {isLoading
                  ? "Verificando disponibilidad..."
                  : disabled
                    ? "Tu producto no cuenta con esa opción"
                    : "Recoge tu pedido en una de nuestras tiendas"}
              </div>
            </div>
            {isLoading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            )}
          </div>
        </div>

        {/* Vista previa de tienda - SIEMPRE visible cuando hay tienda disponible o seleccionada */}
        {!disabled && !isLoading && (selectedStore || availableStoresWhenCanPickUpFalse.length > 0) && (
          <div className="ml-9 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-white rounded-lg border border-gray-200">
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-gray-900 mb-1">
                {selectedStore ? "Tienda seleccionada" : "Tienda disponible"}
              </h4>
              <p className="text-sm text-gray-600">
                {selectedStore ? selectedStore.descripcion : availableStoresWhenCanPickUpFalse[0]?.descripcion}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {selectedStore ? selectedStore.direccion : availableStoresWhenCanPickUpFalse[0]?.direccion}
                {selectedStore
                  ? (selectedStore.ciudad && `, ${selectedStore.ciudad}`)
                  : (availableStoresWhenCanPickUpFalse[0]?.ciudad && `, ${availableStoresWhenCanPickUpFalse[0].ciudad}`)
                }
              </p>
            </div>
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 transition self-start sm:self-center cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                if (deliveryMethod !== "tienda") {
                  onMethodChange("tienda");
                }
                if (onStoreEditToggle) {
                  onStoreEditToggle(true);
                }
              }}
            >
              {deliveryMethod === "tienda" ? "Cambiar tienda" : "Ver tiendas"}
            </button>
          </div>
        )}
      </label>

      {/* Mostrar información de tiendas disponibles cuando canPickUp es false y hay trade-in activo */}
      {showStoresInfo && (
        <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-lg shadow-sm">
          <p className="text-sm font-bold text-gray-900 mb-2">
            El producto en tu carrito no está disponible para recoger en tienda con tu dirección predeterminada.
          </p>
          <p className="text-xs text-gray-700 mb-3">
            Cambia tu dirección predeterminada a una zona de cobertura con una tienda disponible.
          </p>

          {/* Mostrar tiendas disponibles - agrupadas por ciudad */}
          {availableStoresWhenCanPickUpFalse.length > 0 && (() => {
            // Agrupar tiendas por ciudad
            const storesByCity = availableStoresWhenCanPickUpFalse.reduce((acc, store) => {
              const city = store.ciudad || 'Sin ciudad';
              if (!acc[city]) {
                acc[city] = [];
              }
              acc[city].push(store);
              return acc;
            }, {} as Record<string, typeof availableStoresWhenCanPickUpFalse>);

            return (
              <div className="mb-3 p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                <p className="text-xs font-semibold text-gray-900 mb-2">
                  El producto está disponible en las siguientes tiendas:
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {Object.entries(storesByCity).map(([city, cityStores]) => (
                    <div key={city} className="space-y-1">
                      <div className="text-xs font-bold text-gray-700 uppercase">{city}</div>
                      {cityStores.map((store) => (
                        <div
                          key={store.codigo}
                          className="ml-3 p-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200"
                        >
                          <div className="font-semibold text-sm text-gray-900">{store.descripcion}</div>
                          <div className="text-xs text-gray-600 mt-0.5">
                            {store.direccion}
                          </div>
                          {store.ubicacion_cc && (
                            <div className="text-xs text-gray-500 mt-0.5">{store.ubicacion_cc}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
