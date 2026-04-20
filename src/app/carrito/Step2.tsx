"use client";
/**
 * Paso 2 del carrito de compras: Datos de envío y pago
 * Layout profesional, estilo Samsung, código limpio y escalable
 */
import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useCart, type BundleInfo } from "@/hooks/useCart";
import { useRouter } from "next/navigation";
import { safeGetLocalStorage } from "@/lib/localStorage";
import { apiPost } from "@/lib/api-client";
import { tradeInEndpoints } from "@/lib/api";
import Step4OrderSummary from "./components/Step4OrderSummary";
import TradeInCompletedSummary from "@/app/productos/dispositivos-moviles/detalles-producto/estreno-y-entrego/TradeInCompletedSummary";
import TradeInModal from "@/app/productos/dispositivos-moviles/detalles-producto/estreno-y-entrego/TradeInModal";
import AddNewAddressForm from "./components/AddNewAddressForm";
import type { Address } from "@/types/address";
import { OTPStep } from "@/app/login/create-account/components/OTPStep";
import {
  validateTradeInProducts,
  getTradeInValidationMessage,
} from "./utils/validateTradeIn";
import { toast } from "sonner";
import { associateEmailWithSession, identifyEmailEarly } from "@/lib/posthogClient";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface GuestUserResponse {
  address: {
    id?: string;
    linea_uno: string;
    ciudad: string;
  };
  user: {
    id: string;
    nombre: string;
    apellido: string;
    email: string;
    numero_documento: string;
    telefono: string;
  };
}

/**
 * Paso 2 del carrito: recibe onBack para volver al paso anterior
 */
