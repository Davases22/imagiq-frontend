import { useState, useEffect, useCallback, useRef } from 'react';
import { addressesService } from '@/services/addresses.service';
import type { Address, TipoUsoDireccion } from '@/types/address';

interface UseDefaultAddressReturn {
  address: Address | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => void;
}

// Cache global compartido entre instancias del hook
const cache = new Map<string, { data: Address | null; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
const ongoingRequests = new Map<string, Promise<Address | null>>();

/**
 * Hook para obtener la dirección predeterminada del usuario
 * - Obtiene SIEMPRE desde la BD (no localStorage)
 * - Cache de 5 minutos para evitar requests innecesarios
 * - Deduplicación de requests simultáneos
 * - Función invalidate() para forzar refresh
 *
 * @param tipo - Tipo de dirección (ENVIO, FACTURACION, AMBOS)
 */
export function useDefaultAddress(tipo: TipoUsoDireccion = 'ENVIO'): UseDefaultAddressReturn {
  const [address, setAddress] = useState<Address | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const isMountedRef = useRef(true);
  const cacheKey = `defaultAddress_${tipo}`;

  const fetchAddress = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Verificar cache
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        if (isMountedRef.current) {
          setAddress(cached.data);
          setIsLoading(false);
        }
        return;
      }

      // Verificar si ya hay una petición en curso
      let requestPromise = ongoingRequests.get(cacheKey);

      if (!requestPromise) {
        // Crear nueva petición
        requestPromise = addressesService.getDefaultAddress(tipo);
        ongoingRequests.set(cacheKey, requestPromise);
      }

      const data = await requestPromise;

      // Limpiar petición en curso
      ongoingRequests.delete(cacheKey);

      // Actualizar cache
      cache.set(cacheKey, { data, timestamp: Date.now() });

      if (isMountedRef.current) {
        setAddress(data);
        setIsLoading(false);
      }
    } catch (err) {
      // Limpiar petición en curso en caso de error
      ongoingRequests.delete(cacheKey);

      const error = err instanceof Error ? err : new Error('Error desconocido al obtener dirección');

      console.error('[useDefaultAddress] ❌ Error:', error);

      if (isMountedRef.current) {
        setError(error);
        setIsLoading(false);
      }
    }
  }, [tipo, cacheKey]);

  const invalidate = useCallback(() => {
    // Limpiar cache para forzar nuevo fetch
    cache.delete(cacheKey);
    // También limpiar cache de todas las direcciones relacionadas
    cache.forEach((_, key) => {
      if (key.startsWith('defaultAddress_')) {
        cache.delete(key);
      }
    });
    fetchAddress();
  }, [cacheKey, fetchAddress]);

  const refetch = useCallback(async () => {
    cache.delete(cacheKey);
    await fetchAddress();
  }, [cacheKey, fetchAddress]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchAddress();

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchAddress]);

  // Escuchar eventos globales de cambio de dirección para mantener sincronizada la UI (Navbar)
  useEffect(() => {
    const handleAddressChange = () => {
      // console.log('[useDefaultAddress] 🔄 Evento de cambio de dirección detectado, invalidando caché...');
      invalidate();
    };

    // Al cerrar sesión: el cache es GLOBAL (compartido entre usuarios), así que
    // hay que limpiarlo y borrar la dirección mostrada; si no, la navbar sigue
    // mostrando la dirección de la cuenta anterior (fuga de datos).
    const handleLogout = () => {
      cache.clear();
      ongoingRequests.clear();
      if (isMountedRef.current) {
        setAddress(null);
        setIsLoading(false);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('address-changed', handleAddressChange);
      window.addEventListener('checkout-address-changed', handleAddressChange);
      // Evento genérico que también podría dispararse
      window.addEventListener('address-updated', handleAddressChange);
      window.addEventListener('user-logout', handleLogout);

      return () => {
        window.removeEventListener('address-changed', handleAddressChange);
        window.removeEventListener('checkout-address-changed', handleAddressChange);
        window.removeEventListener('address-updated', handleAddressChange);
        window.removeEventListener('user-logout', handleLogout);
      };
    }
  }, [invalidate]);

  return {
    address,
    isLoading,
    error,
    refetch,
    invalidate,
  };
}

/**
 * Invalida el cache de direcciones predeterminadas globalmente
 * Útil para llamar después de crear, actualizar o eliminar direcciones
 */
export function invalidateDefaultAddressCache(): void {
  cache.clear();
  ongoingRequests.clear();
}
