/**
 * @module RegistrationAddressFormWithPlaceDetails
 * @description Enhanced address form that preserves PlaceDetails for comprehensive address saving
 */

import React, { useState } from 'react';
import AddressAutocomplete from './forms/AddressAutocomplete';
import AddressMap3D from './AddressMap3D';
import { PlaceDetails } from '@/types/places.types';
import { RegistrationAddress } from '@/types/registration';

interface AddressData {
  shippingAddress: PlaceDetails | null;
  billingAddress: PlaceDetails | null;
  useSameAddress: boolean;
  shippingName: string;
  shippingType: 'casa' | 'apartamento' | 'oficina' | 'otro';
  billingName: string;
  billingType: 'casa' | 'apartamento' | 'oficina' | 'otro';
  // Campos adicionales para dirección completa
  shippingComplement: string;
  shippingDeliveryInstructions: string;
  shippingReferencePoint: string;
  billingComplement: string;
  billingDeliveryInstructions: string;
  billingReferencePoint: string;
}

interface RegistrationAddressFormWithPlaceDetailsProps {
  /**
   * Datos actuales de dirección de envío
   */
  shippingAddress?: Partial<RegistrationAddress>;

  /**
   * Datos actuales de dirección de facturación
   */
  billingAddress?: Partial<RegistrationAddress>;

  /**
   * Si usar la misma dirección para facturación
   */
  useSameForBilling?: boolean;

  /**
   * Callback cuando cambian los datos de dirección (formato RegistrationAddress para compatibilidad)
   */
  onChange?: (data: {
    shippingAddress?: Partial<RegistrationAddress>;
    billingAddress?: Partial<RegistrationAddress>;
    useSameForBilling?: boolean;
  }) => void;

  /**
   * Callback cuando cambian los datos de PlaceDetails (para sistema completo)
   */
  onPlaceDetailsChange?: (data: {
    shippingPlaceDetails?: PlaceDetails;
    billingPlaceDetails?: PlaceDetails;
    shippingName?: string;
    shippingType?: string;
    billingName?: string;
    billingType?: string;
    shippingComplement?: string;
    shippingDeliveryInstructions?: string;
    shippingReferencePoint?: string;
    billingComplement?: string;
    billingDeliveryInstructions?: string;
    billingReferencePoint?: string;
  }) => void;
}

