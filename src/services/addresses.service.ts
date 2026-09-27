/**
 * @module addresses.service
 * @description Servicio para interactuar con el API de direcciones del backend
 */

import { PlaceDetails } from "@/types/places.types";
import type { Address } from "@/types/address";
import { safeGetLocalStorage } from "@/lib/localStorage";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client";

/** Mensaje que ve el cliente cuando intenta guardar una dirección sin haber dado su correo. */
export const MENSAJE_SIN_USUARIO =
  "Para guardar una dirección primero inicia sesión o ingresa tu correo en el checkout.";

export class SinUsuarioError extends Error {
  readonly code = "USUARIO_INVALIDO" as const;
  constructor() {
    super(MENSAJE_SIN_USUARIO);
    this.name = "SinUsuarioError";
  }
}

/**
 * UUID del usuario (imagiq_user, dirección guardada) o su correo como respaldo.
 * Nunca un id inventado: si no hay nada, el llamador debe pedir el correo.
 */
export function resolverUsuarioId(userInfo: { id?: string; email?: string }): string | null {
  if (userInfo.id) return userInfo.id;
  if (typeof window !== "undefined") {
    for (const clave of ["checkout-address", "imagiq_default_address"]) {
      try {
        const guardado = JSON.parse(localStorage.getItem(clave) || "null");
        if (guardado?.usuario_id) return String(guardado.usuario_id);
      } catch {
        /* valor corrupto: se ignora */
      }
    }
  }
  if (userInfo.email) return userInfo.email;
  return null;
}

/**
 * Interface para crear una nueva dirección
 */
export interface CreateAddressRequest {
  nombreDireccion: string;
  tipoDireccion: "casa" | "apartamento" | "oficina" | "otro";
  tipo: "ENVIO" | "FACTURACION" | "AMBOS";
  esPredeterminada?: boolean;
  placeDetails: PlaceDetails;
  // Campos estructurados de la dirección (siguiendo formato Samsung)
  departamento?: string;
  ciudad?: string; // Ciudad seleccionada por el usuario (código DANE)
  nombreCalle?: string;
  numeroPrincipal?: string;
  numeroSecundario?: string;
  numeroComplementario?: string;
  barrio?: string;
  setsReferencia?: string; // Antes "puntoReferencia"
  instruccionesEntrega?: string;
  // Campos legacy (mantener por compatibilidad)
  complemento?: string;
  puntoReferencia?: string;
  usuarioId?: string; // Para usuarios invitados sin JWT
}

/**
 * Interface para la respuesta de dirección (compatibilidad)
 * @deprecated Use Address type from @/types/address instead
 */
export type AddressResponse = Address;

/**
 * Clase de servicio para direcciones
 */
export class AddressesService {
  private static instance: AddressesService;

  /**
   * Constructor privado para implementar Singleton
   */
  private constructor() {}

  /**
   * Obtiene la instancia única del servicio
   */
  public static getInstance(): AddressesService {
    if (!AddressesService.instance) {
      AddressesService.instance = new AddressesService();
    }
    return AddressesService.instance;
  }

