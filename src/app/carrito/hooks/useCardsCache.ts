"use client";
import { useState, useCallback } from "react";
import { profileService } from "@/services/profile.service";
import { useAuthContext } from "@/features/auth/context";
import { DBCard, DecryptedCardData } from "@/features/profile/types";
import { encryptionService } from "@/lib/encryption";
import { checkZeroInterest } from "../utils";
import { CheckZeroInterestResponse } from "../types";
import useSecureStorage from "@/hooks/useSecureStorage";
import { User } from "@/types/user";

// Caché en memoria para las tarjetas
let cardsCache: {
  data: DBCard[] | null;
  timestamp: number;
  userId: string | null;
} = {
  data: null,
  timestamp: 0,
  userId: null,
};

// Caché en memoria para zero interest
let zeroInterestCache: {
  data: CheckZeroInterestResponse | null;
  timestamp: number;
  userId: string | null;
  cacheKey: string | null; // Para identificar qué se cacheó (cardIds + productSkus + total)
} = {
  data: null,
  timestamp: 0,
  userId: null,
  cacheKey: null,
};

// Tiempo de validez del caché (5 minutos)
const CACHE_DURATION = 5 * 60 * 1000;

export function useCardsCache() {
  const authContext = useAuthContext();
  const [savedCards, setSavedCards] = useState<DBCard[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState(false);
  const [zeroInterestData, setZeroInterestData] = useState<CheckZeroInterestResponse | null>(null);
  const [isLoadingZeroInterest, setIsLoadingZeroInterest] = useState(false);
  // Hook para obtener usuario del localStorage (para usuarios sin sesión activa pero con cuenta creada en Step2)
  const [loggedUser] = useSecureStorage<User | null>("imagiq_user", null);

  // Helper para obtener el userId (autenticado o invitado)
  const getUserId = useCallback((): string | null => {
    if (authContext.user?.id) {
      return authContext.user.id;
    }

    if (loggedUser?.id) {
      return loggedUser.id;
    }

    try {
      const storedUser = localStorage.getItem("imagiq_user");
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        return parsedUser.id || null;
      }
    } catch (error) {

    }

    return null;
  }, [authContext.user?.id, loggedUser?.id]);

  // Rol del usuario (2 = registrado, 3 = invitado). Solo los REGISTRADOS pueden
  // ver métodos de pago guardados; un invitado (rol 3, auto-logueado solo con el
  // email) NO debe ver tarjetas de esa cuenta — eso expondría datos de pago de un
  // tercero (parte del account takeover). Ver [[reference_usuarios_rol_invitado]].
  const getUserRole = useCallback((): number | null => {
    const readRole = (u: unknown): number | null => {
      if (!u || typeof u !== "object") return null;
      const o = u as { rol?: unknown; role?: unknown };
      if (typeof o.rol === "number") return o.rol;
      if (typeof o.role === "number") return o.role;
      return null;
    };
    const fromCtx = readRole(authContext.user);
    if (fromCtx !== null) return fromCtx;
    const fromLogged = readRole(loggedUser);
    if (fromLogged !== null) return fromLogged;
    try {
      const stored = localStorage.getItem("imagiq_user");
      if (stored) return readRole(JSON.parse(stored));
    } catch {
      /* noop */
    }
    return null;
  }, [authContext.user, loggedUser]);

  // Solo los usuarios registrados (rol 2) pueden cargar tarjetas guardadas.
  const canUseSavedCards = useCallback((): boolean => getUserRole() === 2, [getUserRole]);

  // Verificar si el caché es válido
  const isCacheValid = useCallback(() => {
    const now = Date.now();
    const userId = getUserId();
    return (
      cardsCache.data !== null &&
      cardsCache.userId === userId &&
      now - cardsCache.timestamp < CACHE_DURATION
    );
  }, [getUserId]);

  // Cargar tarjetas (con o sin caché)
  const loadSavedCards = useCallback(async (forceReload = false): Promise<DBCard[]> => {
    const userId = getUserId();
    if (!userId) {
      setSavedCards([]);
      return [];
    }

    // Seguridad: un invitado (rol 3) NO debe ver tarjetas guardadas.
    if (!canUseSavedCards()) {
      setSavedCards([]);
      return [];
    }

    // Si el caché es válido y no se fuerza la recarga, usar caché
    if (!forceReload && isCacheValid() && cardsCache.data) {

      setSavedCards(cardsCache.data);
      return cardsCache.data;
    }

    try {

      setIsLoadingCards(true);
      const encryptedCards =
        await profileService.getUserPaymentMethodsEncrypted(userId);

      const decryptedCards: DBCard[] = encryptedCards
        .map((encCard) => {
          const decrypted = encryptionService.decryptJSON<DecryptedCardData>(
            encCard.encryptedData
          );
          if (!decrypted) return null;

          return {
            id: decrypted.cardId as unknown as string,
            ultimos_dijitos: decrypted.last4Digits,
            marca: decrypted.brand?.toLowerCase() || undefined,
            banco: decrypted.banco || undefined,
            tipo_tarjeta: decrypted.tipo || undefined,
            es_predeterminada: false,
            activa: true,
            nombre_titular: decrypted.cardHolderName || undefined,
          } as DBCard;
        })
        .filter((card): card is DBCard => card !== null);

      // Actualizar caché
      cardsCache = {
        data: decryptedCards,
        timestamp: Date.now(),
        userId: userId,
      };

      setSavedCards(decryptedCards);
      return decryptedCards;

    } catch (error) {

      setSavedCards([]);
      // No actualizar caché en caso de error
      return [];
    } finally {
      setIsLoadingCards(false);
    }
  }, [getUserId, isCacheValid, canUseSavedCards]);

  // Precargar tarjetas sin mostrar loading (para precarga anticipada)
  const preloadCards = useCallback(async () => {
    const userId = getUserId();
    if (!userId) return;

    // Seguridad: un invitado (rol 3) NO debe ver tarjetas guardadas.
    if (!canUseSavedCards()) return;

    // Si ya hay caché válido, no hacer nada
    if (isCacheValid() && cardsCache.data) {

      return;
    }

    try {

      const encryptedCards =
        await profileService.getUserPaymentMethodsEncrypted(userId);

      const decryptedCards: DBCard[] = encryptedCards
        .map((encCard) => {
          const decrypted = encryptionService.decryptJSON<DecryptedCardData>(
            encCard.encryptedData
          );
          if (!decrypted) return null;

          return {
            id: decrypted.cardId as unknown as string,
            ultimos_dijitos: decrypted.last4Digits,
            marca: decrypted.brand?.toLowerCase() || undefined,
            banco: decrypted.banco || undefined,
            tipo_tarjeta: decrypted.tipo || undefined,
            es_predeterminada: false,
            activa: true,
            nombre_titular: decrypted.cardHolderName || undefined,
          } as DBCard;
        })
        .filter((card): card is DBCard => card !== null);

      // Actualizar caché (pero no setSavedCards ya que es precarga)
      cardsCache = {
        data: decryptedCards,
        timestamp: Date.now(),
        userId: userId,
      };


    } catch (error) {

    }
  }, [getUserId, isCacheValid, canUseSavedCards]);

  // Invalidar caché manualmente
  const invalidateCache = useCallback(() => {
    cardsCache = {
      data: null,
      timestamp: 0,
      userId: null,
    };
    zeroInterestCache = {
      data: null,
      timestamp: 0,
      userId: null,
      cacheKey: null,
    };
  }, []);

  // Generar clave de caché para zero interest
  const generateZeroInterestCacheKey = useCallback(
    (cardIds: string[], productSkus: string[], totalAmount: number) => {
      return `${cardIds.sort().join(",")}_${productSkus.sort().join(",")}_${totalAmount}`;
    },
    []
  );

  // Verificar si el caché de zero interest es válido
  const isZeroInterestCacheValid = useCallback(
    (cardIds: string[], productSkus: string[], totalAmount: number) => {
      const now = Date.now();
      const userId = getUserId();
      const cacheKey = generateZeroInterestCacheKey(cardIds, productSkus, totalAmount);
      return (
        zeroInterestCache.data !== null &&
        zeroInterestCache.userId === userId &&
        zeroInterestCache.cacheKey === cacheKey &&
        now - zeroInterestCache.timestamp < CACHE_DURATION
      );
    },
    [getUserId, generateZeroInterestCacheKey]
  );

  // Cargar zero interest (con o sin caché)
  const loadZeroInterest = useCallback(
    async (cardIds: string[], productSkus: string[], totalAmount: number, forceReload = false) => {
      const userId = getUserId();
      if (!userId || cardIds.length === 0) {
        setZeroInterestData(null);
        return;
      }

      // Si el caché es válido y no se fuerza la recarga, usar caché
      if (!forceReload && isZeroInterestCacheValid(cardIds, productSkus, totalAmount) && zeroInterestCache.data) {

        setZeroInterestData(zeroInterestCache.data);
        return;
      }

      try {

        setIsLoadingZeroInterest(true);
        const result = await checkZeroInterest({
          userId,
          cardIds,
          productSkus,
          totalAmount,
        });

        // Actualizar caché
        const cacheKey = generateZeroInterestCacheKey(cardIds, productSkus, totalAmount);
        zeroInterestCache = {
          data: result,
          timestamp: Date.now(),
          userId,
          cacheKey,
        };

        setZeroInterestData(result);

      } catch (error) {

        setZeroInterestData(null);
      } finally {
        setIsLoadingZeroInterest(false);
      }
    },
    [getUserId, isZeroInterestCacheValid, generateZeroInterestCacheKey]
  );

  // Precargar zero interest sin mostrar loading
  const preloadZeroInterest = useCallback(
    async (cardIds: string[], productSkus: string[], totalAmount: number) => {
      const userId = getUserId();
      if (!userId || cardIds.length === 0) return;

      // Si ya hay caché válido, no hacer nada
      if (isZeroInterestCacheValid(cardIds, productSkus, totalAmount) && zeroInterestCache.data) {

        return;
      }

      try {

        const result = await checkZeroInterest({
          userId,
          cardIds,
          productSkus,
          totalAmount,
        });

        // Actualizar caché (pero no setZeroInterestData ya que es precarga)
        const cacheKey = generateZeroInterestCacheKey(cardIds, productSkus, totalAmount);
        zeroInterestCache = {
          data: result,
          timestamp: Date.now(),
          userId,
          cacheKey,
        };


      } catch (error) {

      }
    },
    [getUserId, isZeroInterestCacheValid, generateZeroInterestCacheKey]
  );

  return {
    savedCards,
    isLoadingCards,
    loadSavedCards,
    preloadCards,
    invalidateCache,
    isCacheValid,
    canUseSavedCards,
    zeroInterestData,
    isLoadingZeroInterest,
    loadZeroInterest,
    preloadZeroInterest,
  };
}
