// Caché en memoria para el valor global de canPickUp del carrito
// Se comparte entre Step1 y Step3 para evitar llamar dos veces seguidas
// al endpoint /api/products/candidate-stores con el mismo estado.
// Ahora guarda toda la respuesta completa (canPickUp, stores, cities) para evitar skeleton al cambiar a "tienda"
//
// OPTIMIZACIÓN: El caché se llena SOLO en Step1 y al cambiar dirección.
// Los demás steps (2-6) SOLO leen del caché sin hacer llamadas nuevas.
//
// PERSISTENCIA: Se guarda en localStorage para sobrevivir a recargas de página en pasos 4-6.

import type { CandidateStoresResponse } from "@/lib/api";

interface CacheKeyInput {
  userId?: string | null;
  products: { sku: string; quantity: number }[];
  addressId?: string | null;
}

interface CacheEntry {
  key: string;
  value: boolean; // canPickUp boolean (para compatibilidad con código existente)
  fullResponse: CandidateStoresResponse | null; // Respuesta completa del endpoint
  timestamp: number;
  addressId: string | null; // Para detectar cambios de dirección
}

const TTL_MS = 10 * 60 * 1000; // 10 minutos (aumentado para mejor rendimiento)
const LOCAL_STORAGE_KEY = "imagiq_candidate_stores_cache";

let cache: CacheEntry | null = null;

/**
 * Fallback del guard de Step3: ¿existe ALGÚN caché vigente (TTL) de este usuario,
 * aunque la clave exacta (dirección / composición del carrito) no coincida?
 * Rescata los mismatches de addressId o de items entre el escritor (Step1/useDelivery)
 * y el lector (guard de step3) sin abrir el guard por completo. Reemplaza al antiguo
 * fallback que buscaba el prefijo "global_canPickUp_" que ningún código escribía.
 */
export function hasAnyCacheForUser(userId: string): boolean {
  if (!userId) return false;
  const prefix = `${userId}::`;
  if (cache && Date.now() - cache.timestamp <= TTL_MS && cache.key.startsWith(prefix)) {
    return true;
  }
  if (typeof window === "undefined") return false;
  try {
    const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!stored) return false;
    const parsed = JSON.parse(stored) as CacheEntry;
    return (
      typeof parsed?.key === "string" &&
      Date.now() - parsed.timestamp <= TTL_MS &&
      parsed.key.startsWith(prefix)
    );
  } catch {
    return false;
  }
}

// Flag global para evitar llamadas múltiples simultáneas
let isFetching = false;

export function buildGlobalCanPickUpKey(input: CacheKeyInput): string {
  const userPart = input.userId ?? "anonymous";
  const addressPart = input.addressId ?? "no-address";

  // Ordenar productos por SKU para que la clave sea estable
  const productsPart = [...input.products]
    .sort((a, b) => a.sku.localeCompare(b.sku))
    .map((p) => `${p.sku}:${p.quantity}`)
    .join("|");

  return `${userPart}::${addressPart}::${productsPart}`;
}

/**
 * Intenta cargar el caché desde localStorage si no está en memoria
 */
function loadFromLocalStorage(): void {
  if (typeof window === "undefined") return;

  try {
    const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as CacheEntry;
      // Validar TTL
      if (Date.now() - parsed.timestamp <= TTL_MS) {
        cache = parsed;
        // console.log('📦 [Cache] Restaurado desde localStorage:', { key: cache.key.substring(0, 30) + '...' });
      } else {
        // console.log('🗑️ [Cache] Datos en localStorage expirados');
        window.localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    }
  } catch (error) {
    console.error("Error cargando caché desde localStorage:", error);
  }
}

/**
 * Guarda el caché actual en localStorage
 */
function saveToLocalStorage(): void {
  if (typeof window === "undefined" || !cache) return;

  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error("Error guardando caché en localStorage:", error);
  }
}

export function getGlobalCanPickUpFromCache(key: string): boolean | null {
  // Si no hay caché en memoria, intentar cargar de localStorage
  if (!cache) {
    loadFromLocalStorage();
  }

  if (!cache) {
    return null;
  }
  if (cache.key !== key) {
    return null;
  }

  const isExpired = Date.now() - cache.timestamp > TTL_MS;
  if (isExpired) {
    cache = null;
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
    return null;
  }

  return cache.value;
}

/**
 * Obtiene la respuesta completa del caché (tiendas, ciudades, canPickUp)
 * Útil para evitar skeleton al cambiar a "recoger en tienda"
 */