  /**
   * Crea una nueva dirección
   */
  public async createAddress(
    addressData: CreateAddressRequest
  ): Promise<Address> {
    try {
      // Obtener información del usuario del localStorage
      const userInfo = safeGetLocalStorage<{ id?: string; email?: string }>(
        "imagiq_user",
        {}
      );
      const requestData = { ...addressData };

      // SIEMPRE incluir usuarioId explícitamente: el UUID del usuario o, si aún no
      // lo tenemos, su correo (el backend lo resuelve). Antes, sin usuario en
      // localStorage, se inventaba un "guest_<fecha>_<aleatorio>": ese valor no
      // corresponde a nadie, addresses-ms lo rechaza y el cliente veía un 500.
      const usuarioId = resolverUsuarioId(userInfo);
      if (!usuarioId) throw new SinUsuarioError();
      requestData.usuarioId = usuarioId;
      // Verificar si es la primera dirección del usuario
      const existingAddresses = await this.getUserAddresses();
      const isFirstAddress = existingAddresses.length === 0;

      console.log("📤 Enviando datos de dirección:", {
        ...requestData,
        placeDetails: requestData.placeDetails ? "PlaceDetails object" : "null",
        isFirstAddress,
        existingAddressesCount: existingAddresses.length,
      });

      // Log detallado del body que se enviará
      console.log(
        "📦 Body completo que se enviará al backend:",
        JSON.stringify(requestData, null, 2)
      );

      const result = await apiPost<Address>("/api/addresses", requestData);
      console.log("✅ Dirección creada exitosamente:", result);

      // Si es la primera dirección O si se marcó como predeterminada,
      // llamar a setDefaultAddress para desactivar las demás
      if (isFirstAddress || addressData.esPredeterminada) {
        try {
          const reason = isFirstAddress
            ? "Es la primera dirección"
            : "Fue marcada como predeterminada";
          console.log(
            `🔄 ${reason}, estableciendo como predeterminada y desactivando las demás...`
          );
          const defaultAddress = await this.setDefaultAddress(result.id);
          console.log(
            "✅ Dirección marcada como predeterminada:",
            defaultAddress.nombreDireccion
          );
          return defaultAddress;
        } catch (setDefaultError) {
          console.error(
            "⚠️ Error estableciendo dirección como predeterminada:",
            setDefaultError
          );
          // No lanzar error, la dirección ya fue creada exitosamente
          // El usuario puede establecerla manualmente como predeterminada si es necesario
        }
      }

      return result;
    } catch (error: unknown) {
      console.error("❌ Error creando dirección:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Error desconocido creando dirección";
      throw new Error(errorMessage);
    }
  }

  /**
   * Obtiene todas las direcciones del usuario
   */
  public async getUserAddresses(): Promise<Address[]> {
    try {
      // El backend requiere usuarioId siempre (con o sin token JWT)
      const userInfo = safeGetLocalStorage<{ id?: string; email?: string }>(
        "imagiq_user",
        {}
      );

      let endpoint = "/api/addresses";

      if (userInfo.id) {
        endpoint += `?usuarioId=${encodeURIComponent(userInfo.id)}`;
      } else if (userInfo.email) {
        endpoint += `?usuarioId=${encodeURIComponent(userInfo.email)}`;
      } else {
        // Si no hay userInfo, retornar array vacío
        console.warn("No hay información de usuario para obtener direcciones");
        return [];
      }

      const data = await apiGet<Address[]>(endpoint);
      return data;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Error obteniendo direcciones";
      console.error("Error en getUserAddresses:", errorMessage);
      // Retornar array vacío en lugar de lanzar error
      return [];
    }
  }

  /**
   * Obtiene direcciones por tipo
   */
  public async getUserAddressesByType(
    tipo: "ENVIO" | "FACTURACION" | "AMBOS",
    usuarioId: string
  ): Promise<Address[]> {
    try {
      return await apiGet<Address[]>(
        `/api/addresses/by-type/${tipo}?usuarioId=${usuarioId}`
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Error obteniendo direcciones por tipo";
      throw new Error(errorMessage);
    }
  }

  /**
   * Obtiene la dirección predeterminada por tipo
   */
  public async getDefaultAddress(
    tipo: "ENVIO" | "FACTURACION" | "AMBOS"
  ): Promise<Address | null> {
    try {
      // Obtener información del usuario del localStorage
      const userInfo = safeGetLocalStorage<{ id?: string; email?: string }>(
        "imagiq_user",
        {}
      );

      if (!userInfo.id && !userInfo.email) {
        console.warn(
          "No hay información de usuario para obtener dirección predeterminada"
        );
        return null;
      }

      const usuarioId = userInfo.id || userInfo.email || "";
      const endpoint = `/api/addresses/default/${tipo}?usuarioId=${encodeURIComponent(
        usuarioId
      )}`;

      return await apiGet<Address>(endpoint);
    } catch {
      return null;
    }
  }

  /**
   * Actualiza una dirección existente
   */
  public async updateAddress(
    addressId: string,
    updateData: Partial<CreateAddressRequest>
  ): Promise<Address> {
    try {
      return await apiPut<Address>(`/api/addresses/${addressId}`, updateData);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Error actualizando dirección";
      throw new Error(errorMessage);
    }
  }

  /**
   * Desactiva una dirección
   */
  public async deactivateAddress(
    addressId: string
  ): Promise<{ message: string }> {
    try {
      const userInfo = safeGetLocalStorage<{ id?: string; email?: string }>(
        "imagiq_user",
        {}
      );
      const usuarioId = userInfo.id || userInfo.email || "";
      if (!usuarioId) {
        throw new Error("No se encontró información del usuario.");
      }
      return await apiDelete<{ message: string }>(
        `/api/addresses/${addressId}?usuarioId=${encodeURIComponent(usuarioId)}`
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desactivando dirección";
      throw new Error(errorMessage);
    }
  }

  /**
   * Elimina físicamente una dirección de usuario
   * Si la dirección eliminada era predeterminada, establece otra dirección como predeterminada automáticamente
   * @param addressId - ID de la dirección a eliminar
   * @returns Mensaje de confirmación
   */
  public async deleteAddress(addressId: string): Promise<{ message: string }> {
    try {
      // Obtener información del usuario del localStorage
      const userInfo = safeGetLocalStorage<{ id?: string; email?: string }>(
        "imagiq_user",
        {}
      );

      if (!userInfo.id && !userInfo.email) {
        throw new Error(
          "No se encontró información del usuario. Por favor, inicia sesión nuevamente."
        );
      }

      const usuarioId = userInfo.id || userInfo.email || "";

      // Obtener todas las direcciones antes de eliminar para verificar si la eliminada era predeterminada
      const allAddresses = await this.getUserAddresses();
      const addressToDelete = allAddresses.find(
        (addr) => addr.id === addressId
      );
      const wasDefault = addressToDelete?.esPredeterminada || false;
      const totalAddresses = allAddresses.length;

      // Eliminar la dirección
      const endpoint = `/api/addresses/${addressId}?usuarioId=${encodeURIComponent(
        usuarioId
      )}`;

      console.log("🗑️ Eliminando dirección:", {
        addressId,
        usuarioId,
        endpoint,
        wasDefault,
        totalAddresses,
      });

      const result = await apiDelete<{ message: string }>(endpoint);

      // Si la dirección eliminada era predeterminada y quedan otras direcciones, establecer una nueva como predeterminada
      // Si no hay más direcciones, simplemente se elimina y ya está
      if (wasDefault && totalAddresses > 1) {
        // Obtener las direcciones restantes después de la eliminación
        const remainingAddresses = allAddresses.filter(
          (addr) => addr.id !== addressId
        );

        if (remainingAddresses.length > 0) {
          // Buscar la primera dirección disponible que no sea la eliminada
          const newDefaultAddress = remainingAddresses[0];

          try {
            console.log(
              `🔄 Estableciendo nueva dirección predeterminada: ${newDefaultAddress.id} (${newDefaultAddress.nombreDireccion})`
            );
            const updatedAddress = await this.setDefaultAddress(
              newDefaultAddress.id
            );
            console.log(
              `✅ Nueva dirección predeterminada establecida en la base de datos:`,
              {
                id: updatedAddress.id,
                nombreDireccion: updatedAddress.nombreDireccion,
                esPredeterminada: updatedAddress.esPredeterminada,
              }
            );
          } catch (setDefaultError) {
            console.error(
              "⚠️ Error estableciendo nueva dirección predeterminada:",
              setDefaultError
            );
            // Re-lanzar el error para que el usuario sepa que hubo un problema
            throw new Error(
              `La dirección fue eliminada, pero hubo un error al establecer otra como predeterminada: ${
                setDefaultError instanceof Error
                  ? setDefaultError.message
                  : "Error desconocido"
              }`
            );
          }
        }
      } else if (totalAddresses === 1) {
        // Si era la única dirección, simplemente se elimina y ya está
        console.log(
          "ℹ️ Se eliminó la última dirección. No hay más direcciones para establecer como predeterminada."
        );
      }

      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Error eliminando dirección";
      throw new Error(errorMessage);
    }
  }

  /**
   * Incrementa el contador de uso de una dirección
   */
  public async incrementUsageCount(
    addressId: string
  ): Promise<{ message: string }> {
    try {
      return await apiPost<{ message: string }>(
        `/api/addresses/${addressId}/increment-usage`,
        {}
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Error incrementando contador de uso";
      throw new Error(errorMessage);
    }
  }

  /**
   * Crea una nueva dirección SIN establecerla como predeterminada
   * Útil para agregar direcciones de facturación desde Step6 sin afectar
   * la dirección predeterminada actual
   */
  public async createAddressWithoutDefault(
    addressData: CreateAddressRequest
  ): Promise<Address> {
    try {
      // Obtener información del usuario del localStorage
      const userInfo = safeGetLocalStorage<{ id?: string; email?: string }>(
        "imagiq_user",
        {}
      );
      const requestData = { ...addressData };

      // SIEMPRE incluir usuarioId explícitamente
      if (userInfo.id) {
        requestData.usuarioId = userInfo.id;
        console.log("✅ createAddressWithoutDefault: Usando userInfo.id:", requestData.usuarioId);
      } else if (userInfo.email) {
        requestData.usuarioId = userInfo.email;
        console.log("✅ createAddressWithoutDefault: Usando userInfo.email:", requestData.usuarioId);
      } else {
        throw new Error(
          "No se encontró información del usuario. Por favor, inicia sesión nuevamente."
        );
      }

      // Forzar esPredeterminada a false para no afectar la dirección actual
      requestData.esPredeterminada = false;

      console.log("📤 [createAddressWithoutDefault] Creando dirección sin establecer como default:", {
        ...requestData,
        placeDetails: requestData.placeDetails ? "PlaceDetails object" : "null",
      });

      const result = await apiPost<Address>("/api/addresses", requestData);
      console.log("✅ [createAddressWithoutDefault] Dirección creada exitosamente (NO es default):", result);

      // NO llamar a setDefaultAddress - retornar directamente
      return result;
    } catch (error: unknown) {
      console.error("❌ Error creando dirección (sin default):", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Error desconocido creando dirección";
      throw new Error(errorMessage);
    }
  }

  /**
   * Establece una dirección como predeterminada
   * Desmarca otras direcciones predeterminadas del mismo tipo automáticamente
   *
   * @param addressId - ID de la dirección a establecer como predeterminada
   * @returns Dirección actualizada
   */
  public async setDefaultAddress(addressId: string): Promise<Address> {
    try {
      // Obtener información del usuario del localStorage
      const userInfo = safeGetLocalStorage<{ id?: string; email?: string }>(
        "imagiq_user",
        {}
      );

      if (!userInfo.id && !userInfo.email) {
        throw new Error(
          "No se encontró información del usuario. Por favor, inicia sesión nuevamente."
        );
      }

      const usuarioId = userInfo.id || userInfo.email || "";
      const endpoint = `/api/addresses/${addressId}/set-default?usuarioId=${encodeURIComponent(
        usuarioId
      )}`;

      return await apiPost<Address>(endpoint, {});
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Error estableciendo dirección predeterminada";
      throw new Error(errorMessage);
    }
  }
}

// Exportar instancia única
export const addressesService = AddressesService.getInstance();
