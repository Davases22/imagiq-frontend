/**
 * Utility centralizada para sincronizar direcciones entre el header y el checkout
 * Asegura que todos los cambios de dirección se propaguen consistentemente
 */

import type { Address } from "@/types/address";
import type { Direccion } from "@/types/user";
import { addressesService } from "@/services/addresses.service";
import { invalidateShippingOriginCache } from "@/hooks/useShippingOrigin";
import { invalidateDefaultAddressCache } from "@/hooks/useDefaultAddress";

/**
 * Convierte Address (nuevo formato) a Direccion (formato legacy)
 */
export function addressToDireccion(address: Partial<Address> & Pick<Address, 'id'>, userEmail?: string): Direccion {
  return {
    id: address.id,
    usuario_id: address.usuarioId || "",
    email: userEmail || "",
    // linea_uno tiene prioridad sobre direccionFormateada para que la dirección
    // que se muestre en la UI refleje lo que el usuario escribió (incluyendo
    // número de casa y barrio) y no la versión simplificada de Google Places.
    linea_uno: address.lineaUno || address.direccionFormateada || "",
    codigo_dane: address.codigo_dane || "",
    ciudad: address.ciudad || "",
    pais: address.pais || "Colombia",
    esPredeterminada: true,
    // Campos adicionales para mostrar detalles en Step3
    direccionFormateada: address.direccionFormateada || "",
    lineaUno: address.lineaUno || "",
    localidad: address.localidad || "",
    barrio: address.barrio || "",
    complemento: address.complemento || "",
    instruccionesEntrega: address.instruccionesEntrega || "",
    tipoDireccion: address.tipoDireccion || "",
    nombreDireccion: address.nombreDireccion || "",
    // Google Maps
    googleUrl: address.googleUrl || "",
    googlePlaceId: address.googlePlaceId || "",
    latitud: address.latitud || 0,
    longitud: address.longitud || 0,
  };
}

/**
 * Convierte Direccion (formato legacy) a Address (nuevo formato)
 */
export function direccionToAddress(direccion: Direccion): Partial<Address> & Pick<Address, 'id' | 'usuarioId'> {
  return {
    id: direccion.id || "",
    usuarioId: direccion.usuario_id || "",
    nombreDireccion: direccion.nombreDireccion || direccion.linea_uno || "Dirección",
    direccionFormateada: direccion.direccionFormateada || direccion.linea_uno || "",
    lineaUno: direccion.lineaUno || direccion.linea_uno || "",
    codigo_dane: direccion.codigo_dane || "",
    ciudad: direccion.ciudad || "",
    pais: direccion.pais || "Colombia",
    esPredeterminada: direccion.esPredeterminada ?? true,
    // Campos adicionales
    localidad: direccion.localidad || "",
    barrio: direccion.barrio || "",
    complemento: direccion.complemento || "",
    instruccionesEntrega: direccion.instruccionesEntrega || "",
    tipoDireccion: direccion.tipoDireccion as Address['tipoDireccion'],
  };
}

/**
 * Opciones para la sincronización de direcciones
 */
export interface SyncAddressOptions {
  /** La dirección a sincronizar (en formato Address o Partial) */
  address: Partial<Address> & Pick<Address, 'id'>;
  /** Email del usuario (opcional) */
  userEmail?: string;
  /** Objeto user completo para actualizar el context */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user?: any;
  /** Función login del context para actualizar el estado global */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loginFn?: (user: any) => Promise<void>;
  /** Indica si el cambio viene del header (true) o del checkout (false) */
  fromHeader?: boolean;
}

/**
 * Sincroniza una dirección en todos los puntos necesarios:
 * 1. Actualiza dirección predeterminada en el backend
 * 2. Invalida caches de hooks (useDefaultAddress, useShippingOrigin)
 * 3. Actualiza localStorage (checkout-address, imagiq_default_address)
 * 4. Actualiza el context global del usuario
 * 5. Dispara eventos para notificar a otros componentes
 *
 * @param options - Opciones de sincronización
 * @returns Promise que se resuelve cuando la sincronización está completa
 */