export function getFullCandidateStoresResponseFromCache(key: string): CandidateStoresResponse | null {
  // console.log('🔍 [Cache] getFullCandidateStoresResponseFromCache llamada');
  // console.log('🔍 [Cache] key solicitada:', key.substring(0, 80) + '...');

  // Si no hay caché en memoria, intentar cargar de localStorage
  if (!cache) {
    // console.log('🔍 [Cache] No hay caché en memoria, intentando localStorage...');
    loadFromLocalStorage();
  }

  if (!cache) {
    // console.log('⚠️ [Cache] No hay caché disponible');
    return null;
  }

  // console.log('🔍 [Cache] cache.key actual:', cache.key.substring(0, 80) + '...');
  // console.log('🔍 [Cache] Keys coinciden?', cache.key === key);

  if (cache.key !== key) {
    // console.log('⚠️ [Cache] Keys NO coinciden, retornando null');
    // console.log('🔍 [Cache] Diferencias:', {
//       keyLength: key.length,
//       cacheKeyLength: cache.key.length,
//       first50Match: key.substring(0, 50) === cache.key.substring(0, 50)
//     });
    // DEBUG DETALLADO: Mostrar keys completas para identificar la diferencia exacta
    // console.log('🔍 [Cache] KEY SOLICITADA COMPLETA:', key);
    // console.log('🔍 [Cache] KEY EN CACHÉ COMPLETA:', cache.key);
    // Encontrar el primer carácter diferente
    for (let i = 0; i < Math.max(key.length, cache.key.length); i++) {
      if (key[i] !== cache.key[i]) {
        // console.log('🔍 [Cache] PRIMERA DIFERENCIA en posición', i, ':', {
//           keyChar: key[i],
//           cacheChar: cache.key[i],
//           keyCharCode: key.charCodeAt(i),
//           cacheCharCode: cache.key.charCodeAt(i),
//           contextoKey: key.substring(Math.max(0, i-5), i+10),
//           contextoCacheKey: cache.key.substring(Math.max(0, i-5), i+10)
//         });
        break;
      }
    }
    return null;
  }

  const isExpired = Date.now() - cache.timestamp > TTL_MS;
  if (isExpired) {
    // console.log('⚠️ [Cache] Caché expirado');
    cache = null;
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
    return null;
  }

  // console.log('✅ [Cache] Retornando fullResponse:', {
//     hasStores: !!cache.fullResponse?.stores,
//     canPickUp: cache.fullResponse?.canPickUp
//   });
  return cache.fullResponse;
}

// Throttle para eventos de cache update
let lastEventTime = 0;
const MIN_EVENT_INTERVAL = 50; // ms - casi instantáneo pero protege contra bucles infinitos muy cerrados

export function setGlobalCanPickUpCache(
  key: string,
  value: boolean,
  fullResponse?: CandidateStoresResponse | null,
  addressId?: string | null
): void {
  cache = {
    key,
    value,
    fullResponse: fullResponse ?? null,
    timestamp: Date.now(),
    addressId: addressId ?? null,
  };

  // Persistir en localStorage
  saveToLocalStorage();



  // Disparar evento con throttle para evitar bursts
  if (typeof window !== 'undefined') {
    const now = Date.now();
    if (now - lastEventTime >= MIN_EVENT_INTERVAL) {
      lastEventTime = now;
      window.dispatchEvent(new CustomEvent('canPickUpCache-updated', {
        detail: { key, value, addressId }
      }));
    } else {
      // Si el intervalo es muy corto, agendar el evento para después
      setTimeout(() => {
        lastEventTime = Date.now();
        window.dispatchEvent(new CustomEvent('canPickUpCache-updated', {
          detail: { key, value, addressId }
        }));
      }, MIN_EVENT_INTERVAL - (now - lastEventTime));
    }
  }
}

export function clearGlobalCanPickUpCache(): void {
  cache = null;
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(LOCAL_STORAGE_KEY);
  }
}

/**
 * Verifica si el caché es válido para una clave dada
 */
export function isCacheValid(key: string): boolean {
  // Si no hay caché en memoria, intentar cargar de localStorage
  if (!cache) {
    loadFromLocalStorage();
  }

  if (!cache) return false;
  if (cache.key !== key) return false;

  const isExpired = Date.now() - cache.timestamp > TTL_MS;
  if (isExpired) {
    cache = null;
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
    return false;
  }

  return true;
}

/**
 * Invalida el caché si la dirección cambió
 * Retorna true si se invalidó, false si no era necesario
 */
export function invalidateCacheOnAddressChange(newAddressId: string | null): boolean {
  // Si no hay caché en memoria, intentar cargar de localStorage
  if (!cache) {
    loadFromLocalStorage();
  }

  if (!cache) {
    return false;
  }

  // Si la dirección cambió, invalidar caché
  if (cache.addressId !== newAddressId) {
    cache = null;
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
    return true;
  }

  return false;
}

/**
 * Obtiene el addressId del caché actual
 */
export function getCurrentCachedAddressId(): string | null {
  if (!cache) {
    loadFromLocalStorage();
  }
  return cache?.addressId ?? null;
}

/**
 * Establece el flag de fetching para evitar llamadas duplicadas
 */
export function setIsFetching(value: boolean): void {
  isFetching = value;
}

/**
 * Verifica si hay una petición en curso
 */
export function getIsFetching(): boolean {
  return isFetching;
}


