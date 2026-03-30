"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Step2 from "../Step2";
import useSecureStorage from "@/hooks/useSecureStorage";
import { User } from "@/types/user";
import { useCheckoutAddress } from "@/features/checkout";

export default function Step2Page() {
  const router = useRouter();
  const [loggedUser] = useSecureStorage<User | null>("imagiq_user", null);
  const [isChecking, setIsChecking] = useState(true);
  const checkExecuted = useRef(false);
  const { selectedAddress, isLoading: isAddressLoading } = useCheckoutAddress();

  // Protección: Step2 es SOLO para usuarios invitados (rol 3) o usuarios NO logueados
  // Si el usuario es regular (rol 2), debe ir directo a step3
  useEffect(() => {
    // Esperar a que el contexto de dirección termine de cargar
    if (isAddressLoading) return;

    // Prevenir múltiples ejecuciones
    if (checkExecuted.current) {
      return;
    }

    const performCheck = () => {
      checkExecuted.current = true;

      const token = localStorage.getItem("imagiq_token");

      // Obtener usuario desde localStorage directamente
      let userToCheck = null;
      try {
        const userInfo = localStorage.getItem("imagiq_user");
        if (userInfo) {
          userToCheck = JSON.parse(userInfo);
        }
      } catch {
        userToCheck = null;
      }

      console.log("🔍 [STEP2] Verificando acceso:", {
        hasToken: !!token,
        hasUser: !!userToCheck,
        userRol: (userToCheck as any)?.rol ?? (userToCheck as any)?.role,
        userEmail: userToCheck?.email
      });

      // Si hay token Y usuario, verificar el rol
      if (token && userToCheck) {
        const userRole = (userToCheck as any).rol ?? (userToCheck as any).role;

        // Si es usuario REGULAR (rol 2 o cualquier rol diferente a 3), redirigir a step3
        if (userRole !== 3) {
          console.log("⚠️ [STEP2] Usuario regular detectado (rol !== 3). Redirigiendo a step3...");
          router.push("/carrito/step3");
          return;
        }

        // Si es invitado (rol 3), verificar si YA tiene dirección
        // Si ya tiene dirección, debe ir a Step3, no quedarse en Step2
        if (selectedAddress && selectedAddress.ciudad && selectedAddress.lineaUno) {
          console.log("⚠️ [STEP2] Usuario invitado YA tiene dirección válida. Redirigiendo a step3...");
          router.push("/carrito/step3");
          return;
        }

        // Si es invitado SIN dirección, permitir acceso para que agregue una
        console.log("✅ [STEP2] Usuario invitado sin dirección, permitiendo acceso");
        setIsChecking(false);
        return;
      }

      // Si NO hay token ni usuario, verificar si hay dirección guardada
      // Si ya hay dirección, redirigir a Step3 (es un invitado que ya completó Step2)
      if (selectedAddress && selectedAddress.ciudad && selectedAddress.lineaUno) {
        console.log("⚠️ [STEP2] Ya hay dirección válida guardada. Redirigiendo a step3...");
        router.push("/carrito/step3");
        return;
      }

      // Si NO hay token, usuario NI dirección → es un visitante nuevo que se registrará
      console.log("✅ [STEP2] Usuario nuevo sin dirección, permitiendo acceso para registro como invitado");
      setIsChecking(false);
    };

    performCheck();
  }, [router, selectedAddress, isAddressLoading]);

  const handleBack = () => router.push("/carrito/step1");
  const handleNext = () => {
    // Verificar que haya dirección en el contexto antes de navegar
    if (!selectedAddress) {
      console.warn("⚠️ [STEP2] Intentando navegar a step3 pero no hay dirección en el contexto");
      return;
    }

    console.log("✅ [STEP2] Dirección verificada, navegando a step3");
    router.push("/carrito/step3");
  };

  // Mostrar loading mientras verifica
  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  return <Step2 onBack={handleBack} onContinue={handleNext} />;
}