export async function syncAddress(options: SyncAddressOptions): Promise<void> {
  const { address, userEmail, user, loginFn, fromHeader = false } = options;

  console.log(`🔄 Iniciando sincronización de dirección desde ${fromHeader ? 'header' : 'checkout'}:`, address);

  try {
    // 1. Actualizar dirección predeterminada en el backend
    if (address.id) {
      console.log('📡 Actualizando dirección predeterminada en el backend...');
      await addressesService.setDefaultAddress(address.id);
      console.log('✅ Dirección actualizada en el backend');
    }

    // 2. Invalidar caches de hooks
    console.log('🗑️ Invalidando caches...');
    invalidateDefaultAddressCache();
    invalidateShippingOriginCache();
    console.log('✅ Caches invalidados');

    // 3. Convertir Address a Direccion para localStorage
    const checkoutAddress = addressToDireccion(address, userEmail);

    // 4. Guardar en localStorage
    console.log('💾 Guardando en localStorage...');
    console.log('📍 [syncAddress] Address original:', {
      id: address.id,
      latitud: address.latitud,
      longitud: address.longitud,
      googleUrl: address.googleUrl
    });
    console.log('📍 [syncAddress] checkoutAddress convertido:', {
      id: checkoutAddress.id,
      latitud: checkoutAddress.latitud,
      longitud: checkoutAddress.longitud,
      googleUrl: checkoutAddress.googleUrl
    });
    localStorage.setItem('checkout-address', JSON.stringify(checkoutAddress));
    localStorage.setItem('imagiq_default_address', JSON.stringify(checkoutAddress));
    console.log('✅ Guardado en localStorage');

    // 5. Actualizar context global del usuario (si se proporcionó)
    if (user && loginFn) {
      console.log('🔄 Actualizando context global...');
      const defaultAddressFormat = {
        id: address.id,
        nombreDireccion: address.nombreDireccion,
        direccionFormateada: address.direccionFormateada,
        ciudad: address.ciudad,
        departamento: address.departamento,
        esPredeterminada: true,
      };

      await loginFn({
        ...user,
        defaultAddress: defaultAddressFormat,
      });
      console.log('✅ Context global actualizado');
    }

    // 6. Disparar eventos para notificar a otros componentes
    console.log('🔔 Disparando eventos de sincronización...');

    // Evento genérico de cambio de dirección
    console.log('🚨🚨🚨 [syncAddress] A PUNTO DE DISPARAR address-changed event', { address, fromHeader });
    window.dispatchEvent(new CustomEvent('address-changed', {
      detail: {
        address,
        fromHeader,
        fromCheckout: !fromHeader
      }
    }));
    console.log('✅ [syncAddress] Evento address-changed DISPARADO exitosamente');

    // Evento específico de checkout
    window.dispatchEvent(new CustomEvent('checkout-address-changed', {
      detail: {
        checkout: !fromHeader,
        address: checkoutAddress,
        fromHeader
      }
    }));

    // Evento storage para compatibilidad
    window.dispatchEvent(new Event('storage'));

    console.log('✅ Eventos disparados correctamente');
    console.log('🎉 Sincronización de dirección completada exitosamente');

  } catch (error) {
    console.error('❌ Error durante la sincronización de dirección:', error);
    throw error; // Re-lanzar el error para que el componente lo maneje
  }
}

/**
 * Sincroniza la eliminación de una dirección
 * Invalida caches y dispara eventos necesarios
 */
export function syncAddressDeleted(): void {
  console.log('🗑️ Sincronizando eliminación de dirección...');

  // Invalidar caches
  invalidateDefaultAddressCache();
  invalidateShippingOriginCache();

  // Disparar eventos
  window.dispatchEvent(new CustomEvent('address-changed', {
    detail: { address: null, deleted: true }
  }));
  window.dispatchEvent(new Event('storage'));

  console.log('✅ Eliminación sincronizada');
}

/**
 * Sincroniza la adición de una nueva dirección
 * Similar a syncAddress pero optimizado para direcciones nuevas
 */
export async function syncNewAddress(options: SyncAddressOptions): Promise<void> {
  console.log('🆕 Sincronizando nueva dirección...');

  // Usar la misma lógica que syncAddress
  await syncAddress(options);

  console.log('✅ Nueva dirección sincronizada');
}