export const RegistrationAddressFormWithPlaceDetails: React.FC<RegistrationAddressFormWithPlaceDetailsProps> = (props) => {
  const { onChange, onPlaceDetailsChange } = props;
  const [addressData, setAddressData] = useState<AddressData>({
    shippingAddress: null,
    billingAddress: null,
    useSameAddress: true,
    shippingName: '',
    shippingType: 'casa',
    billingName: '',
    billingType: 'casa',
    // Campos adicionales para dirección completa
    shippingComplement: '',
    shippingDeliveryInstructions: '',
    shippingReferencePoint: '',
    billingComplement: '',
    billingDeliveryInstructions: '',
    billingReferencePoint: ''
  });

  // Helper para convertir PlaceDetails a RegistrationAddress
  const convertPlaceToRegistrationAddress = (place: PlaceDetails, name: string, type: string): RegistrationAddress => {
    const getAddressComponent = (componentTypes: string[]) => {
      const component = place.addressComponents?.find(comp =>
        componentTypes.some(type => comp.types.includes(type))
      );
      return component?.longName || component?.shortName || '';
    };

    const city = place.city || getAddressComponent(['locality', 'administrative_area_level_2', 'sublocality']);
    const state = place.department || getAddressComponent(['administrative_area_level_1']);
    const zipCode = place.postalCode || getAddressComponent(['postal_code']);

    return {
      type: type as 'home' | 'work' | 'other',
      name: name,
      addressLine1: place.formattedAddress,
      addressLine2: '',
      city: city || 'Bogotá',
      state: state || 'Cundinamarca',
      zipCode: zipCode || '110111',
      country: 'Colombia',
      isDefault: false
    };
  };

  // Helper para notificar cambios tanto en formato RegistrationAddress como PlaceDetails
  const notifyChanges = (updatedData: Partial<AddressData>) => {
    const mergedData = { ...addressData, ...updatedData };

    // Notificar formato RegistrationAddress para compatibilidad
    if (mergedData.shippingAddress) {
      const shippingAddressData = convertPlaceToRegistrationAddress(
        mergedData.shippingAddress,
        mergedData.shippingName || 'Dirección de envío',
        mergedData.shippingType
      );

      onChange?.({
        shippingAddress: shippingAddressData,
        billingAddress: mergedData.useSameAddress ? shippingAddressData : undefined,
        useSameForBilling: mergedData.useSameAddress
      });
    }

    // Notificar formato PlaceDetails para sistema completo
    onPlaceDetailsChange?.({
      shippingPlaceDetails: mergedData.shippingAddress || undefined,
      billingPlaceDetails: mergedData.billingAddress || undefined,
      shippingName: mergedData.shippingName,
      shippingType: mergedData.shippingType,
      billingName: mergedData.billingName,
      billingType: mergedData.billingType,
      shippingComplement: mergedData.shippingComplement,
      shippingDeliveryInstructions: mergedData.shippingDeliveryInstructions,
      shippingReferencePoint: mergedData.shippingReferencePoint,
      billingComplement: mergedData.billingComplement,
      billingDeliveryInstructions: mergedData.billingDeliveryInstructions,
      billingReferencePoint: mergedData.billingReferencePoint,
    });
  };

  const handleShippingAddressSelect = (place: PlaceDetails) => {
    console.log('✅ Dirección de envío seleccionada:', place);

    const updatedData = {
      shippingAddress: place,
      billingAddress: addressData.useSameAddress ? place : addressData.billingAddress
    };

    setAddressData(prev => ({ ...prev, ...updatedData }));
    notifyChanges(updatedData);
  };

  const handleBillingAddressSelect = (place: PlaceDetails) => {
    console.log('✅ Dirección de facturación seleccionada:', place);

    const updatedData = { billingAddress: place };
    setAddressData(prev => ({ ...prev, ...updatedData }));
    notifyChanges(updatedData);
  };

  const handleSameAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const useSameAddress = e.target.checked;
    const updatedData = {
      useSameAddress,
      billingAddress: useSameAddress ? addressData.shippingAddress : addressData.billingAddress
    };

    setAddressData(prev => ({ ...prev, ...updatedData }));
    notifyChanges(updatedData);
  };

  const handleFieldChange = (field: keyof AddressData, value: PlaceDetails | null | boolean | string) => {
    const updatedData = { [field]: value };
    setAddressData(prev => ({ ...prev, ...updatedData }));
    notifyChanges(updatedData);
  };

  return (
    <div className="space-y-6">
      {/* Dirección de Envío */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de dirección
            </label>
            <select
              value={addressData.shippingType}
              onChange={(e) => handleFieldChange('shippingType', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="casa">Casa</option>
              <option value="apartamento">Apartamento</option>
              <option value="oficina">Oficina</option>
              <option value="otro">Otro</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Dirección de Envío *
          </label>
          <AddressAutocomplete
            addressType="shipping"
            placeholder="Busca tu dirección (ej: Calle 80 # 15-25, Bogotá)"
            onPlaceSelect={handleShippingAddressSelect}
          />
        </div>

        {/* Campos adicionales para dirección de envío */}
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Complemento (Opcional)
            </label>
            <input
              type="text"
              value={addressData.shippingComplement}
              onChange={(e) => handleFieldChange('shippingComplement', e.target.value)}
              placeholder="ej: Apartamento 301, Torre B, Piso 2"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Instrucciones de entrega (Opcional)
            </label>
            <textarea
              value={addressData.shippingDeliveryInstructions}
              onChange={(e) => handleFieldChange('shippingDeliveryInstructions', e.target.value)}
              placeholder="ej: Portería 24 horas, llamar al celular al llegar, dejar con el vigilante"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Punto de referencia (Opcional)
            </label>
            <input
              type="text"
              value={addressData.shippingReferencePoint}
              onChange={(e) => handleFieldChange('shippingReferencePoint', e.target.value)}
              placeholder="ej: Frente al Centro Comercial Andino, al lado del banco"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Checkbox usar misma dirección */}
      <div>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={addressData.useSameAddress}
            onChange={handleSameAddressChange}
            className="mr-2 rounded"
          />
          <span className="text-sm text-gray-700">
            Usar la misma dirección para facturación
          </span>
        </label>
      </div>

      {/* Dirección de Facturación */}
      {!addressData.useSameAddress && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de dirección
              </label>
              <select
                value={addressData.billingType}
                onChange={(e) => handleFieldChange('billingType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="casa">Casa</option>
                <option value="apartamento">Apartamento</option>
                <option value="oficina">Oficina</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dirección de Facturación *
            </label>
            <AddressAutocomplete
              addressType="billing"
              placeholder="Busca tu dirección de facturación"
              onPlaceSelect={handleBillingAddressSelect}
            />
          </div>

          {/* Campos adicionales para dirección de facturación */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Complemento (Opcional)
              </label>
              <input
                type="text"
                value={addressData.billingComplement}
                onChange={(e) => handleFieldChange('billingComplement', e.target.value)}
                placeholder="ej: Apartamento 301, Torre B, Piso 2"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Instrucciones de entrega (Opcional)
              </label>
              <textarea
                value={addressData.billingDeliveryInstructions}
                onChange={(e) => handleFieldChange('billingDeliveryInstructions', e.target.value)}
                placeholder="ej: Horario de oficina, llamar antes de llegar"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Punto de referencia (Opcional)
              </label>
              <input
                type="text"
                value={addressData.billingReferencePoint}
                onChange={(e) => handleFieldChange('billingReferencePoint', e.target.value)}
                placeholder="ej: Edificio azul, junto al semáforo"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      )}

      {/* Mapa 3D de la dirección seleccionada */}
      {addressData.shippingAddress && (
        <div>
          <AddressMap3D
            address={addressData.shippingAddress}
            height="250px"
            enable3D={true}
            showControls={false}
          />
        </div>
      )}
    </div>
  );
};

export default RegistrationAddressFormWithPlaceDetails;