import React from "react";
import { Truck } from "lucide-react";
import type { Address } from "@/types/address";

export interface RecipientData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

interface DeliveryMethodSelectorProps {
  deliveryMethod: string;
  onMethodChange: (method: string) => void;
  canContinue: boolean;
  disableHomeDelivery?: boolean;
  disableReason?: string;
  disableStorePickup?: boolean;
  disableStorePickupReason?: string;
  address?: Address | null;
  onEditToggle?: (edit: boolean) => void;
  addressLoading?: boolean;
  addressEdit?: boolean;
  receivedByClient?: boolean;
  onReceivedByClientChange?: (receivedByClient: boolean) => void;
  recipientData?: RecipientData;
  onRecipientDataChange?: (data: RecipientData) => void;
}

export const DeliveryMethodSelector: React.FC<DeliveryMethodSelectorProps> = ({
  deliveryMethod,
  onMethodChange,
  canContinue,
  disableHomeDelivery = false,
  disableReason,
  disableStorePickup = false,
  disableStorePickupReason,
  address,
  onEditToggle,
  addressLoading = false,
  addressEdit = false,
  receivedByClient: receivedByClientProp,
  onReceivedByClientChange,
  recipientData: recipientDataProp,
  onRecipientDataChange,
}) => {
  // Estado local con valores controlados desde props o valores por defecto
  const [receivedByClientLocal, setReceivedByClientLocal] = React.useState(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('checkout-received-by-client');
    return saved ? JSON.parse(saved) : true;
  });

  const [recipientDataLocal, setRecipientDataLocal] = React.useState<RecipientData>(() => {
    if (typeof window === 'undefined') {
      return { firstName: "", lastName: "", email: "", phone: "" };
    }
    const saved = localStorage.getItem('checkout-recipient-data');
    return saved ? JSON.parse(saved) : { firstName: "", lastName: "", email: "", phone: "" };
  });

  // Usar props si están disponibles, sino usar estado local
  const receivedByClient = receivedByClientProp ?? receivedByClientLocal;
  const recipientData = recipientDataProp ?? recipientDataLocal;

  const handleReceivedByClientChange = (checked: boolean) => {
    if (onReceivedByClientChange) {
      onReceivedByClientChange(checked);
    } else {
      setReceivedByClientLocal(checked);
    }
  };

  const handleRecipientDataChange = (field: keyof RecipientData, value: string) => {
    const newData = { ...recipientData, [field]: value };
    if (onRecipientDataChange) {
      onRecipientDataChange(newData);
    } else {
      setRecipientDataLocal(newData);
    }
  };

  // Guardar en localStorage cuando cambian los datos
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('checkout-received-by-client', JSON.stringify(receivedByClient));
      if (!receivedByClient) {
        localStorage.setItem('checkout-recipient-data', JSON.stringify(recipientData));
      } else {
        localStorage.removeItem('checkout-recipient-data');
      }
    }
  }, [receivedByClient, recipientData]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Información de entrega</h2>

      {!canContinue && deliveryMethod === "domicilio" && (
        <div className="p-3 bg-gray-100 border border-gray-300 rounded-lg">
          <p className="text-sm font-bold text-gray-900">
            Por favor selecciona una dirección para continuar.
          </p>
        </div>
      )}

      <div className="space-y-3">
        <label
          htmlFor="domicilio"
          className={`flex flex-col gap-3 p-4 border rounded-lg transition-all ${
            disableHomeDelivery
              ? "border-gray-200 bg-gray-100 cursor-not-allowed opacity-60"
              : deliveryMethod === "domicilio"
              ? "border-blue-500 cursor-pointer"
              : "border-gray-200 hover:border-gray-300 hover:bg-gray-50 cursor-pointer"
          }`}
        >
          <div className="flex items-center gap-4">
            <input
              type="radio"
              id="domicilio"
              name="delivery"
              checked={deliveryMethod === "domicilio"}
              onChange={(e) => {
                if (!disableHomeDelivery && e.target.checked) {
                  onMethodChange("domicilio");
                }
              }}
              disabled={disableHomeDelivery}
              className="accent-blue-600 w-5 h-5"
            />
            <div className="flex items-center gap-3 flex-1">
              <Truck className={`w-5 h-5 ${deliveryMethod === "domicilio" ? "text-blue-600" : "text-gray-600"}`} />
              <div>
                <div className="font-semibold text-gray-900">Envío a domicilio</div>
                <div className="text-sm text-gray-600">
                  {disableHomeDelivery && disableReason
                    ? disableReason
                    : "Recibe tu pedido en la dirección que prefieras"}
                </div>
              </div>
            </div>
          </div>

          {/* Mostrar dirección seleccionada - SIEMPRE visible cuando no está deshabilitado */}
          {!disableHomeDelivery && (
            <>
              <div className="ml-9 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-white rounded-lg border border-gray-200">
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-gray-900 mb-1">
                    Dirección seleccionada
                  </h4>
                  {addressLoading ? (
                    <div className="space-y-2 animate-pulse">
                      <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600">
                      {address
                        ? (() => {
                            // El backend usa snake_case, necesitamos acceder a linea_uno.
                            // IMPORTANTE: linea_uno/lineaUno tienen prioridad sobre direccionFormateada
                            // porque es el campo que refleja lo que el usuario escribió en los campos
                            // estructurados (ej. "Avenida Carrera 21w #16a-25, Vallejo"), mientras que
                            // direccionFormateada es el string crudo que devolvió Google Places.
                            const addressWithSnakeCase = address as Address & { linea_uno?: string };
                            const displayAddress =
                              address.lineaUno ||
                              addressWithSnakeCase.linea_uno ||
                              address.direccionFormateada ||
                              address.nombreDireccion ||
                              'Dirección';

                            // Obtener campos adicionales
                            const localidad = address.localidad || '';
                            const barrio = address.barrio || '';
                            const ciudad = address.ciudad || '';
                            const complemento = address.complemento || '';
                            const instruccionesEntrega = address.instruccionesEntrega || '';

                            // Construir línea de ubicación
                            const ubicacion = [localidad, barrio, ciudad].filter(Boolean).join(', ');

                            return (
                              <div className="space-y-1">
                                <p className="font-medium text-gray-900">{displayAddress}</p>
                                {ubicacion && <p className="text-gray-500">{ubicacion}</p>}
                                {(complemento || instruccionesEntrega) && (
                                  <p className="text-gray-500 text-xs italic">
                                    {complemento && <span>Ref: {complemento}</span>}
                                    {complemento && instruccionesEntrega && ' • '}
                                    {instruccionesEntrega && <span>Observaciones: {instruccionesEntrega}</span>}
                                  </p>
                                )}
                              </div>
                            );
                          })()
                        : <p>No hay dirección seleccionada</p>}
                    </div>
                  )}
                </div>
                {onEditToggle && (
                  <button
                    type="button"
                    className="px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 transition self-start sm:self-center cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault();
                      // Si no está seleccionado "domicilio", cambiarlo primero
                      if (deliveryMethod !== "domicilio") {
                        onMethodChange("domicilio");
                      }
                      onEditToggle(true);
                    }}
                    disabled={addressLoading}
                  >
                    {address ? "Cambiar dirección" : "Seleccionar dirección"}
                  </button>
                )}
              </div>

              {/* Checkbox para indicar quién recibirá el producto - solo visible con envío a domicilio */}
              {deliveryMethod === "domicilio" && (
                <div className="ml-9 mt-4 space-y-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={receivedByClient}
                      onChange={(e) => handleReceivedByClientChange(e.target.checked)}
                      className="mt-1 w-4 h-4 accent-blue-600"
                    />
                    <div>
                      <div className="font-semibold text-gray-900">Será recibido por el cliente</div>
                      <div className="text-sm text-gray-600">
                        El producto será recibido por la persona que está realizando la compra
                      </div>
                    </div>
                  </label>

                  {/* Formulario para datos del receptor alternativo */}
                  {!receivedByClient && (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
                      <h3 className="font-semibold text-gray-900 mb-3">
                        Datos de la persona que recibirá el producto
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Nombre */}
                        <div>
                          <label htmlFor="recipient-firstName" className="block text-sm font-medium text-gray-700 mb-1">
                            Nombre <span className="text-red-500">*</span>
                          </label>
                          <input
                            id="recipient-firstName"
                            type="text"
                            value={recipientData.firstName}
                            onChange={(e) => handleRecipientDataChange("firstName", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                            placeholder="Ingresa el nombre"
                            required
                          />
                        </div>

                        {/* Apellido */}
                        <div>
                          <label htmlFor="recipient-lastName" className="block text-sm font-medium text-gray-700 mb-1">
                            Apellido <span className="text-red-500">*</span>
                          </label>
                          <input
                            id="recipient-lastName"
                            type="text"
                            value={recipientData.lastName}
                            onChange={(e) => handleRecipientDataChange("lastName", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                            placeholder="Ingresa el apellido"
                            required
                          />
                        </div>

                        {/* Correo electrónico */}
                        <div>
                          <label htmlFor="recipient-email" className="block text-sm font-medium text-gray-700 mb-1">
                            Correo electrónico <span className="text-red-500">*</span>
                          </label>
                          <input
                            id="recipient-email"
                            type="email"
                            value={recipientData.email}
                            onChange={(e) => handleRecipientDataChange("email", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                            placeholder="ejemplo@correo.com"
                            required
                          />
                        </div>

                        {/* Número de celular */}
                        <div>
                          <label htmlFor="recipient-phone" className="block text-sm font-medium text-gray-700 mb-1">
                            Número de celular <span className="text-red-500">*</span>
                          </label>
                          <input
                            id="recipient-phone"
                            type="tel"
                            value={recipientData.phone}
                            onChange={(e) => handleRecipientDataChange("phone", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                            placeholder="300 123 4567"
                            required
                          />
                        </div>
                      </div>

                      <p className="text-xs text-gray-500 mt-2">
                        * Campos obligatorios
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </label>
      </div>
    </div>
  );
};
