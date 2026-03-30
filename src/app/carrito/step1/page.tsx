"use client";

import useSecureStorage from "@/hooks/useSecureStorage";
import { User } from "@/types/user";
import { useRouter } from "next/navigation";
import Step1 from "../Step1";
import { addressesService } from "@/services/addresses.service";
import { useCheckoutAddress } from "@/features/checkout";

export default function Step1Page() {
  const router = useRouter();
  const [loggedUser, _setLoggedUser] = useSecureStorage<User | null>(
    "imagiq_user",
    null
  );
  const { selectedAddress, selectAddress } = useCheckoutAddress();

  console.log("🚀 [STEP1 PAGE] Usuario logueado:", loggedUser);

  const handleNext = async () => {
    // Obtener el rol del usuario (compatibilidad con backend que usa 'rol' y frontend que usa 'role')
    const userRole = (loggedUser as any)?.role ?? (loggedUser as any)?.rol;

    // Si es usuario regular (tiene token y NO es invitado rol 3), ir directamente a step3
    const token = localStorage.getItem("imagiq_token");
    if (token && loggedUser?.email && userRole !== 3) {
      console.log("✅ [STEP1] Usuario regular autenticado (rol !== 3), yendo directo a step3");
      router.push("/carrito/step3");
      return;
    }

    // Verificar si el usuario invitado tiene dirección
    if (loggedUser && userRole === 3) {
      // Primero verificar el contexto (más rápido)
      if (selectedAddress && selectedAddress.id) {
        console.log("✅ [STEP1] Usuario invitado con dirección en contexto, yendo a step3");
        router.push("/carrito/step3");
        return;
      }

      // Si no hay en el contexto, consultar API
      try {
        const addresses = await addressesService.getUserAddresses();
        if (addresses && addresses.length > 0) {
          console.log("✅ [STEP1] Usuario invitado tiene direcciones en la BD, yendo a step3");
          // Seleccionar la primera dirección en el contexto
          if (addresses[0]) {
            selectAddress(addresses[0]);
          }
          router.push("/carrito/step3");
          return;
        }
      } catch (error) {
        console.error("❌ [STEP1] Error consultando direcciones:", error);
      }

      // Si es invitado sin dirección, ir a step2 para agregar dirección
      console.log("📍 [STEP1] Usuario invitado sin dirección, yendo a step2");
      router.push("/carrito/step2");
      return;
    }

    // Si NO está logueado, ir a step2 para registro como invitado
    console.log("📍 [STEP1] Usuario no logueado, yendo a step2 para registro");
    router.push("/carrito/step2");
  };

  return <Step1 onContinue={handleNext} />;
}
