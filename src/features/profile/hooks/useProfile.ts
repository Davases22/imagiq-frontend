/**
 * @module useProfile
 * @description Hook simplificado para perfil usando datos del AuthContext
 */

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/features/auth/context";
import {
  ProfileState,
  ProfileUser,
  DBAddress,
  DBCard,
  DecryptedCardData,
} from "../types";
import {
  profileService,
  ProfileResponse,
  UpdateProfileRequest,
} from "@/services/profile.service";
import { encryptionService } from "@/lib/encryption";

interface UseProfileReturn {
  state: ProfileState;
  actions: {
    loadProfile: () => Promise<void>;
    refreshData: () => Promise<void>;
    updateProfile: (data: UpdateProfileRequest) => Promise<{ ok: boolean; error?: string }>;
    logout: () => Promise<void>;
  };
  isLoading: boolean;
}

/**
 * Hook principal de perfil - simplificado
 */
export const useProfile = (): UseProfileReturn => {
  const authContext = useAuthContext();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileUser, setProfileUser] = useState<ProfileUser | null>(null);

  // Cargar perfil completo desde la DB
  const loadProfile = useCallback(async () => {
    if (!authContext.user?.id) {
      setError("Usuario no autenticado");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Cargar perfil básico y direcciones
      const profileData: ProfileResponse = await profileService.getUserProfile(
        authContext.user.id
      );

      // Parsear direcciones
      let direcciones: DBAddress[] = [];
      if (typeof profileData.direcciones === "string") {
        try {
          direcciones = JSON.parse(profileData.direcciones);
        } catch {
          direcciones = [];
        }
      } else if (Array.isArray(profileData.direcciones)) {
        direcciones = profileData.direcciones;
      }

      // Cargar tarjetas encriptadas y desencriptarlas
      let tarjetas: DBCard[] = [];
      try {
        const encryptedCards =
          await profileService.getUserPaymentMethodsEncrypted(
            authContext.user.id
          );

        tarjetas = encryptedCards
          .map((encCard) => {
            const decrypted = encryptionService.decryptJSON<DecryptedCardData>(
              encCard.encryptedData
            );

            if (!decrypted) {
              console.error("❌ Error desencriptando tarjeta");
              return null;
            }

            console.log("🔍 DEBUG - Datos desencriptados:", {
              cardId: decrypted.cardId,
              last4: decrypted.last4Digits,
              brand: decrypted.brand,
              tipo: decrypted.tipo,
              banco: decrypted.banco,
              cardHolderName: decrypted.cardHolderName,
              createdAt: decrypted.createdAt,
            });

            // Convertir formato DecryptedCardData a DBCard
            return {
              id: decrypted.cardId.replace(/\D/g, "").slice(-8) || "", // Convertir UUID a número temporal
              ultimos_dijitos: decrypted.last4Digits,
              marca: decrypted.brand?.toLowerCase() || undefined,
              banco: decrypted.banco || undefined,
              tipo_tarjeta: decrypted.tipo || undefined, // credit/debit del backend
              es_predeterminada: false,
              activa: true,
              nombre_titular: decrypted.cardHolderName || undefined,
            } as DBCard;
          })
          .filter((card): card is DBCard => card !== null);

        console.log("✅ Tarjetas desencriptadas (final):", tarjetas);
      } catch (err) {
        console.error("❌ Error cargando tarjetas encriptadas:", err);
        // No fallar todo el perfil si solo las tarjetas fallan
        tarjetas = [];
      }

      // Crear usuario de perfil con datos parseados
      const user: ProfileUser = {
        id: profileData.id,
        nombre: profileData.nombre,
        apellido: profileData.apellido,
        email: profileData.email,
        telefono: profileData.telefono,
        numero_documento: profileData.numero_documento,
        direcciones,
        tarjetas,
      };

      setProfileUser(user);
    } catch (err) {
      console.error("Error cargando perfil:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Error al cargar perfil";
      setError(errorMessage);

      // Si es error de autenticación (token expirado), hacer logout y redirigir
      if (
        errorMessage.includes("401") ||
        errorMessage.includes("403") ||
        errorMessage.includes("Unauthorized") ||
        errorMessage.includes("No se encontró el ID del usuario") ||
        errorMessage.toLowerCase().includes("token")
      ) {
        console.log(
          "🔒 Token expirado o inválido, cerrando sesión y redirigiendo al login..."
        );
        authContext.logout();
        router.push("/login");
      }
    } finally {
      setLoading(false);
    }
  }, [authContext, router]);

  // Refrescar datos
  const refreshData = useCallback(async () => {
    await loadProfile();
  }, [loadProfile]);

  // Actualizar perfil
  const updateProfile = useCallback(
    async (data: UpdateProfileRequest): Promise<{ ok: boolean; error?: string }> => {
      if (!authContext.user?.id) {
        setError("Usuario no autenticado");
        return { ok: false, error: "Usuario no autenticado" };
      }

      setLoading(true);
      setError(null);

      try {
        await profileService.updateProfile(authContext.user.id, data);

        // Sincronizar la sesión global (navbar, contexto) con los datos nuevos,
        // si no, el nombre/correo de arriba quedaba viejo hasta recargar.
        authContext.updateUser({
          nombre: data.nombre,
          apellido: data.apellido,
          email: data.email,
          telefono: data.telefono,
          numero_documento: data.numero_documento,
        });

        // Recargar el perfil para obtener los datos actualizados
        await loadProfile();

        return { ok: true };
      } catch (err) {
        console.error("Error actualizando perfil:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Error al actualizar perfil";
        setError(errorMessage);
        // Devolver el error para que el caller muestre el mensaje REAL (state.error
        // es asíncrono y llega tarde en el mismo tick).
        return { ok: false, error: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    [authContext.user?.id, loadProfile]
  );

  // Logout
  const logout = useCallback(async () => {
    setProfileUser(null);
    authContext.logout();
    router.push("/");
  }, [authContext, router]);

  // Cargar perfil al montar si hay usuario autenticado
  useEffect(() => {
    if (authContext.user && !profileUser) {
      loadProfile();
    }
  }, [authContext.user, profileUser, loadProfile]);

  // Estado del perfil
  const profileState: ProfileState = {
    user: profileUser,
    loading,
    error,
  };

  return {
    state: profileState,
    actions: {
      loadProfile,
      refreshData,
      updateProfile,
      logout,
    },
    isLoading: loading || authContext.isLoading,
  };
};