export default function Step2({
  onBack,
  onContinue,
}: {
  readonly onBack?: () => void;
  readonly onContinue?: () => void;
}) {
  // Usar el hook centralizado useCart
  const { products: cartProducts, calculations } = useCart();
  const router = useRouter();

  // Estado para formulario de invitado
  // Formulario de invitado: incluye dirección línea uno y ciudad
  const [guestForm, setGuestForm] = useState({
    email: "",
    nombre: "",
    apellido: "",
    cedula: "",
    celular: "",
    tipo_documento: "",
  });

  // Estado para validación y UX
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Estado para errores por campo
  const [fieldErrors, setFieldErrors] = useState({
    email: "",
    nombre: "",
    apellido: "",
    cedula: "",
    celular: "",
    tipo_documento: "",
  });

  // Estado para saber si el usuario interactuó con cada campo
  const [fieldTouched, setFieldTouched] = useState({
    email: false,
    nombre: false,
    apellido: false,
    cedula: false,
    celular: false,
    tipo_documento: false,
  });

  // Estado para saber si ya intentó enviar el formulario (para mostrar errores globales)
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Trade-In state management
  const [tradeInData, setTradeInData] = useState<{
    completed: boolean;
    deviceName: string;
    value: number;
  } | null>(null);
  // Estado para controlar el modal de Trade-In
  const [isTradeInModalOpen, setIsTradeInModalOpen] = useState(false);

  // Estado para el producto seleccionado para Trade-In
  const [selectedProductForTradeIn, setSelectedProductForTradeIn] = useState<{
    sku: string;
    name: string;
    skuPostback?: string;
  } | null>(null);

  // Estado para verificar si ya se registró como invitado
  const [isRegisteredAsGuest, setIsRegisteredAsGuest] = useState(false);

  // Estados para el flujo OTP
  const [guestStep, setGuestStep] = useState<'form' | 'otp' | 'verified'>('form');
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sendMethod, setSendMethod] = useState<'email' | 'whatsapp'>('whatsapp');
  const [guestUserId, setGuestUserId] = useState<string | null>(null);

  // Estado para rastrear cuando se está guardando la dirección
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  // Estados agregados para recuperar funcionalidad perdida
  const [hasAddedAddress, setHasAddedAddress] = useState(false);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [isAddressFormValid, setIsAddressFormValid] = useState(false);

  // Estado para datos de geolocalización
  const [geoLocationData, setGeoLocationData] = useState<{
    departamento?: string;
    ciudad?: string;
    tipo_via?: string;
    numero_principal?: string;
    numero_secundario?: string;
    numero_complementario?: string;
    barrio?: string;
  } | null>(null);

  // Estado para rastrear el paso actual del formulario de dirección
  const [addressFormStep, setAddressFormStep] = useState<1 | 2>(1);

  // Ref para saber si ya se solicitó geolocalización
  const geoLocationRequestedRef = React.useRef(false);

  // Ref para poder hacer submit del formulario de dirección desde el botón del sidebar
  const addressFormSubmitRef = React.useRef<(() => void) | null>(null);
  // Ref para controlar la navegación entre pasos del formulario de dirección (paso 1 → 2 o submit en paso 2)
  const addressFormContinueRef = React.useRef<(() => void) | null>(null);

  // Redirección automática: Si el usuario ya tiene sesión y dirección, ir a Step1
  // Esto maneja el caso de swipe back en mobile desde Step3
  React.useEffect(() => {
    const checkAndRedirect = () => {
      // Verificar si hay usuario logueado (token o usuario en localStorage)
      const token = localStorage.getItem("imagiq_token");
      const userStr = localStorage.getItem("imagiq_user");
      const savedAddress = localStorage.getItem("checkout-address");

      let hasUser = false;
      if (token && userStr) {
        try {
          const user = JSON.parse(userStr);
          // Usuario con rol 2 (registrado) o rol 3 (invitado verificado)
          hasUser = user && (user.rol === 2 || user.rol === 3);
        } catch {
          hasUser = false;
        }
      }

      let hasAddress = false;
      if (savedAddress && savedAddress !== "null" && savedAddress !== "undefined") {
        try {
          const address = JSON.parse(savedAddress);
          hasAddress = address && address.ciudad && address.linea_uno;
        } catch {
          hasAddress = false;
        }
      }

      // Si ya tiene usuario y dirección, redirigir a Step1
      if (hasUser && hasAddress) {
        console.log("🔄 [Step2] Usuario y dirección detectados, redirigiendo a Step1...");
        router.replace("/carrito/step1");
      }
    };

    checkAndRedirect();
  }, [router]);

  // --- Validación simplificada y centralizada ---
  // Filtros de seguridad por campo
  const filters = {
    cedula: (v: string) => v.replaceAll(/\D/g, ""),
    celular: (v: string) => v.replaceAll(/\D/g, ""),
    nombre: (v: string) => v.replaceAll(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, ""),
    apellido: (v: string) => v.replaceAll(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, ""),
    email: (v: string) => v.replaceAll(/\s/g, ""),
    tipo_documento: (v: string) => v, // No filter needed for select
  };

  // Validadores por campo
  const validators = {
    email: (v: string) => {
      if (!v) return "Por favor escribe tu correo electrónico.";
      if (!/^([\w-.]+)@([\w-]+\.)+[\w-]{2,4}$/.test(v))
        return "El formato del correo electrónico no es válido. Ejemplo: usuario@dominio.com.";
      return "";
    },
    nombre: (v: string) => {
      if (!v) return "Por favor escribe tu nombre.";
      if (v.length < 2) return "El nombre debe tener al menos 2 letras.";
      return "";
    },
    apellido: (v: string) => {
      if (!v) return "Por favor escribe tu apellido.";
      if (v.length < 2) return "El apellido debe tener al menos 2 letras.";
      return "";
    },
    cedula: (v: string) => {
      if (!v) return "Por favor escribe tu número de cédula.";
      if (v.length < 6 || v.length > 10)
        return "La cédula debe tener entre 6 y 10 números.";
      if (!/^([1-9]\d{5,9})$/.test(v))
        return "La cédula debe empezar con un número diferente de cero.";
      return "";
    },
    celular: (v: string) => {
      if (!v) return "Por favor escribe tu número de celular.";
      if (v.length !== 10)
        return "El celular debe tener exactamente 10 números.";
      if (!/^3\d{9}$/.test(v))
        return "El celular colombiano debe empezar con '3' y tener 10 dígitos.";
      return "";
    },
    tipo_documento: (v: string) => {
      if (!v) return "Por favor selecciona el tipo de documento.";
      if (!["CC", "CE", "NIT", "PP"].includes(v))
        return "Tipo de documento inválido.";
      return "";
    },
  };

  // Validar todos los campos y devolver errores
  function validateFields(form: typeof guestForm) {
    const errors: typeof fieldErrors = {
      email: "",
      nombre: "",
      apellido: "",
      cedula: "",
      celular: "",
      tipo_documento: "",
    };
    for (const key of Object.keys(errors)) {
      // @ts-expect-error Type mismatch due to dynamic key access; all keys are validated and safe here
      errors[key] = validators[key](form[key].trim());
    }
    return errors;
  }

  // Mostrar error solo si el campo fue tocado o si ya intentó enviar
  const shouldShowError = (field: keyof typeof fieldErrors) =>
    (fieldTouched[field] || submitAttempted) && Boolean(fieldErrors[field]);

  // Manejar cambios en el formulario invitado
  const handleGuestChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    const filter = filters[name as keyof typeof filters];
    const newValue = filter ? filter(value) : value;
    const newForm = { ...guestForm, [name]: newValue };
    setGuestForm(newForm);
    setFieldErrors(validateFields(newForm));
  };

  const handleGuestBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (!name) return;
    setFieldTouched((prev) => ({ ...prev, [name]: true }));
    setFieldErrors(validateFields(guestForm));
    if (name === "email") identifyEmailEarly(value);
  };

  // Manejar cambios en Select de shadcn (usa onValueChange en lugar de onChange)
  const handleSelectChange = (name: string, value: string) => {
    const newForm = { ...guestForm, [name]: value };
    setGuestForm(newForm);
    setFieldErrors(validateFields(newForm));
    setFieldTouched((prev) => ({ ...prev, [name]: true }));
  };

  // Aplicar descuento si el código es válido
  // (Eliminado: handleDiscountApply no se usa)

  // Validar formulario invitado
  const isGuestFormValid = !Object.values(validateFields(guestForm)).some(
    Boolean
  );

  /**
   * Maneja el envío del formulario de invitado.
   * Solo registra sin verificar y envía OTP. La cuenta se crea después de verificar OTP.
   */
  const handleGuestSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    setSubmitAttempted(true);
    setError("");
    const errors = validateFields(guestForm);
    setFieldErrors(errors);
    if (Object.values(errors).some((err) => err)) {
      setError(
        "Por favor completa todos los campos obligatorios correctamente."
      );
      return;
    }

    setLoading(true);
    try {
      // 1. Registrar usuario sin verificar como invitado (rol 3, sin contraseña)
      const registerResult = await apiPost<{ message: string; userId: string }>("/api/auth/register-unverified", {
        email: guestForm.email.toLowerCase(),
        nombre: guestForm.nombre,
        apellido: guestForm.apellido,
        contrasena: "", // Cuenta invitado sin contraseña → rol 3
        // fecha_nacimiento no se envía (opcional para invitados)
        telefono: guestForm.celular,
        codigo_pais: "57",
        tipo_documento: guestForm.tipo_documento,
        numero_documento: guestForm.cedula,
      });

      // Guardar userId temporalmente (solo en estado, no en localStorage todavía)
      setGuestUserId(registerResult.userId);

      // Associate guest email with PostHog session
      associateEmailWithSession(guestForm.email.toLowerCase(), {
        $name: `${guestForm.nombre} ${guestForm.apellido}`.trim(),
      });

      // 2. Establecer estado inicial para OTP pero SIN enviarlo aún
      // Esto permite que el usuario seleccione el método de envío (WhatsApp o Email)
      setOtpSent(false);

      // 3. Guardar estado temporal en sessionStorage (se elimina al cerrar navegador)
      sessionStorage.setItem("guest-otp-process", JSON.stringify({
        guestForm,
        userId: registerResult.userId,
        sendMethod, // Método por defecto, pero no enviado aún
        timestamp: Date.now(),
        otpSent: false // Flag explícito
      }));

      // 4. Cambiar a paso de OTP
      setGuestStep('otp');
      setLoading(false);
    } catch (error) {
      setLoading(false);
      // Intentar extraer el mensaje de error del response
      let errorMessage = "";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "object" && error !== null) {
        // Intentar obtener el mensaje del objeto de error
        const errorObj = error as {
          message?: string;
          data?: { message?: string };
        };
        errorMessage =
          errorObj.message || errorObj.data?.message || String(error);
      } else {
        errorMessage = String(error);
      }

      // Verificar el tipo de error específico
      const lowerErrorMessage = errorMessage.toLowerCase();

      // Error de EMAIL
      if (
        (lowerErrorMessage.includes("email") || lowerErrorMessage.includes("correo")) &&
        (lowerErrorMessage.includes("ya está registrado") ||
          lowerErrorMessage.includes("ya existe") ||
          lowerErrorMessage.includes("registered") ||
          lowerErrorMessage.includes("duplicate"))
      ) {
        setError(
          `El correo ${guestForm.email} ya está asociado a una cuenta. Por favor, inicia sesión para continuar.`
        );
        setFieldErrors((prev) => ({
          ...prev,
          email:
            "Este correo ya está registrado. Inicia sesión para continuar.",
        }));
        return;
      }

      // Error de TELÉFONO
      if (
        (lowerErrorMessage.includes("teléfono") || lowerErrorMessage.includes("telefono") || lowerErrorMessage.includes("celular")) &&
        (lowerErrorMessage.includes("ya está registrado") ||
          lowerErrorMessage.includes("ya existe"))
      ) {
        setError(errorMessage);
        setFieldErrors((prev) => ({
          ...prev,
          celular: errorMessage,
        }));
        return;
      }

      // Error de DOCUMENTO
      if (
        (lowerErrorMessage.includes("documento") || lowerErrorMessage.includes("cédula") || lowerErrorMessage.includes("cedula")) &&
        (lowerErrorMessage.includes("ya está registrado") ||
          lowerErrorMessage.includes("ya existe"))
      ) {
        setError(errorMessage);
        setFieldErrors((prev) => ({
          ...prev,
          cedula: errorMessage,
        }));
        return;
      }

      // Para otros errores, mostrar el mensaje del backend o un mensaje genérico más útil
      if (
        errorMessage &&
        errorMessage !== "Request failed" &&
        !errorMessage.toLowerCase().includes("internal server error")
      ) {
        setError(errorMessage);
      } else {
        setError(
          "Ocurrió un error al procesar tu información. Por favor, verifica los datos e intenta de nuevo."
        );
      }
      return;
    }
  };

  /**
   * Maneja el envío de OTP
   * Si el teléfono/email ya está verificado, intenta auto-login del usuario existente
   */
  const handleSendOTP = async (method?: 'email' | 'whatsapp') => {
    // console.log("🔄 [Step2 handleSendOTP] Iniciando...", { guestUserId, method, sendMethod });

    if (!guestUserId) {
      // console.log("❌ [Step2 handleSendOTP] No hay guestUserId");
      setError("No hay un proceso de registro en curso");
      return;
    }

    const methodToUse = method || sendMethod;
    // console.log("📧 [Step2 handleSendOTP] Método seleccionado:", methodToUse);
    setLoading(true);
    setError("");

    try {
      if (methodToUse === 'email') {
        // console.log("📧 [Step2 handleSendOTP] Enviando OTP por email a:", guestForm.email);
        await apiPost("/api/auth/otp/send-email-register", {
          email: guestForm.email,
          userId: guestUserId, // Enviar userId para evitar conflictos con teléfonos duplicados
        });
      } else {
        // console.log("📱 [Step2 handleSendOTP] Enviando OTP por WhatsApp a:", guestForm.celular);
        await apiPost("/api/auth/otp/send-register", {
          telefono: guestForm.celular,
          metodo: "whatsapp",
          userId: guestUserId, // Enviar userId para evitar conflictos con teléfonos duplicados
        });
      }
      // console.log("✅ [Step2 handleSendOTP] OTP enviado exitosamente");
      setOtpSent(true);
      setSendMethod(methodToUse);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      // console.log("⚠️ [Step2 handleSendOTP] Error:", errorMsg);

      // Si el teléfono o email ya está verificado, intentar auto-login
      if (errorMsg.toLowerCase().includes("ya está verificado")) {
        // console.log("🔐 [Step2] Usuario ya verificado detectado, intentando auto-login con userId:", guestUserId);
        try {
          // Usar el userId que ya tenemos del registro
          const autoLoginResult = await apiPost<{
            access_token: string;
            user: {
              id: string;
              nombre: string;
              apellido: string;
              email: string;
              numero_documento: string;
              telefono: string;
              rol?: number;
            };
          }>("/api/auth/auto-login-guest", {
            userId: guestUserId,
          });

          // console.log("📦 [Step2] Respuesta auto-login:", {
          //             hasToken: !!autoLoginResult.access_token,
          //             hasUser: !!autoLoginResult.user,
          //             userRol: autoLoginResult.user?.rol
          //           });

          if (autoLoginResult.access_token && autoLoginResult.user) {
            // Preservar el carrito antes de guardar el usuario
            const currentCart = localStorage.getItem("cart-items");

            // Limpiar datos de usuario anterior
            try {
              const { clearPreviousUserData } = await import('@/app/carrito/utils/getUserId');
              clearPreviousUserData();
            } catch (cleanErr) {
              console.error('Error limpiando datos:', cleanErr);
            }

            // Guardar usuario con rol de invitado
            const userWithRole = {
              ...autoLoginResult.user,
              role: autoLoginResult.user.rol || 3,
              rol: autoLoginResult.user.rol || 3
            };

            // console.log("💾 [Step2] Guardando usuario con rol:", userWithRole.rol);
            localStorage.setItem("imagiq_token", autoLoginResult.access_token);
            localStorage.setItem("imagiq_user", JSON.stringify(userWithRole));
            // console.log("✅ [Step2] Token y usuario guardados en localStorage");

            // Guardar userId de forma consistente
            const { saveUserId } = await import('@/app/carrito/utils/getUserId');
            saveUserId(autoLoginResult.user.id, autoLoginResult.user.email, false);
            // console.log('✅ [Step2] Auto-login exitoso, userId:', autoLoginResult.user.id);

            // Guardar cédula para autocompletar
            if (globalThis.window !== undefined) {
              globalThis.window.localStorage.setItem(
                "checkout-document",
                guestForm.cedula
              );
            }

            // Restaurar carrito
            if (currentCart) {
              try {
                const cartData = JSON.parse(currentCart);
                if (Array.isArray(cartData) && cartData.length > 0) {
                  localStorage.setItem("cart-items", currentCart);
                  if (globalThis.window) {
                    globalThis.window.dispatchEvent(new Event("storage"));
                  }
                }
              } catch (cartErr) {
                console.error("Error restaurando carrito:", cartErr);
              }
            }

            // Limpiar sessionStorage
            sessionStorage.removeItem("guest-otp-process");

            // Marcar como registrado y verificado
            setIsRegisteredAsGuest(true);
            setGuestStep('verified');
            setLoading(false);
            return;
          }
        } catch (autoLoginErr) {
          console.error("❌ [Step2] Error en auto-login:", autoLoginErr);
          // Si falla el auto-login, continuar mostrando el error original
        }
      }

      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Maneja la verificación del OTP y completa el registro del invitado
   */
  const handleVerifyOTP = async () => {
    // console.log("🔐 [Step2 handleVerifyOTP] Iniciando verificación...", { otpCode, guestUserId, sendMethod });

    if (!otpCode || otpCode.length !== 6) {
      // console.log("❌ [Step2 handleVerifyOTP] Código inválido:", otpCode);
      setError("El código debe tener 6 dígitos");
      return;
    }

    if (!guestUserId) {
      // console.log("❌ [Step2 handleVerifyOTP] No hay guestUserId");
      setError("No hay un proceso de registro en curso");
      return;
    }

    setLoading(true);
    setError("");

    try {
      let result: {
        access_token: string;
        user: {
          id: string;
          nombre: string;
          apellido: string;
          email: string;
          numero_documento: string;
          telefono: string;
        };
      };

      if (sendMethod === 'email') {
        // console.log("📧 [Step2 handleVerifyOTP] Verificando OTP por email:", guestForm.email);
        result = await apiPost("/api/auth/otp/verify-email", {
          email: guestForm.email,
          codigo: otpCode,
        });
      } else {
        // console.log("📱 [Step2 handleVerifyOTP] Verificando OTP por WhatsApp:", guestForm.celular);
        result = await apiPost("/api/auth/otp/verify-register", {
          telefono: guestForm.celular,
          codigo: otpCode,
        });
      }

      // console.log("✅ [Step2 handleVerifyOTP] OTP verificado, resultado:", {
      //         hasToken: !!result.access_token,
      //         hasUser: !!result.user,
      //         userId: result.user?.id
      //       });

      // IMPORTANTE: Solo ahora guardamos en localStorage después de verificar OTP
      if (result.access_token && result.user) {
        // Preservar el carrito antes de guardar el usuario
        const currentCart = localStorage.getItem("cart-items");

        // CRÍTICO: Limpiar datos de usuario anterior ANTES de guardar invitado
        try {
          const { clearPreviousUserData } = await import('@/app/carrito/utils/getUserId');
          // console.log('🧹 [Step2] Limpiando datos de usuario anterior...');
          clearPreviousUserData();
          // console.log('✅ [Step2] Datos anteriores limpiados');
        } catch (error) {
          console.error('❌ [Step2] Error limpiando datos anteriores:', error);
        }

        // Asegurar que el usuario tenga el rol de invitado explícitamente
        const userWithRole = {
          ...result.user,
          role: 3, // Para frontend (User type)
          rol: 3   // Para backend
        };

        // Guardar token y usuario - cuenta de invitado creada y verificada
        localStorage.setItem("imagiq_token", result.access_token);
        localStorage.setItem("imagiq_user", JSON.stringify(userWithRole));

        // CRÍTICO: Guardar userId de forma consistente en todas las fuentes
        const { saveUserId } = await import('@/app/carrito/utils/getUserId');
        saveUserId(result.user.id, result.user.email, false); // false = no limpiar de nuevo
        // console.log('✅ [Step2] UserId guardado de forma consistente:', result.user.id);

        // Guardar cédula para autocompletar
        if (globalThis.window !== undefined) {
          globalThis.window.localStorage.setItem(
            "checkout-document",
            guestForm.cedula
          );
        }

        // Restaurar el carrito después de guardar el usuario
        if (currentCart) {
          try {
            const cartData = JSON.parse(currentCart);
            if (Array.isArray(cartData) && cartData.length > 0) {
              localStorage.setItem("cart-items", currentCart);
              if (globalThis.window) {
                globalThis.window.dispatchEvent(new Event("storage"));
                globalThis.window.dispatchEvent(
                  new CustomEvent("localStorageChange", {
                    detail: { key: "cart-items" },
                  })
                );
              }
            }
          } catch (error) {
            console.error("Error restaurando carrito:", error);
          }
        }

        // Limpiar sessionStorage temporal
        sessionStorage.removeItem("guest-otp-process");

        // Marcar como registrado y verificado
        setIsRegisteredAsGuest(true);
        setGuestStep('verified');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al verificar código";
      setError(msg);
      // Limpiar el código OTP para evitar re-intentos automáticos
      setOtpCode("");
    } finally {
      setLoading(false);
    }
  };

  // Estado para validación de Trade-In
  const [tradeInValidation, setTradeInValidation] = React.useState<{
    isValid: boolean;
    productsWithoutRetoma: typeof cartProducts;
    hasMultipleProducts: boolean;
    errorMessage?: string;
  }>({ isValid: true, productsWithoutRetoma: [], hasMultipleProducts: false });

  // Validar Trade-In cuando cambian los productos
  React.useEffect(() => {
    const validation = validateTradeInProducts(cartProducts);
    setTradeInValidation(validation);

    // Si el producto ya no aplica (indRetoma === 0), quitar banner inmediatamente y mostrar notificación
    if (
      validation.isValid === false &&
      validation.errorMessage !== undefined &&
      validation.errorMessage.includes("Te removimos")
    ) {
      // Limpiar localStorage inmediatamente
      localStorage.removeItem("imagiq_trade_in");

      // Mostrar notificación toast
      toast.error("Cupón removido", {
        description:
          "El producto seleccionado ya no aplica para el beneficio Estreno y Entrego",
        duration: 5000,
      });
    }
  }, [cartProducts]);

  // Wrapper function to handle both form validation and continue action
  const handleContinue = async () => {
    // Validar Trade-In antes de continuar
    const validation = validateTradeInProducts(cartProducts);
    if (!validation.isValid) {
      setError(getTradeInValidationMessage(validation));
      return;
    }

    // PRIORIDAD 1: Si ya tiene dirección agregada (invitado O regular), continuar a Step3
    // Esto cubre tanto usuarios invitados como regulares que agregaron dirección
    if (hasAddedAddress && typeof onContinue === "function") {
      // console.log("✅ [STEP2 handleContinue] Usuario con dirección agregada, avanzando a Step3");
      onContinue();
      return;
    }

    // PRIORIDAD 2: Si es usuario regular sin dirección, pedirle que agregue dirección
    // (aunque los usuarios regulares NO deberían estar en step2)
    const token = localStorage.getItem("imagiq_token");
    if (token) {
      try {
        const userInfo = localStorage.getItem("imagiq_user");
        if (userInfo) {
          const user = JSON.parse(userInfo);
          const userRole = user.rol ?? user.role;
          if (userRole === 2) {
            // console.log("⚠️ [STEP2 handleContinue] Usuario regular sin dirección en step2 (no debería ocurrir)");
            toast.error("Por favor agrega una dirección de envío para continuar");
            return;
          }
        }
      } catch (error) {
        console.error("Error verificando rol de usuario:", error);
      }
    }

    // Si está en paso de formulario de invitado, hacer el registro
    if (guestStep === 'form' && !isRegisteredAsGuest) {
      if (!isGuestFormValid) {
        setError("Por favor completa todos los campos obligatorios.");
        const newFieldErrors: typeof fieldErrors = {
          email: guestForm.email.trim() ? "" : "Este campo es obligatorio",
          nombre: guestForm.nombre.trim() ? "" : "Este campo es obligatorio",
          apellido: guestForm.apellido.trim() ? "" : "Este campo es obligatorio",
          cedula: guestForm.cedula.trim() ? "" : "Este campo es obligatorio",
          celular: guestForm.celular.trim() ? "" : "Este campo es obligatorio",
          tipo_documento: guestForm.tipo_documento.trim()
            ? ""
            : "Este campo es obligatorio",
        };
        setFieldErrors(newFieldErrors);
        return;
      }
      await handleGuestSubmit();
      return;
    }

    // Si está en paso OTP, enviar código o verificar
    if (guestStep === 'otp' && !isRegisteredAsGuest) {
      if (!otpSent) {
        await handleSendOTP(sendMethod);
      } else if (otpCode.length === 6) {
        await handleVerifyOTP();
      } else {
        setError("Por favor ingresa el código de 6 dígitos");
      }
      return;
    }

    // Si ya está registrado pero no tiene dirección, el formulario ya está visible
    // No hacer nada, el usuario debe completar el formulario de dirección
    if (isRegisteredAsGuest && !hasAddedAddress) {
      toast.error("Por favor agrega una dirección de envío para continuar");
      return;
    }
  };
  // IMPORTANTE: Cargar datos del usuario invitado desde localStorage al montar
  useEffect(() => {
    // Primero verificar si hay un proceso OTP en curso (sessionStorage)
    const otpProcess = sessionStorage.getItem("guest-otp-process");
    if (otpProcess) {
      try {
        const processData = JSON.parse(otpProcess);
        // Restaurar datos del formulario
        setGuestForm(processData.guestForm);
        setGuestUserId(processData.userId);
        setSendMethod(processData.sendMethod || 'whatsapp');
        setGuestStep('otp'); // Continuar en paso OTP
        // Restaurar estado de envío (si no existe, asumir enviado para compatibilidad hacia atrás, 
        // pero para nuevos procesos será false hasta que se envíe)
        setOtpSent(processData.otpSent !== undefined ? processData.otpSent : true);
      } catch (err) {
        console.error("Error restaurando proceso OTP:", err);
        sessionStorage.removeItem("guest-otp-process");
      }
      return;
    }

    // Si no hay proceso OTP, verificar si ya hay usuario guardado (cuenta ya verificada)
    const savedUser = safeGetLocalStorage<{
      email?: string;
      nombre?: string;
      apellido?: string;
      numero_documento?: string;
      telefono?: string;
      tipo_documento?: string;
    } | null>("imagiq_user", null);

    if (savedUser && savedUser.email) {
      // Si hay usuario guardado, restaurar los datos del formulario
      setGuestForm({
        email: savedUser.email || "",
        nombre: savedUser.nombre || "",
        apellido: savedUser.apellido || "",
        cedula: savedUser.numero_documento || "",
        celular: savedUser.telefono || "",
        tipo_documento: savedUser.tipo_documento || "",
      });

      // Marcar como registrado como invitado (ya verificado)
      setIsRegisteredAsGuest(true);
      setGuestStep('verified');

      // IMPORTANTE: Verificar si ya tiene dirección agregada
      const savedAddress = safeGetLocalStorage<Address | null>(
        "checkout-address",
        null
      );
      if (savedAddress && savedAddress.id) {
        setHasAddedAddress(true);
      } else {
        setHasAddedAddress(false);
      }
    }
  }, []);

  // useEffect para solicitar geolocalización automáticamente cuando aparece el formulario de dirección
  useEffect(() => {
    // Solo ejecutar si:
    // 1. El usuario se registró como invitado
    // 2. NO ha agregado dirección aún
    // 3. NO se ha solicitado geolocalización todavía
    // 4. La API de geolocalización está disponible
    if (
      isRegisteredAsGuest &&
      !hasAddedAddress &&
      !geoLocationRequestedRef.current &&
      typeof window !== 'undefined' &&
      'geolocation' in navigator
    ) {
      // Marcar que ya se solicitó para evitar múltiples llamadas
      geoLocationRequestedRef.current = true;

      // console.log('📍 Detectado formulario de dirección, solicitando geolocalización...');
      setIsRequestingLocation(true);

      // Solicitar permiso de geolocalización
      navigator.geolocation.getCurrentPosition(
        // Éxito: se obtuvo la ubicación
        async (position) => {
          const { latitude, longitude } = position.coords;
          // console.log('✅ Geolocalización obtenida:', { latitude, longitude });

          try {
            // Llamar al endpoint de reverse geocoding con autenticación
            const apiKey = process.env.NEXT_PUBLIC_API_KEY;
            const response = await fetch('/api/addresses/reverse-geocode', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'X-API-Key': apiKey || '',
              },
              body: JSON.stringify({ lat: latitude, lng: longitude }),
            });

            if (!response.ok) {
              // Fallar silenciosamente - el usuario llenará el formulario manualmente
              console.log(`ℹ️ Geolocalización: servidor respondió ${response.status}, el usuario llenará manualmente`);
              setIsRequestingLocation(false);
              return;
            }

            const data = await response.json();
            // console.log('✅ Datos de geolocalización recibidos:', data);

            // Procesar y mapear los datos de respuesta al formato esperado
            // console.log('🗺️ Datos recibidos del endpoint:', data);

            // Extraer información de address_components para completar campos
            let departamento = data.departamento || '';
            let ciudad = data.ciudad || data.city || '';
            let tipo_via = data.tipo_via || '';
            let numero_principal = data.numero_principal || '';
            let numero_secundario = data.numero_secundario || '';
            let numero_complementario = data.numero_complementario || '';
            let barrio = data.barrio || '';

            // Si no vienen en el formato esperado, extraer de addressComponents
            if (data.addressComponents && Array.isArray(data.addressComponents)) {
              for (const component of data.addressComponents) {
                // Departamento
                if (component.types.includes('administrative_area_level_1') && !departamento) {
                  departamento = component.longName;
                }
                // Ciudad
                if ((component.types.includes('locality') || component.types.includes('administrative_area_level_2')) && !ciudad) {
                  ciudad = component.longName;
                }
                // Barrio
                if ((component.types.includes('sublocality_level_1') || component.types.includes('neighborhood')) && !barrio) {
                  barrio = component.longName;
                }
                // Tipo de vía (ruta)
                if (component.types.includes('route') && !tipo_via) {
                  const routeName = component.longName;
                  // Extraer tipo de vía de la ruta
                  const viaMatch = routeName.match(/^(Carrera|Calle|Avenida|Diagonal|Transversal|Cra\.?|Cl\.?|Av\.?)/i);
                  if (viaMatch) {
                    tipo_via = viaMatch[1];
                    // Extraer números si están en la misma cadena
                    const numberMatch = routeName.match(/(\d+)(?:\s*#?\s*(\d+))?(?:\s*-\s*(\d+))?/);
                    if (numberMatch) {
                      numero_principal = numberMatch[1] || numero_principal;
                      numero_secundario = numberMatch[2] || numero_secundario;
                      numero_complementario = numberMatch[3] || numero_complementario;
                    }
                  }
                }
              }
            }

            // console.log('📝 Datos procesados para formulario:', {
            //               departamento, ciudad, tipo_via, numero_principal, 
            //               numero_secundario, numero_complementario, barrio
            //             });

            // Guardar los datos procesados en el estado
            setGeoLocationData({
              departamento,
              ciudad,
              tipo_via,
              numero_principal,
              numero_secundario,
              numero_complementario,
              barrio,
            });

            setIsRequestingLocation(false);
          } catch (error) {
            console.error('❌ Error al obtener datos de geolocalización:', error);
            setIsRequestingLocation(false);
            // Continuar con el flujo normal - el usuario llenará el formulario manualmente
          }
        },
        // Error: el usuario denegó el permiso o hubo un error
        (error) => {
          // console.log('ℹ️ Geolocalización no disponible:', error.message);
          setIsRequestingLocation(false);
          // Continuar con el flujo normal - el usuario llenará el formulario manualmente
        },
        // Opciones de geolocalización
        {
          enableHighAccuracy: true,
          timeout: 10000, // 10 segundos máximo
          maximumAge: 0, // No usar caché
        }
      );
    }
  }, [isRegisteredAsGuest, hasAddedAddress]);

  useEffect(() => {
    // IMPORTANTE: NO redirigir automáticamente a Step3
    // El usuario debe hacer clic en "Continuar pago" para avanzar
    // Esto evita bucles y da control al usuario sobre el flujo

    // Load Trade-In data from localStorage
    const storedTradeIn = localStorage.getItem("imagiq_trade_in");
    if (storedTradeIn) {
      try {
        const parsed = JSON.parse(storedTradeIn);
        if (parsed.completed) {
          setTradeInData(parsed);
        }
      } catch (error) {
        console.error("Error parsing Trade-In data:", error);
      }
    }
  }, []);

  // Handler para abrir el modal de Trade-In (para cambiar producto)
  const handleOpenTradeInModal = () => {
    // Buscar el producto que aplica para Trade-In (indRetoma === 1)
    const productWithTradeIn = cartProducts.find(p => p.indRetoma === 1);
    if (productWithTradeIn) {
      setSelectedProductForTradeIn({
        sku: productWithTradeIn.sku,
        name: productWithTradeIn.name,
        skuPostback: productWithTradeIn.skuPostback,
      });
    } else if (cartProducts.length > 0) {
      // Fallback: usar el primer producto si ninguno tiene indRetoma definido
      const firstProduct = cartProducts[0];
      setSelectedProductForTradeIn({
        sku: firstProduct.sku,
        name: firstProduct.name,
        skuPostback: firstProduct.skuPostback,
      });
    }
    setIsTradeInModalOpen(true);
  };

  // Handler para cuando se completa el Trade-In
  const handleCompleteTradeIn = (deviceName: string, value: number) => {
    // Cargar datos desde localStorage (ya guardados por handleFinalContinue)
    try {
      const raw = localStorage.getItem("imagiq_trade_in");
      if (raw) {
        const stored = JSON.parse(raw) as {
          deviceName?: string;
          value?: number;
          completed?: boolean;
        };
        const newTradeInData = {
          deviceName: stored.deviceName || deviceName,
          value: stored.value || value,
          completed: true,
        };
        setTradeInData(newTradeInData);
      } else {
        // Fallback: guardar en localStorage si no existe (importante para usuarios NO logueados)
        const tradeInDataToSave = {
          deviceName,
          value,
          completed: true,
        };
        try {
          const tradeInString = JSON.stringify(tradeInDataToSave);
          localStorage.setItem("imagiq_trade_in", tradeInString);

          // Verificar que se guardó correctamente
          const verifySave = localStorage.getItem("imagiq_trade_in");
          if (!verifySave || verifySave !== tradeInString) {
            console.error("❌ ERROR: Trade-In NO se guardó correctamente en Step2");
            // Reintentar
            localStorage.setItem("imagiq_trade_in", tradeInString);
          } else {
            // console.log("✅ Trade-In guardado correctamente en Step2");
          }

          // Disparar eventos de storage
          try {
            globalThis.dispatchEvent(new CustomEvent("localStorageChange", {
              detail: { key: "imagiq_trade_in" },
            }));
            globalThis.dispatchEvent(new Event("storage"));
          } catch (eventError) {
            console.error("Error disparando eventos de storage:", eventError);
          }
        } catch (error) {
          console.error(
            "❌ Error al guardar trade-in en localStorage (respaldo):",
            error
          );
        }
        setTradeInData(tradeInDataToSave);
      }
    } catch (error) {
      // Fallback simple: guardar en localStorage como último recurso
      console.error("❌ Error al cargar trade-in desde localStorage:", error);
      const newTradeInData = {
        deviceName,
        value,
        completed: true,
      };
      try {
        const tradeInString = JSON.stringify(newTradeInData);
        localStorage.setItem("imagiq_trade_in", tradeInString);

        // Verificar que se guardó correctamente
        const verifySave = localStorage.getItem("imagiq_trade_in");
        if (!verifySave || verifySave !== tradeInString) {
          console.error("❌ ERROR: Trade-In NO se guardó correctamente en Step2 (fallback)");
          // Reintentar
          localStorage.setItem("imagiq_trade_in", tradeInString);
        } else {
          // console.log("✅ Trade-In guardado correctamente en Step2 (fallback)");
        }

        // Disparar eventos de storage
        try {
          globalThis.dispatchEvent(new CustomEvent("localStorageChange", {
            detail: { key: "imagiq_trade_in" },
          }));
          globalThis.dispatchEvent(new Event("storage"));
        } catch (eventError) {
          console.error("Error disparando eventos de storage:", eventError);
        }
      } catch (storageError) {
        console.error(
          "❌ Error al guardar trade-in en localStorage (fallback):",
          storageError
        );
      }
      setTradeInData(newTradeInData);
    }
    setIsTradeInModalOpen(false);
  };

  // Handler para cancelar sin completar
  const handleCancelWithoutCompletion = () => {
    setIsTradeInModalOpen(false);
  };

  // Calcular ahorro total por descuentos de productos (como en Step4OrderSummary)
  const productSavings = React.useMemo(() => {
    return cartProducts.reduce((total, product) => {
      if (product.originalPrice && product.originalPrice > product.price) {
        const saving = (product.originalPrice - product.price) * product.quantity;
        return total + saving;
      }
      return total;
    }, 0);
  }, [cartProducts]);

  // Estado derivado para reutilizar lógica de deshabilitado en el botón móvil
  const isMobileContinueDisabled =
    loading ||
    isSavingAddress ||
    (!isRegisteredAsGuest && !isGuestFormValid) ||
    (isRegisteredAsGuest && !hasAddedAddress && !isAddressFormValid) ||
    (guestStep !== 'verified' && guestStep !== 'form' && isRegisteredAsGuest) ||
    !tradeInValidation.isValid;

  // Estado para animación de bounce cuando el botón se habilita
  const wasDisabledRef = useRef(true);
  const [shouldAnimateButton, setShouldAnimateButton] = useState(false);

  useEffect(() => {
    const isDisabled = isMobileContinueDisabled;

    // Si estaba disabled y ahora está enabled → animar
    if (wasDisabledRef.current && !isDisabled) {
      setShouldAnimateButton(true);
      const timer = setTimeout(() => setShouldAnimateButton(false), 500);
      return () => clearTimeout(timer);
    }

    wasDisabledRef.current = isDisabled;
  }, [isMobileContinueDisabled]);

  // Clases consistentes con el botón verde del resumen (desktop)
  const mobileContinueButtonClasses = [
    "flex-shrink-0 font-bold py-4 px-6 rounded-xl text-lg transition text-white border-2",
    isMobileContinueDisabled
      ? "bg-gray-400 border-gray-300 cursor-not-allowed"
      : "bg-green-600 border-green-500 hover:bg-green-700 hover:border-green-600 shadow-lg shadow-green-500/40 hover:shadow-xl hover:shadow-green-500/50 cursor-pointer",
    shouldAnimateButton && "animate-buttonBounce",
  ]
    .filter(Boolean)
    .join(" ");

  // Ref para guardar el timeout de auto-avance
  const autoContinueTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Handler para cuando se agrega una dirección exitosamente
  const handleAddressAdded = async (address: Address) => {
    // console.log("🎯 [handleAddressAdded] INICIO - Dirección recibida:", {
    //       id: address.id,
    //       ciudad: address.ciudad,
    //       hasId: !!address.id
    //     });
    // console.log("✅ Dirección agregada exitosamente:", address);
    // console.log("📦 DEBUG - Productos en carrito:", {
    //       length: cartProducts.length,
    //       products: cartProducts.map(p => ({ sku: p.sku, quantity: p.quantity, name: p.name }))
    //     });

    // CRÍTICO: Guardar la dirección en checkout-address INMEDIATAMENTE
    // Esto es necesario para que Step3 y Step4 puedan leer la dirección
    // console.log("💾 [handleAddressAdded] Guardando dirección en checkout-address...");
    try {
      // IMPORTANTE: Obtener userId de forma consistente
      const { getUserId } = await import('@/app/carrito/utils/getUserId');
      const userId = getUserId();

      // Obtener email del usuario desde localStorage
      const savedUser = safeGetLocalStorage<{ email?: string; id?: string } | null>("imagiq_user", null);
      const userEmail = savedUser?.email || '';

      const checkoutAddress = {
        id: address.id,
        usuario_id: userId || address.usuarioId || '',
        email: userEmail,
        linea_uno: address.lineaUno || address.direccionFormateada || '',
        codigo_dane: address.codigo_dane || '',
        ciudad: address.ciudad || '',
        pais: address.pais || 'Colombia',
        esPredeterminada: address.esPredeterminada || true,
      };
      localStorage.setItem('checkout-address', JSON.stringify(checkoutAddress));
      // console.log('✅ Dirección guardada en checkout-address con userId consistente:', {
      //         ...checkoutAddress,
      //         usuario_id: checkoutAddress.usuario_id
      //       });
    } catch (error) {
      console.error('❌ Error guardando dirección en checkout-address:', error);
    }

    // Activar estado de loading
    setIsSavingAddress(true);
    // console.log("🔄 Estado isSavingAddress activado");

    // NO mostrar toast ni avanzar automáticamente
    // El formulario mantiene el loading hasta que termine la consulta de candidate stores

    // Limpiar timeout anterior si existe
    if (autoContinueTimeoutRef.current) {
      clearTimeout(autoContinueTimeoutRef.current);
    }

    // NO disparar evento checkout-address-changed porque ya vamos a llamar
    // directamente al endpoint de candidate stores aquí
    // Esto evita recálculos duplicados en useDelivery

    // IMPORTANTE: Limpiar el caché de candidate stores ANTES de calcular los nuevos
    // Esto es crucial porque la dirección cambió y necesitamos datos frescos
    try {
      // console.log("🗑️ Intentando limpiar caché...");
      const { invalidateCacheOnAddressChange } = await import('@/app/carrito/utils/globalCanPickUpCache');
      const wasInvalidated = invalidateCacheOnAddressChange(address.id);
      // console.log('🗑️ Caché de candidate stores:', wasInvalidated ? 'limpiado' : 'ya estaba limpio');
    } catch (error) {
      console.error('❌ Error limpiando caché:', error);
    }

    // IMPORTANTE: Esperar un momento para que la dirección se guarde completamente en la BD
    // antes de consultar candidate stores
    // console.log('⏳ Esperando a que la dirección se guarde completamente...');
    await new Promise(resolve => setTimeout(resolve, 500));
    // console.log('✅ Delay completado');

    // Llamar al endpoint de candidate stores y esperar la respuesta
    try {
      // console.log('🔄 Iniciando consulta de candidate stores...');
      const { productEndpoints } = await import('@/lib/api');
      // console.log('✅ Módulo productEndpoints importado');

      // IMPORTANTE: Obtener userId de forma consistente usando la utilidad centralizada
      const { getUserId } = await import('@/app/carrito/utils/getUserId');
      const userId = getUserId();

      // console.log('👤 DEBUG - Usuario obtenido:', {
      //         userId,
      //         hasUserId: !!userId
      //       });

      if (!userId) {
        console.error('❌ No se encontró user_id para consultar candidate stores');
        // console.log('⚠️ Avanzando al Step3 sin consultar candidate stores (no hay userId)');
        // Avanzar sin candidate stores si no hay userId
        setHasAddedAddress(true);
        setIsSavingAddress(false);
        if (typeof onContinue === "function") {
          onContinue();
        }
        return;
      }

      // Preparar los productos en el formato esperado
      const products = cartProducts.map(p => ({
        sku: p.sku,
        quantity: p.quantity || 1,
      }));

      // console.log('📦 DEBUG - Productos preparados:', {
      //         productsCount: products.length,
      //         products
      //       });

      // IMPORTANTE: Usar el addressId de la dirección recién agregada
      // Si no hay ID en address, intentar leer de checkout-address que acabamos de guardar
      let addressId = address.id;
      if (!addressId) {
        const storedAddress = localStorage.getItem('checkout-address');
        if (storedAddress) {
          try {
            const parsed = JSON.parse(storedAddress);
            addressId = parsed.id;
            // console.log('📦 [handleAddressAdded] addressId obtenido de checkout-address:', addressId);
          } catch (e) {
            console.error('❌ Error leyendo checkout-address para addressId:', e);
          }
        }
      }

      // console.log('📦 Consultando candidate stores con:', {
      //         userId,
      //         addressId,
      //         productsCount: products.length,
      //         products: products.map(p => ({ sku: p.sku, quantity: p.quantity }))
      //       });

      // console.log('🌐 Llamando a productEndpoints.getCandidateStores...');
      // Llamar al endpoint de candidate stores y procesar la respuesta
      const response = await productEndpoints.getCandidateStores({
        products,
        user_id: userId,
      });
      // console.log('✅ Respuesta recibida del endpoint');

      // console.log('✅ Candidate stores consultados exitosamente:', {
      //         canPickUp: response?.data?.canPickUp,
      //         storesCount: response?.data?.stores ? Object.keys(response.data.stores).length : 0,
      //         hasData: !!response?.data,
      //         responseKeys: response?.data ? Object.keys(response.data) : []
      //       });

      // IMPORTANTE: Procesar y guardar la respuesta en el caché
      // Esto es crucial para que Step3 pueda leer los datos del caché
      if (response?.data) {
        // console.log('💾 [handleAddressAdded] Guardando respuesta en caché...');
        // Importar las funciones de caché
        const { buildGlobalCanPickUpKey, setGlobalCanPickUpCache } = await import('@/app/carrito/utils/globalCanPickUpCache');
        // console.log('📦 [handleAddressAdded] Funciones de caché importadas');

        // Construir la clave de caché con el addressId correcto
        const cacheKey = buildGlobalCanPickUpKey({
          userId,
          products,
          addressId,
        });
        // console.log('🔑 [handleAddressAdded] Clave de caché construida:', cacheKey);
        // console.log('🔍 [handleAddressAdded] DEBUG COMPLETO AL GUARDAR:');
        // console.log('  - userId:', userId);
        // console.log('  - addressId:', addressId);
        // console.log('  - products:', products);
        // console.log('  - canPickUp:', response.data.canPickUp);
        // console.log('  - cacheKey completa:', cacheKey);

        // Guardar en caché con la respuesta completa
        setGlobalCanPickUpCache(cacheKey, response.data.canPickUp, response.data, addressId);
        // console.log('✅ [handleAddressAdded] Respuesta guardada en caché:', {
        //           cacheKey,
        //           canPickUp: response.data.canPickUp,
        //           addressId
        //         });

        // Verificar que se guardó correctamente
        if (typeof window !== 'undefined') {
          const stored = window.localStorage.getItem('imagiq_candidate_stores_cache');
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              // console.log('✅ [handleAddressAdded] VERIFICACIÓN - Caché guardado en localStorage:');
              // console.log('  - key en caché:', parsed.key);
              // console.log('  - addressId en caché:', parsed.addressId);
              // console.log('  - canPickUp en caché:', parsed.value);
              // console.log('  - ¿Las claves coinciden?', parsed.key === cacheKey);
            } catch (e) {
              console.error('  - Error verificando caché:', e);
            }
          } else {
            console.error('❌ [handleAddressAdded] VERIFICACIÓN FALLIDA - NO se guardó en localStorage');
          }
        }
      } else {
        console.warn('⚠️ [handleAddressAdded] La respuesta del endpoint no contiene datos para guardar en caché');
      }

      // IMPORTANTE: Solo avanzar DESPUÉS de guardar en caché exitosamente
      // console.log('🏁 [handleAddressAdded] Candidate stores calculado y guardado en caché, ahora sí avanzando a Step3');

      // Marcar que se agregó la dirección exitosamente
      setHasAddedAddress(true);
      setIsSavingAddress(false);

      if (typeof onContinue === "function") {
        // console.log("✅ Avanzando automáticamente a Step3");
        onContinue();
      } else {
        console.warn("⚠️ No se puede avanzar - onContinue no es una función");
      }

    } catch (error) {
      console.error('❌ Error consultando candidate stores:', error);
      console.error('❌ Detalles del error:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      // IMPORTANTE: Avanzar de todas formas al Step3 a pesar del error
      // console.log('⚠️ Avanzando al Step3 a pesar del error en candidate stores');
      setHasAddedAddress(true);
      setIsSavingAddress(false);
      if (typeof onContinue === "function") {
        onContinue();
      }
    }
  };

  // Cleanup del timeout al desmontar
  React.useEffect(() => {
    return () => {
      if (autoContinueTimeoutRef.current) {
        clearTimeout(autoContinueTimeoutRef.current);
      }
    };
  }, []);

  // Handle Trade-In removal (ahora abre el modal para cambiar producto)
  const handleRemoveTradeIn = () => {
    // Abrir modal para cambiar producto en lugar de remover directamente
    handleOpenTradeInModal();
  };

  // Ref para rastrear SKUs que ya fueron verificados (evita loops infinitos)
  const verifiedSkusRef = React.useRef<Set<string>>(new Set());
  // Ref para rastrear SKUs que fallaron (evita reintentos de peticiones fallidas)
  const failedSkusRef = React.useRef<Set<string>>(new Set());

  // Verificar indRetoma para cada producto único en segundo plano (sin mostrar nada en UI)
  useEffect(() => {
    if (cartProducts.length === 0) return;

    const verifyTradeIn = async () => {
      // Obtener SKUs únicos de productos individuales (sin duplicados)
      const uniqueSkus = Array.from(new Set(cartProducts.map((p) => p.sku)));

      // Obtener productSku únicos de bundles (sin duplicados)
      const uniqueBundleSkus = Array.from(
        new Set(
          cartProducts
            .filter((p) => p.bundleInfo?.productSku)
            .map((p) => p.bundleInfo!.productSku)
        )
      );

      // Filtrar productos individuales que necesitan verificación
      const productsToVerify = uniqueSkus.filter((sku) => {
        const product = cartProducts.find((p) => p.sku === sku);
        // Solo productos sin bundleInfo y sin indRetoma definido
        const needsVerification =
          product &&
          !product.bundleInfo &&
          product.indRetoma === undefined;
        const notVerifiedYet = !verifiedSkusRef.current.has(sku);
        const notFailedBefore = !failedSkusRef.current.has(sku);
        return needsVerification && notVerifiedYet && notFailedBefore;
      });

      // Filtrar bundles que necesitan verificación (usando productSku)
      const bundlesToVerify = uniqueBundleSkus.filter((productSku) => {
        const bundleProduct = cartProducts.find(
          (p) => p.bundleInfo?.productSku === productSku
        );
        const needsVerification =
          bundleProduct &&
          bundleProduct.bundleInfo?.ind_entre_estre === undefined;
        const notVerifiedYet = !verifiedSkusRef.current.has(productSku);
        const notFailedBefore = !failedSkusRef.current.has(productSku);
        return needsVerification && notVerifiedYet && notFailedBefore;
      });

      // Combinar todos los SKUs a verificar (productos individuales + bundles)
      const allSkusToVerify = [...productsToVerify, ...bundlesToVerify];

      if (allSkusToVerify.length === 0) return;

      // Verificar cada SKU único (productos individuales y bundles)
      for (let i = 0; i < allSkusToVerify.length; i++) {
        const sku = allSkusToVerify[i];
        const isBundle = bundlesToVerify.includes(sku);

        // PROTECCIÓN: Verificar si este SKU ya falló antes (ANTES del delay y try)
        if (failedSkusRef.current.has(sku)) {
          console.error(
            `🚫 SKU ${sku} ya falló anteriormente. NO se reintentará para evitar sobrecargar la base de datos.`
          );
          verifiedSkusRef.current.add(sku); // Marcar como verificado para no intentar de nuevo
          continue; // Saltar este SKU
        }

        // Agregar delay entre peticiones (excepto la primera)
        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        try {
          // Para bundles, usar productSku; para productos normales, usar sku
          const skuToCheck = isBundle ? sku : sku; // sku ya es productSku si es bundle
          const response = await tradeInEndpoints.checkSkuForTradeIn({ sku: skuToCheck });
          if (!response.success || !response.data) {
            // Si falla la petición, marcar como fallido
            failedSkusRef.current.add(sku);
            console.error(
              `🚫 Petición falló para SKU ${skuToCheck}. NO se reintentará automáticamente para proteger la base de datos.`
            );
            verifiedSkusRef.current.add(sku);
            continue;
          }
          const result = response.data;
          const indRetoma = result.indRetoma ?? (result.aplica ? 1 : 0);

          // Marcar SKU como verificado ANTES de actualizar localStorage (evita loop)
          verifiedSkusRef.current.add(sku);
          // Limpiar de fallos si existía
          failedSkusRef.current.delete(sku);

          // Actualizar localStorage con el resultado
          const storedProducts = JSON.parse(
            localStorage.getItem("cart-items") || "[]"
          ) as Array<Record<string, unknown>>;

          if (isBundle) {
            // Si es bundle, actualizar bundleInfo.ind_entre_estre
            const updatedProducts = storedProducts.map((p) => {
              if (p.bundleInfo && (p.bundleInfo as BundleInfo).productSku === sku) {
                return {
                  ...p,
                  bundleInfo: {
                    ...(p.bundleInfo as BundleInfo),
                    ind_entre_estre: indRetoma,
                  },
                };
              }
              return p;
            });
            localStorage.setItem("cart-items", JSON.stringify(updatedProducts));
          } else {
            // Si es producto normal, actualizar indRetoma
            const updatedProducts = storedProducts.map((p) => {
              if (p.sku === sku) {
                return { ...p, indRetoma };
              }
              return p;
            });
            localStorage.setItem("cart-items", JSON.stringify(updatedProducts));
          }

          // Disparar evento storage para sincronizar
          const customEvent = new CustomEvent("localStorageChange", {
            detail: { key: "cart-items" },
          });
          globalThis.dispatchEvent(customEvent);
          globalThis.dispatchEvent(new Event("storage"));
        } catch (error) {
          // Si hay un error en el catch, también marcar como fallido
          failedSkusRef.current.add(sku);
          console.error(
            `🚫 Error al verificar trade-in para SKU ${sku} - Petición bloqueada para evitar sobrecargar BD:`,
            error
          );
          console.error(`🚫 SKU ${sku} NO se reintentará automáticamente.`);
          // También marcar como verificado en caso de error para no reintentar infinitamente
          verifiedSkusRef.current.add(sku);
        }
      }
    };

    verifyTradeIn();
  }, [cartProducts]);

  return (
    <div className="w-full bg-white flex flex-col items-center py-8 px-2 md:px-0 pb-40 md:pb-16 relative">
      {/* Fondo blanco sólido para cubrir cualquier animación de fondo */}
      <div className="fixed inset-0 bg-white -z-10 pointer-events-none" />
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
        {/* Login y invitado */}
        <div className="col-span-1 lg:col-span-2 flex flex-col gap-8 lg:min-h-[70vh]">
          {/* Login - Solo mostrar si no está registrado como invitado */}
          {!isRegisteredAsGuest && (
            <Card className="bg-[#F3F3F3] border-0 shadow">
              <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle className="text-xl">Continua con inicio de sesión</CardTitle>
                  <CardDescription className="text-gray-700">
                    Envío gratis, acumular puntos y más
                    beneficios
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                  <Button
                    onClick={() => router.push("/login")}
                    className="bg-[#333] hover:bg-[#222] text-white font-bold py-3 px-8 h-auto"
                  >
                    Iniciar sesión
                  </Button>
                  <Link
                    href="/login/create-account"
                    className="text-[#0074E8] font-semibold underline"
                  >
                    Regístrate aquí
                  </Link>
                </div>
              </CardHeader>
            </Card>
          )}

          {/* Invitado - Mostrar formulario solo en paso 'form' */}
          {guestStep === 'form' && !isRegisteredAsGuest && (
            <Card className="border-0 shadow">
              <CardHeader>
                <CardTitle className="text-xl">Continua como invitado</CardTitle>
                <CardDescription className="text-gray-700">
                  Podrías estar
                  perdiendo Puntos beneficios exclusivos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="flex flex-col gap-4"
                  autoComplete="off"
                  onSubmit={handleGuestSubmit}
                >
                  {/* Email */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Label htmlFor="email">Correo electrónico *</Label>
                      {shouldShowError("email") && (
                        <span className="text-red-500 text-xs">{fieldErrors.email}</span>
                      )}
                    </div>
                    <Input
                      id="email"
                      type="email"
                      name="email"
                      placeholder="usuario@dominio.com"
                      value={guestForm.email}
                      onChange={handleGuestChange}
                      onBlur={handleGuestBlur}
                      required
                      disabled={loading || isRegisteredAsGuest}
                      autoFocus
                      className={`!h-11 ${shouldShowError("email") ? "border-red-500" : ""}`}
                    />
                  </div>

                  {/* Nombre y Apellido */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Label htmlFor="nombre">Nombre *</Label>
                        {shouldShowError("nombre") && (
                          <span className="text-red-500 text-xs">{fieldErrors.nombre}</span>
                        )}
                      </div>
                      <Input
                        id="nombre"
                        type="text"
                        name="nombre"
                        placeholder="Solo letras"
                        value={guestForm.nombre}
                        onChange={handleGuestChange}
                        onBlur={handleGuestBlur}
                        required
                        disabled={loading || isRegisteredAsGuest}
                        className={`!h-11 ${shouldShowError("nombre") ? "border-red-500" : ""}`}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Label htmlFor="apellido">Apellido *</Label>
                        {shouldShowError("apellido") && (
                          <span className="text-red-500 text-xs">{fieldErrors.apellido}</span>
                        )}
                      </div>
                      <Input
                        id="apellido"
                        type="text"
                        name="apellido"
                        placeholder="Solo letras"
                        value={guestForm.apellido}
                        onChange={handleGuestChange}
                        onBlur={handleGuestBlur}
                        required
                        disabled={loading || isRegisteredAsGuest}
                        className={`!h-11 ${shouldShowError("apellido") ? "border-red-500" : ""}`}
                      />
                    </div>
                  </div>

                  {/* Tipo de Documento y No. de Documento - Siempre en la misma línea */}
                  <div className="grid grid-cols-2 gap-2 sm:gap-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Label htmlFor="tipo_documento" className="hidden sm:inline">Tipo de Documento *</Label>
                        <Label htmlFor="tipo_documento" className="sm:hidden">Tipo Doc. *</Label>
                        {shouldShowError("tipo_documento") && (
                          <span className="text-red-500 text-xs">{fieldErrors.tipo_documento}</span>
                        )}
                      </div>
                      <Select
                        value={guestForm.tipo_documento}
                        onValueChange={(value) => handleSelectChange("tipo_documento", value)}
                        disabled={loading || isRegisteredAsGuest}
                      >
                        <SelectTrigger
                          id="tipo_documento"
                          className={`!h-11 w-full ${shouldShowError("tipo_documento") ? "border-red-500" : ""}`}
                        >
                          <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CC">CC</SelectItem>
                          <SelectItem value="CE">CE</SelectItem>
                          <SelectItem value="NIT">NIT</SelectItem>
                          <SelectItem value="PP">PP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Label htmlFor="cedula" className="hidden sm:inline">No. de Documento *</Label>
                        <Label htmlFor="cedula" className="sm:hidden">No. Doc. *</Label>
                        {shouldShowError("cedula") && (
                          <span className="text-red-500 text-xs">{fieldErrors.cedula}</span>
                        )}
                      </div>
                      <Input
                        id="cedula"
                        type="text"
                        inputMode="numeric"
                        name="cedula"
                        placeholder="6 a 10 números"
                        value={guestForm.cedula}
                        onChange={handleGuestChange}
                        onBlur={handleGuestBlur}
                        required
                        disabled={loading || isRegisteredAsGuest}
                        maxLength={10}
                        className={`!h-11 ${shouldShowError("cedula") ? "border-red-500" : ""}`}
                      />
                    </div>
                  </div>

                  {/* Celular con código de país */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Label htmlFor="celular">Celular *</Label>
                      {shouldShowError("celular") && (
                        <span className="text-red-500 text-xs">{fieldErrors.celular}</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Select defaultValue="57" disabled={loading || isRegisteredAsGuest}>
                        <SelectTrigger className="!h-11 w-24 shrink-0">
                          <SelectValue placeholder="+57" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="57">🇨🇴 +57</SelectItem>
                          <SelectItem value="1">🇺🇸 +1</SelectItem>
                          <SelectItem value="34">🇪🇸 +34</SelectItem>
                          <SelectItem value="52">🇲🇽 +52</SelectItem>
                          <SelectItem value="54">🇦🇷 +54</SelectItem>
                          <SelectItem value="56">🇨🇱 +56</SelectItem>
                          <SelectItem value="51">🇵🇪 +51</SelectItem>
                          <SelectItem value="593">🇪🇨 +593</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        id="celular"
                        type="text"
                        inputMode="numeric"
                        name="celular"
                        placeholder="10 números, empieza con 3"
                        value={guestForm.celular}
                        onChange={handleGuestChange}
                        onBlur={handleGuestBlur}
                        required
                        disabled={loading || isRegisteredAsGuest}
                        maxLength={10}
                        className={`!h-11 flex-1 ${shouldShowError("celular") ? "border-red-500" : ""}`}
                      />
                    </div>
                  </div>

                  {/* Mensaje de error general */}
                  {error && (
                    <div className="text-red-500 text-sm mt-2 text-center bg-red-50 py-2 px-4 rounded-lg">
                      {error}
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>
          )}

          {/* Vista OTP - Mostrar cuando está en paso 'otp' */}
          {guestStep === 'otp' && !isRegisteredAsGuest && (
            <Card className="border-gray-200">
              <CardHeader className="flex flex-row items-baseline gap-2 flex-wrap">
                <CardTitle className="text-xl">Verifica tu cuenta</CardTitle>
                <CardDescription className="text-gray-700 mt-0">
                  Enviaremos un código de verificación para completar tu registro
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <OTPStep
                  email={guestForm.email}
                  telefono={guestForm.celular}
                  otpCode={otpCode}
                  otpSent={otpSent}
                  sendMethod={sendMethod}
                  onOTPChange={(code) => {
                    setOtpCode(code);
                    // Limpiar error cuando el usuario empieza a escribir un nuevo código
                    if (error) setError("");
                  }}
                  onSendOTP={handleSendOTP}
                  onMethodChange={setSendMethod}
                  onChangeEmail={async (newEmail: string) => {
                    // Actualizar el email en el formulario
                    setGuestForm({ ...guestForm, email: newEmail });
                    setOtpSent(false);
                    setOtpCode("");
                  }}
                  onChangePhone={async (newPhone: string) => {
                    // Actualizar el teléfono en el formulario
                    setGuestForm({ ...guestForm, celular: newPhone });
                    setOtpSent(false);
                    setOtpCode("");
                  }}
                  disabled={loading}
                  showSendButton={true}
                  onVerifyOTP={handleVerifyOTP}
                  loading={loading}
                  error={error}
                />

                {/* Botón para volver al formulario */}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setGuestStep('form');
                    setOtpSent(false);
                    setOtpCode("");
                    sessionStorage.removeItem("guest-otp-process");
                  }}
                  disabled={loading}
                  className="text-gray-600 hover:text-gray-800 text-sm"
                >
                  ← Volver a editar datos
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Formulario de dirección - Mostrar siempre cuando está registrado como invitado */}
          {isRegisteredAsGuest && (
            <Card className="shadow-lg">
              <CardContent className="pt-6">
                <AddNewAddressForm
                  onAddressAdded={handleAddressAdded}
                  onCancel={() => setIsRegisteredAsGuest(false)}
                  withContainer={false}
                  onSubmitRef={addressFormSubmitRef}
                  onContinueRef={addressFormContinueRef}
                  onFormValidChange={setIsAddressFormValid}
                  onStepChange={setAddressFormStep}
                  disabled={hasAddedAddress}
                  geoLocationData={geoLocationData}
                  isRequestingLocation={isRequestingLocation}
                  enableAutoSelect={true}
                  headerTitle="¿Dónde te encuentras?"
                />
              </CardContent>
            </Card>
          )}
        </div>
        {/* Resumen de compra con Step4OrderSummary - Hidden en mobile y tablet */}
        <aside className="hidden lg:flex flex-col gap-4 self-start sticky top-40">
          <div className="w-full">
            <Step4OrderSummary
              onFinishPayment={
                // Si está registrado como invitado y no tiene dirección, hacer submit del formulario
                isRegisteredAsGuest && !hasAddedAddress
                  ? () => {
                    if (addressFormSubmitRef.current) {
                      addressFormSubmitRef.current();
                    }
                  }
                  : handleContinue
              }
              onBack={onBack}
              buttonText={
                loading
                  ? "Procesando..."
                  : isSavingAddress
                    ? "Guardando"
                    : guestStep === 'form'
                      ? "Registrarse"
                      : guestStep === 'otp' && !otpSent
                        ? "Enviar código"
                        : guestStep === 'otp' && otpSent
                          ? "Verificar código"
                          : !hasAddedAddress
                            ? (addressFormStep === 1 ? "Continuar" : "Agregar dirección")
                            : "Continuar pago"
              }
              disabled={
                loading ||
                isSavingAddress ||
                (!isRegisteredAsGuest && !isGuestFormValid) ||
                (isRegisteredAsGuest && !hasAddedAddress && !isAddressFormValid) ||
                (guestStep === 'otp' && otpSent && otpCode.length !== 6) ||
                (guestStep !== 'verified' && guestStep !== 'form') ||
                !tradeInValidation.isValid
              }
              isProcessing={loading || isSavingAddress}
              isSticky={true}
              deliveryMethod={
                globalThis.window !== undefined
                  ? (() => {
                    const method = globalThis.window.localStorage.getItem(
                      "checkout-delivery-method"
                    );
                    if (method === "tienda") return "pickup";
                    if (method === "domicilio") return "delivery";
                    if (method === "delivery" || method === "pickup")
                      return method;
                    return undefined;
                  })()
                  : undefined
              }
              shouldCalculateCanPickUp={false}
              buttonVariant="green"
              hideButton={guestStep === 'otp' || (isRegisteredAsGuest && !hasAddedAddress)}
              shouldAnimateButton={shouldAnimateButton}
            />
          </div>

          {/* Banner de Trade-In - Debajo del resumen (baja con el scroll) */}
          {tradeInData?.completed && (
            <TradeInCompletedSummary
              deviceName={tradeInData.deviceName}
              tradeInValue={tradeInData.value}
              onEdit={handleRemoveTradeIn}
              validationError={
                tradeInValidation.isValid === false
                  ? getTradeInValidationMessage(tradeInValidation)
                  : undefined
              }
            />
          )}
        </aside>
      </div>

      {/* Sticky Bottom Bar - Solo Mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="p-4 pb-8 flex items-center justify-between gap-4">
          {/* Izquierda: Total y descuentos */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-500">
              Total ({cartProducts.reduce((acc, p) => acc + p.quantity, 0)} productos)
            </p>
            <p className="text-2xl font-bold text-gray-900">
              $ {Number(calculations.total).toLocaleString()}
            </p>
            {productSavings > 0 && (
              <p className="text-sm text-green-600 font-medium">
                -$ {Number(productSavings).toLocaleString()} desc.
              </p>
            )}
          </div>

          {/* Derecha: Botón continuar */}
          <button
            className={mobileContinueButtonClasses}
            onClick={() => {
              // Si está en el formulario de dirección, usar el ref de continuar
              if (isRegisteredAsGuest && !hasAddedAddress && addressFormContinueRef.current) {
                addressFormContinueRef.current();
              } else {
                handleContinue();
              }
            }}
            disabled={isMobileContinueDisabled}
          >
            {loading
              ? "Procesando..."
              : isSavingAddress
                ? "Guardando"
                : guestStep === 'form' && !isRegisteredAsGuest
                  ? "Registrarse"
                  : guestStep === 'otp' && !otpSent
                    ? "Enviar código"
                    : guestStep === 'otp' && otpSent
                      ? "Verificar código"
                      : !hasAddedAddress
                        ? (addressFormStep === 1 ? "Continuar" : "Agregar dirección")
                        : "Continuar"}
          </button>
        </div>
      </div>

      {/* Modal de Trade-In para cambiar producto */}
      <TradeInModal
        isOpen={isTradeInModalOpen}
        onClose={() => setIsTradeInModalOpen(false)}
        onCompleteTradeIn={handleCompleteTradeIn}
        onCancelWithoutCompletion={handleCancelWithoutCompletion}
        productSku={selectedProductForTradeIn?.sku}
        productName={selectedProductForTradeIn?.name}
        skuPostback={selectedProductForTradeIn?.skuPostback}
      />
    </div>
  );
}
