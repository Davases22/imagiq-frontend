"use client";

import { Button } from "@/components/ui/button";
import Modal from "@/components/ui/Modal";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Documento, SupportOrderResponse } from "@/types/support";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import usePaySupportTicket from "@/hooks/usePaySupportTicket";
import { useAuthContext } from "@/features/auth/context";
import { getDocumentAbbreviation } from "@/lib/document-type";
import { apiPost } from "@/lib/api-client";
import { ArrowLeft, CreditCard, Building2, ChevronDown } from "lucide-react";
import pseLogo from "@/img/iconos/logo-pse.png";
import cardValidator from "card-validator";
import AnimatedCard from "@/components/ui/AnimatedCard";
import { associateEmailWithSession } from "@/lib/posthogClient";
import posthog from "posthog-js";

type DocumentoWithRegistro = Documento & { registro?: string };

type PaySupportResult = {
  redirect_url?: string;
  requires3DS?: boolean;
  ticketId?: string;
  orderId?: string;
  data3DS?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
};

// Tipo para bancos PSE
interface Bank {
  bankCode: string;
  bankName: string;
}

// Interfaz para datos de tarjeta
interface CardData {
  number: string;
  holder: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  installments: string;
}

// Función para obtener bancos
async function fetchBanks(): Promise<Bank[]> {
  try {
    const response = await apiClient.get<Bank[]>("/api/payments/epayco/banks");
    return response.data;
  } catch (error) {
    console.error("Error fetching banks:", error);
    return [];
  }
}

type PaymentMethod = "tarjeta" | "pse";
type ModalStep = "resumen" | "pago";

export default function InicioDeSoportePage() {
  const [cedula, setCedula] = useState("");
  const [orden, setOrden] = useState("");
  const [errors, setErrors] = useState<{ cedula?: string; orden?: string }>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [result, setResult] = useState<SupportOrderResponse | null>(null);
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Estados para el paso de pago
  const [modalStep, setModalStep] = useState<ModalStep>("resumen");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("tarjeta");
  const [selectedBank, setSelectedBank] = useState("");
  const [banks, setBanks] = useState<Bank[]>([]);
  const [isLoadingBanks, setIsLoadingBanks] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [submittedCedula, setSubmittedCedula] = useState<string | null>(null);
  const [submittedOrder, setSubmittedOrder] = useState<string | null>(null);
  const { pay } = usePaySupportTicket();
  const { logout, user } = useAuthContext();
  const router = useRouter();
  const isRedirectingRef = useRef(false);

  // 3DS message listener — mirrors Step7.tsx pattern
  useEffect(() => {
    const handle3DSMessage = (event: MessageEvent) => {
      if (!event.data) return;

      let data = event.data;
      if (typeof data === "string") {
        try { data = JSON.parse(data); } catch { /* ignore non-JSON */ }
      }

      const isEpaycoEvent =
        data.success !== undefined ||
        data.message !== undefined ||
        (data.data && data.data.ref_payco) ||
        data.MessageType === "profile.completed";

      if (!isEpaycoEvent) return;
      if (isRedirectingRef.current) return;

      if (
        (data.success && data.success !== "false") ||
        (data.data && data.data.ref_payco)
      ) {
        const orderId = localStorage.getItem("pending_support_order_id");
        if (orderId) {
          isRedirectingRef.current = true;
          localStorage.removeItem("pending_support_order_id");
          router.push(`/support/verify-purchase/${orderId}`);
        }
      } else if (
        data.success === false ||
        data.message === "Error" ||
        (data.MessageType === "profile.completed" && data.Status === false)
      ) {
        localStorage.removeItem("pending_support_order_id");
        setIsProcessingPayment(false);
        alert("La autenticación 3D Secure falló. Intenta con otro medio de pago.");
        try {
          document.querySelectorAll("iframe").forEach((iframe) => {
            if (iframe.src.includes("epayco") || iframe.src.includes("3ds") || !iframe.id) {
              iframe.remove();
            }
          });
          document.body.style.overflow = "";
        } catch { /* ignore cleanup errors */ }
      }
    };

    window.addEventListener("message", handle3DSMessage);
    return () => window.removeEventListener("message", handle3DSMessage);
  }, [router]);

  // Silent user ensure state (invisible to user)
  const [ensuredUserId, setEnsuredUserId] = useState<string | null>(null);

  // Read support verification results from query params (status, orderId)
  const searchParams = useSearchParams();
  const [supportStatus, setSupportStatus] = useState<string | null>(null);
  const [supportOrderId, setSupportOrderId] = useState<string | null>(null);

  useEffect(() => {
    const s = searchParams?.get("status");
    const o = searchParams?.get("orderId");
    if (s) setSupportStatus(s);
    if (o) setSupportOrderId(o);
  }, [searchParams]);

  // Estados para el formulario de tarjeta
  const [cardData, setCardData] = useState<CardData>({
    number: "",
    holder: "",
    expiryMonth: "",
    expiryYear: "",
    cvv: "",
    installments: "1",
  });

  // Cargar bancos cuando se selecciona PSE
  useEffect(() => {
    if (paymentMethod === "pse" && banks.length === 0) {
      setIsLoadingBanks(true);
      fetchBanks()
        .then(setBanks)
        .finally(() => setIsLoadingBanks(false));
    }
  }, [paymentMethod, banks.length]);

  // Funciones de validación de tarjeta
  const validateCardNumber = (number: string) => {
    const validation = cardValidator.number(number);
    return validation.isValid;
  };

  const getCardBrand = (number: string) => {
    const validation = cardValidator.number(number);
    return validation.card?.type || "";
  };

  const validateCVV = (cvvValue: string) => {
    if (!cvvValue) return false;
    const brand = getCardBrand(cardData.number);
    const isAmex =
      brand?.toLowerCase().includes("american") ||
      brand?.toLowerCase().includes("amex");
    const expectedLength = isAmex ? 4 : 3;
    return cvvValue.length === expectedLength && /^\d+$/.test(cvvValue);
  };

  // Formatear número de tarjeta
  const formatCardNumber = (value: string) => {
    const cleaned = value.replaceAll(/\s/g, "");
    const groups = cleaned.match(/.{1,4}/g) || [];
    return groups.join(" ").substring(0, 19);
  };

  // Formatear fecha de expiración
  const formatExpiryDate = () => {
    if (!cardData.expiryMonth || !cardData.expiryYear) return "MM/AA";
    return `${cardData.expiryMonth}/${cardData.expiryYear.slice(-2)}`;
  };

  // Generar arrays para los dropdowns
  const months = [
    { value: "01", label: "01 - Enero" },
    { value: "02", label: "02 - Febrero" },
    { value: "03", label: "03 - Marzo" },
    { value: "04", label: "04 - Abril" },
    { value: "05", label: "05 - Mayo" },
    { value: "06", label: "06 - Junio" },
    { value: "07", label: "07 - Julio" },
    { value: "08", label: "08 - Agosto" },
    { value: "09", label: "09 - Septiembre" },
    { value: "10", label: "10 - Octubre" },
    { value: "11", label: "11 - Noviembre" },
    { value: "12", label: "12 - Diciembre" },
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 15 }, (_, i) => {
    const year = currentYear + i;
    return { value: year.toString(), label: year.toString() };
  });

  const installmentOptions = [
    { value: "1", label: "1 cuota" },
    { value: "2", label: "2 cuotas" },
    { value: "3", label: "3 cuotas" },
    { value: "6", label: "6 cuotas" },
    { value: "12", label: "12 cuotas" },
    { value: "24", label: "24 cuotas" },
    { value: "36", label: "36 cuotas" },
  ];

  // Handlers de inputs de tarjeta
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replaceAll(/\s/g, "");
    if (value.length <= 16) {
      setCardData((prev) => ({ ...prev, number: value }));
      if (cardErrors.number) {
        setCardErrors((prev) => ({ ...prev, number: "" }));
      }
    }
  };

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replaceAll(/\D/g, "");
    const brand = getCardBrand(cardData.number);
    const isAmex =
      brand?.toLowerCase().includes("american") ||
      brand?.toLowerCase().includes("amex");
    const maxLength = isAmex ? 4 : 3;

    if (value.length <= maxLength) {
      setCardData((prev) => ({ ...prev, cvv: value }));
      if (cardErrors.cvv) {
        setCardErrors((prev) => ({ ...prev, cvv: "" }));
      }
    }
  };

  // Validar formulario de tarjeta
  const validateCardForm = () => {
    const newErrors: Record<string, string> = {};

    if (!cardData.number || !validateCardNumber(cardData.number)) {
      newErrors.number = "Número de tarjeta inválido";
    }

    if (!cardData.holder.trim()) {
      newErrors.holder = "El nombre del titular es requerido";
    }

    if (!cardData.expiryMonth) {
      newErrors.expiryMonth = "Selecciona el mes";
    }

    if (!cardData.expiryYear) {
      newErrors.expiryYear = "Selecciona el año";
    }

    if (!cardData.cvv || !validateCVV(cardData.cvv)) {
      newErrors.cvv = "CVV inválido";
    }

    setCardErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validate = () => {
    const e: { cedula?: string; orden?: string } = {};
    const cedulaDigits = cedula.replaceAll(/\D/g, "");
    if (!cedulaDigits) e.cedula = "La cédula es requerida.";
    else if (cedulaDigits.length < 5) e.cedula = "Ingresa al menos 5 dígitos.";
    else if (cedulaDigits.length > 12) e.cedula = "Demasiados dígitos.";

    if (!orden.trim()) e.orden = "El número de orden es requerido.";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleGoToPayment = () => {
    setModalStep("pago");
  };

  const handleBackToResumen = () => {
    setModalStep("resumen");
  };

  const handleProcessPayment = async (doc: Documento) => {
    // Validar según el método de pago
    if (paymentMethod === "tarjeta" && !validateCardForm()) {
      return;
    }

    // Pre-flight: validar que los datos del documento de Novasoft estén completos
    const cedulaSource = submittedCedula ?? cedula;
    const cedulaDigits = cedulaSource ? cedulaSource.replace(/\D/g, "") : "";
    const numeroOrden =
      submittedOrder ??
      orden ??
      (doc as DocumentoWithRegistro).registro ??
      doc.documento ??
      "";

    const missingFields: string[] = [];
    if (!doc.email?.trim()) missingFields.push("email");
    if (!doc.movil?.trim()) missingFields.push("teléfono");
    if (!doc.estadoCodigo?.trim()) missingFields.push("estado del documento");
    if (!doc.cliente?.trim()) missingFields.push("nombre del cliente");
    if (!cedulaDigits) missingFields.push("documento de identidad");
    if (!numeroOrden.trim()) missingFields.push("número de orden");

    if (missingFields.length > 0) {
      alert(
        `No se puede procesar el pago. Faltan datos requeridos: ${missingFields.join(", ")}. Por favor contacta a soporte.`
      );
      return;
    }

    setIsProcessingPayment(true);

    try {
      // Construir payload base
      const raw = (doc.valor || "0").toString();

      // Normalize monetary string to backend-expected integer string.
      // Handles values like:
      // - "6.384,11"  -> "638411" (cents)
      // - "638,411.0000" -> "638411" (already whole units with 4-decimals zeroed)
      // - "1000" -> "1000"
      const normalizeMonetaryAmount = (value: string) => {
        const v = value.trim();
        if (!v) return "0";

        // Find last separator (dot or comma) to determine decimal separator
        const lastDot = v.lastIndexOf(".");
        const lastComma = v.lastIndexOf(",");
        let intPart = v;
        let decPart = "";

        if (lastDot > -1 || lastComma > -1) {
          if (lastDot > lastComma) {
            intPart = v.slice(0, lastDot);
            decPart = v.slice(lastDot + 1);
          } else if (lastComma > lastDot) {
            intPart = v.slice(0, lastComma);
            decPart = v.slice(lastComma + 1);
          }
        }

        // Keep only digits
        const intDigits = intPart.replace(/[^0-9]/g, "") || "0";
        const decDigits = decPart.replace(/[^0-9]/g, "");

        // If decimal part is exactly 4 digits and all zeros, treat as whole units
        if (decDigits.length === 4 && /^0{4}$/.test(decDigits)) {
          return intDigits;
        }

        // Otherwise convert to cents (2 digits). Take first two digits of decimal, pad if needed.
        const cents = (decDigits + "00").slice(0, 2);
        return `${intDigits}${cents}`;
      };

      const normalizedValor = normalizeMonetaryAmount(raw);

      const tipoDocRaw = (doc.tipoDocumento || "CC") as string;
      // Siempre enviar abreviación (CC, CE, etc.). Default CC si no se reconoce.
      const tipo_documento = getDocumentAbbreviation(tipoDocRaw) ?? "CC";

      // Session-replay id de PostHog. Permite que el correo "Pago Rechazado -
      // Soporte" incluya un link directo al replay para ops — antes había
      // que adivinar el usuario por email y abrir PostHog manualmente.
      // Safe-access: `__loaded` evita crashes cuando adblockers impiden
      // cargar el SDK.
      const posthogSessionId =
        typeof window !== "undefined" && posthog.__loaded
          ? posthog.get_session_id?.() || undefined
          : undefined;

      const payloadBase: Record<string, unknown> = {
        numero_orden: numeroOrden,
        usuario_email: (doc.email || "").toLowerCase().trim(),
        nombre_cliente: doc.cliente || "",
        concepto: doc.concepto || "Pago soporte",
        movil_usuario: doc.movil || "",
        medio_pago: paymentMethod === "tarjeta" ? 2 : 3,
        documento_usuario: cedulaDigits,
        tipo_documento: tipo_documento,
        estado: doc.estadoCodigo ?? "",
        valor: normalizedValor,
        ...(posthogSessionId && { posthogSessionId }),
      };

      // Campos específicos según medio de pago
      if (paymentMethod === "tarjeta") {
        Object.assign(payloadBase, {
          card_number: cardData.number.replace(/\s/g, ""),
          card_holder: cardData.holder.trim(),
          exp_month: cardData.expiryMonth,
          exp_year: cardData.expiryYear,
          cvv: cardData.cvv,
          cuotas: Number(cardData.installments) || 1,
        });
      }

      if (paymentMethod === "pse") {
        const found = banks.find((b) => b.bankCode === selectedBank);
        Object.assign(payloadBase, {
          banco_id: selectedBank,
          banco_nombre: found?.bankName || selectedBank || "",
        });
      }

      // Llamar al hook para pagar
      const result = (await pay(payloadBase)) as PaySupportResult;

      // Handle 3DS challenge if required
      if (result?.requires3DS && result?.data3DS) {
        if (result.orderId) {
          localStorage.setItem("pending_support_order_id", String(result.orderId));
        }
        if (typeof window !== "undefined" && window.validate3ds) {
          // Close payment modal so the 3DS modal is visible on top
          setIsModalOpen(false);
          setIsProcessingPayment(false);
          window.validate3ds(result.data3DS);
          return; // Redirect happens in the 3DS message listener
        } else {
          alert("Error: Script de validación 3DS no disponible. Recarga la página.");
          setIsProcessingPayment(false);
          return;
        }
      }

      if (result?.redirect_url) {
        try {
          new URL(result.redirect_url);
          if (/^https?:\/\//.test(result.redirect_url)) {
            globalThis.location.href = result.redirect_url;
            return;
          }
        } catch (err) {
          console.warn("URL de redirección inválida:", err);
        }
      }
      setIsModalOpen(false);
      setModalStep("resumen");
      resetCardForm();
    } catch (error) {
      console.error("Error procesando pago:", error);
      const msg =
        error instanceof Error ? error.message : "Error procesando pago";
      alert(msg);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const resetCardForm = () => {
    setCardData({
      number: "",
      holder: "",
      expiryMonth: "",
      expiryYear: "",
      cvv: "",
      installments: "1",
    });
    setCardErrors({});
    setIsCardFlipped(false);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setModalStep("resumen");
    setPaymentMethod("tarjeta");
    setSelectedBank("");
    resetCardForm();
    setEnsuredUserId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess("");
    if (!validate()) return;
    setLoading(true);

    try {
      await new Promise((r) => setTimeout(r, 900));

      console.log("Enviando solicitud de soporte:", { cedula, orden });

      const response = await apiClient.post<SupportOrderResponse>(
        "/api/orders/support-order",
        {
          numero_cedula: cedula,
          referencia: orden,
        }
      );

      setResult(response.data);
      // Store cedula and order sent with the support-order so payments use the same identifiers
      setSubmittedCedula(cedula.replace(/\D/g, ""));
      setSubmittedOrder(orden.trim() || null);
      setErrors({});
      setSuccess("Solicitud enviada correctamente.");
      setIsModalOpen(true);

      // Silently ensure user exists (create guest if needed) + internal logout if email differs
      const doc0 = response.data?.obtenerDocumentosResult?.documentos?.[0];
      if (doc0?.email) {
        // Associate SOAP email with PostHog session for replay identification
        associateEmailWithSession(doc0.email.toLowerCase().trim(), {
          $name: doc0.cliente || undefined,
        });

        // Full logout if logged-in user email differs from support order email
        if (user?.email) {
          const loggedEmail = user.email.toLowerCase().trim();
          const supportEmail = doc0.email.toLowerCase().trim();
          if (loggedEmail !== supportEmail) {
            logout();
          }
        }

        // Check if user exists, create guest automatically if not
        try {
          const supportEmail = doc0.email.toLowerCase().trim();
          const check = await apiPost<{ exists: boolean; userId: string | null }>(
            "/api/orders/support/check-user",
            { email: supportEmail }
          );

          if (check.exists && check.userId) {
            setEnsuredUserId(check.userId);
          } else {
            // Create guest account automatically with Imagiq data
            const tipoDocRaw = (doc0.tipoDocumento || "CC") as string;
            const tipoAbbr = getDocumentAbbreviation(tipoDocRaw);
            const guest = await apiPost<{ userId: string; created: boolean }>(
              "/api/orders/support/create-guest",
              {
                email: supportEmail,
                nombre_cliente: doc0.cliente || "",
                movil: doc0.movil || "",
                documento: cedula.replace(/\D/g, ""),
                tipo_documento: tipoAbbr ?? tipoDocRaw,
              }
            );
            setEnsuredUserId(guest.userId);
          }
        } catch (err) {
          console.error("Error checking/creating support user:", err);
        }
      }
    } catch (err) {
      console.error(err);
      setSuccess("Ocurrió un error al enviar la solicitud.");
    } finally {
      setLoading(false);
    }
  };

  // Obtener el documento con valor a pagar
  const getDocumentoConValor = () => {
    return result?.obtenerDocumentosResult?.documentos?.findLast(
      (d) => d?.valor && d.valor !== "0,0000" && d.estadoNombre === "En Cotización"
    );
  };

  // Formatear valor monetario
  const formatCurrency = (raw: string) => {
    const normalized = raw.replaceAll(".", "").replaceAll(",", ".");
    const value = Number(normalized);
    if (Number.isNaN(value)) return raw;
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  // Verificar si el pago está habilitado
  const isPaymentEnabled = () => {
    // Require that a cedula was submitted with the support-order before allowing payment
    if (!submittedCedula) return false;
    // Also require that a orden was submitted
    if (!submittedOrder) return false;
    if (paymentMethod === "pse" && !selectedBank) return false;
    if (paymentMethod === "tarjeta") {
      // Verificar que todos los campos de tarjeta estén completos
      if (
        !cardData.number ||
        !cardData.holder ||
        !cardData.expiryMonth ||
        !cardData.expiryYear ||
        !cardData.cvv
      ) {
        return false;
      }
    }
    return true;
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center flex items-center justify-center p-6"
      style={{ backgroundImage: "url('/images/fondo_soporte.jpg')" }}
    >
      <div className="bg-white/95 backdrop-blur-sm rounded-xl p-6 shadow-xl w-full max-w-4xl mx-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          {/* Columna izquierda: formulario */}
          <div className="lg:col-span-1 flex flex-col">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              Inicio de Soporte
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              Ingresa tu cédula y el número de orden para crear la solicitud de
              soporte. Responderemos a la mayor brevedad.
            </p>

            {success && (
              <div className="mb-6 flex items-center gap-2 px-4 py-3 bg-white border-l-4 border-green-600 rounded-r-lg shadow-sm">
                <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-sm text-gray-900 font-medium">
                  {success}
                </p>
              </div>
            )}

            {supportStatus && (
              <div
                className={`mb-6 w-full text-xs rounded-md p-3 block ${supportStatus === "APPROVED"
                  ? "bg-emerald-50 border border-emerald-100 text-emerald-800"
                  : supportStatus === "PENDING"
                    ? "bg-yellow-50 border border-yellow-100 text-yellow-800"
                    : "bg-rose-50 border border-rose-100 text-rose-800"
                  }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold">
                      {supportStatus === "APPROVED"
                        ? "Pago aprobado"
                        : supportStatus === "PENDING"
                          ? "Pago pendiente"
                          : "Pago rechazado"}
                    </div>
                    {supportOrderId && (
                      <div className="mt-1">
                        Número de orden: <strong>{supportOrderId}</strong>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setSupportStatus(null);
                      setSupportOrderId(null);
                      try {
                        // remove query params from URL
                        const url = new URL(window.location.href);
                        url.searchParams.delete("status");
                        url.searchParams.delete("orderId");
                        window.history.replaceState({}, "", url.toString());
                      } catch {
                        /* ignore */
                      }
                    }}
                    className="ml-4 text-sm opacity-80"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}



            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              {/* Campo C�dula */}
              <div>
                <label htmlFor="cedula" className="block text-sm font-medium">
                  Número de cédula
                </label>
                <div className="mt-1 relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden
                    >
                      <path
                        d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <input
                    id="cedula"
                    value={cedula}
                    onChange={(ev) => setCedula(ev.target.value.replace(/\D/g, ""))}
                    type="tel"
                    inputMode="numeric"
                    placeholder="Ej: 12345"
                    aria-label="Número de cédula"
                    aria-describedby={
                      errors.cedula ? "cedula-error" : undefined
                    }
                    autoFocus
                    className={`mt-0 block w-full rounded-lg border px-4 py-2 pl-10 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary ${errors.cedula ? "border-rose-500" : "border-gray-200"
                      } bg-white`}
                  />
                </div>
                {errors.cedula && (
                  <p id="cedula-error" className="mt-1 text-xs text-rose-600">
                    {errors.cedula}
                  </p>
                )}
              </div>

              {/* Campo Orden */}
              <div>
                <label htmlFor="orden" className="block text-sm font-medium">
                  Número de orden
                </label>
                <div className="mt-1 relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden
                    >
                      <path
                        d="M21 15V7a2 2 0 00-2-2h-6"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M3 9v6a2 2 0 002 2h6"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M7 7l10 10"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <input
                    id="orden"
                    value={orden}
                    onChange={(ev) => setOrden(ev.target.value)}
                    type="text"
                    placeholder="Ej: 2025-0001"
                    aria-label="Número de orden"
                    aria-describedby={errors.orden ? "orden-error" : undefined}
                    className={`mt-0 block w-full rounded-lg border px-4 py-2 pl-10 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary ${errors.orden ? "border-rose-500" : "border-gray-200"
                      } bg-white`}
                  />
                </div>
                {errors.orden && (
                  <p id="orden-error" className="mt-1 text-xs text-rose-600">
                    {errors.orden}
                  </p>
                )}
              </div>

              {/* Botones */}
              <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 bg-black text-white rounded-lg hover:bg-neutral-800 font-semibold shadow-md transition disabled:opacity-60"
                  >
                    {loading ? (
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                        ></path>
                      </svg>
                    ) : null}
                    {loading ? "Enviando..." : "Enviar"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCedula("");
                      setOrden("");
                      setErrors({});
                      setSuccess("");
                      setResult(null);
                    }}
                    className="px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
                  >
                    Limpiar
                  </button>
                </div>

                <p className="text-xs text-muted-foreground w-full sm:w-auto text-right hidden sm:block">
                  Los datos se usan solo para procesar tu solicitud.
                </p>
              </div>

              <p className="text-xs text-muted-foreground sm:hidden">
                Los datos se usan solo para procesar tu solicitud.
              </p>
            </form>
          </div>

          {/* Columna derecha: Consejos */}
          <div className="lg:col-span-1 flex flex-col">
            <h3 className="text-lg font-semibold mb-4">Consejos</h3>
            <ul className="list-disc pl-5 text-sm space-y-3 text-muted-foreground">
              <li>Asegúrate de ingresar la cédula sin puntos ni guiones.</li>
              <li>
                El número de orden lo encuentras en el correo de confirmación.
              </li>
              <li>
                Si necesitas ayuda urgente, contacta al soporte telefónico.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Modal de Resultado */}
      <Modal isOpen={isModalOpen} onClose={handleCloseModal} size="lg">
        <div className="p-5 md:p-6 pb-3 md:pb-4">
          {/* PASO 1: Resumen */}
          {modalStep === "resumen" && (
            <>
              {/* Header mejorado */}
              <div className="mb-5">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
                  Resumen de tu consulta
                </h2>
                {orden && (
                  <p className="text-sm text-gray-500 mt-1">
                    Orden #{orden}
                  </p>
                )}
              </div>

              {result && (
                <div className="space-y-4">
                  {/* Info del cliente - Diseño minimalista */}
                  {result.obtenerDocumentosResult?.documentos?.[0] && (
                    <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                      <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-semibold text-sm">
                          {result.obtenerDocumentosResult.documentos[0].cliente?.charAt(0)?.toUpperCase() || "?"}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">
                          {result.obtenerDocumentosResult.documentos[0].cliente}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {result.obtenerDocumentosResult.documentos[0].email}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Monto a pagar - Card destacada */}
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-2xl p-5">
                    <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider font-medium">
                      {result.obtenerDocumentosResult?.documentos?.some(
                        (d) => d.estadoNombre === "En Reparación" || d.estadoNombre === "Reparado"
                      ) ? "Monto pagado" : "Monto a pagar"}
                    </p>
                    <p
                      className={cn(
                        "font-bold leading-none text-gray-900",
                        result.obtenerDocumentosResult?.documentos?.every(
                          (r) => r.valor === "0,0000"
                        ) === true
                          ? "text-xl md:text-2xl"
                          : "text-4xl md:text-5xl"
                      )}
                    >
                      {(() => {
                        const doc = getDocumentoConValor();
                        const raw = doc?.valor;
                        if (!raw)
                          return (
                            <span className="text-lg md:text-xl text-gray-600">
                              {result.obtenerDocumentosResult?.documentos?.findLast(
                                (p) => p.valor === "0,0000"
                              )?.estadoNombre ||
                              "Pronto tendremos tu información!"}
                            </span>
                          );
                        return `$${formatCurrency(raw)}`;
                      })()}
                    </p>
                    {getDocumentoConValor() && !result.obtenerDocumentosResult?.documentos?.some(
                      (d) => d.estadoNombre === "En Reparación" || d.estadoNombre === "Reparado"
                    ) && (
                      <p className="text-sm text-gray-500 mt-3">
                        {getDocumentoConValor()?.tipo} · {getDocumentoConValor()?.concepto}
                      </p>
                    )}
                  </div>

                  {/* Lista de documentos - Timeline moderno */}
                  {(result.obtenerDocumentosResult?.documentos?.length ?? 0) >= 1 && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-3">
                        Historial
                      </p>
                      <div className="space-y-0 relative">
                        {/* Línea vertical conectora */}
                        <div className="absolute left-[5px] top-2 bottom-2 w-px bg-gray-200" />

                        {/* Documentos con links */}
                        {result.obtenerDocumentosResult.documentos.map(
                          (doc, index) => (
                            <div
                              key={doc.diffgrId || index}
                              className="flex items-start gap-4 py-2 relative"
                            >
                              <div className={cn(
                                "w-[11px] h-[11px] rounded-full border-2 border-white ring-1 flex-shrink-0 mt-0.5 z-10",
                                doc.estadoNombre === "En Cotización" ? "bg-blue-500 ring-blue-200" :
                                doc.estadoNombre === "En Reparación" ? "bg-amber-500 ring-amber-200" :
                                doc.estadoNombre === "Reparado" ? "bg-emerald-500 ring-emerald-200" :
                                doc.valor !== "0,0000" ? "bg-emerald-500 ring-emerald-200" : "bg-gray-300 ring-gray-200"
                              )} />
                              <div className="flex-1 flex items-center justify-between min-w-0 gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-900">{doc.tipo}</p>
                                  <p className="text-xs text-gray-400">{doc.estadoNombre} · {doc.fecha.split(" ")[0]}</p>
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0">
                                  <span className={cn(
                                    "text-sm tabular-nums font-medium",
                                    doc.valor === "0,0000" ? "text-gray-300" : "text-gray-900"
                                  )}>
                                    {doc.valor === "0,0000" ? "—" : `$${formatCurrency(doc.valor)}`}
                                  </span>
                                  {doc.url && (
                                    <a
                                      href={doc.url.replace('documentkey=/', 'documentkey=')}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs font-medium text-gray-900 hover:text-gray-600 underline underline-offset-2 cursor-pointer transition-colors"
                                    >
                                      Ver
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {/* Botones de acción */}
                  <div className="pt-1 flex items-center gap-2">
                    {/* Solo mostrar "Ir a pagar" si hay valor y NO está en reparación */}
                    {result.obtenerDocumentosResult?.documentos?.some(
                      (r) => r.valor !== "0,0000"
                    ) && !result.obtenerDocumentosResult?.documentos?.some(
                      (d) => d.estadoNombre === "En Reparación" || d.estadoNombre === "Reparado"
                    ) && (
                      <Button
                        onClick={handleGoToPayment}
                        type="button"
                        className="flex-1 h-11 bg-gray-900 text-white rounded-xl font-semibold text-sm shadow-sm transition-all cursor-pointer hover:bg-gray-800 hover:shadow-md"
                      >
                        Ir a pagar
                      </Button>
                    )}

                    {/* Mostrar "Descargar factura" solo cuando está reparado (factura DIAN real) */}
                    {(() => {
                      const isReparado = result.obtenerDocumentosResult?.documentos?.some(
                        (d) => d.estadoNombre === "En Reparación" || d.estadoNombre === "Reparado"
                      );

                      // Solo mostrar botón de factura cuando está reparado
                      if (!isReparado) return null;

                      const facturaUrl = result.obtenerDocumentosResult?.documentos?.find(d => d.tipo === "Factura")?.url;

                      // Limpiar la URL - quitar / después de documentkey=
                      const cleanUrl = facturaUrl?.replace('documentkey=/', 'documentkey=');

                      return cleanUrl && (
                        <Link
                          href={cleanUrl}
                          target="_blank"
                          className="flex-1 h-11 rounded-xl inline-flex items-center justify-center font-semibold text-sm transition-all cursor-pointer bg-gray-900 text-white shadow-sm hover:bg-gray-800 hover:shadow-md"
                        >
                          Descargar factura
                        </Link>
                      );
                    })()}

                    <button
                      onClick={handleCloseModal}
                      className="h-11 px-4 text-sm text-blue-900 hover:text-blue-700 font-medium transition-colors cursor-pointer"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* PASO 2: Selección de método de pago */}
          {modalStep === "pago" && result && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={handleBackToResumen}
                  className="p-1.5 hover:bg-gray-100 rounded-full transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h2 className="text-lg md:text-xl font-bold">
                  Elige cómo pagar
                </h2>
              </div>

              {/* Resumen del monto */}
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total a pagar:</span>
                  <span className="text-xl font-bold text-gray-900">
                    ${formatCurrency(getDocumentoConValor()?.valor || "0")}
                  </span>
                </div>
              </div>

              {/* Opciones de pago */}
              <div className="space-y-2 mb-4">
                {/* Tarjeta de crédito/débito */}
                <div>
                  <label
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                      paymentMethod === "tarjeta"
                        ? "border-gray-900 bg-gray-50"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <input
                      type="radio"
                      name="payment-method"
                      checked={paymentMethod === "tarjeta"}
                      onChange={() => setPaymentMethod("tarjeta")}
                      className="accent-black w-4 h-4"
                    />
                    <CreditCard className="w-5 h-5 text-gray-700" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">
                        Tarjeta de crédito o débito
                      </p>
                      <p className="text-xs text-gray-500">
                        Visa, Mastercard, American Express
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Image
                        src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg"
                        alt="Visa"
                        width={28}
                        height={18}
                        className="object-contain"
                      />
                      <Image
                        src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg"
                        alt="Mastercard"
                        width={28}
                        height={18}
                        className="object-contain"
                      />
                    </div>
                  </label>

                  {/* Formulario de tarjeta */}
                  {paymentMethod === "tarjeta" && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                      {/* Vista previa de la tarjeta */}
                      <div className="flex justify-center">
                        <div className="w-full max-w-[300px] scale-[0.9] -my-2">
                          <AnimatedCard
                            cardNumber={cardData.number}
                            cardHolder={cardData.holder}
                            expiryDate={formatExpiryDate()}
                            cvv={cardData.cvv}
                            brand={getCardBrand(cardData.number)}
                            isFlipped={isCardFlipped}
                          />
                        </div>
                      </div>

                      {/* Número de tarjeta */}
                      <div>
                        <label
                          htmlFor="card-number"
                          className="block text-xs font-medium text-gray-700 mb-1"
                        >
                          Número de tarjeta
                        </label>
                        <input
                          id="card-number"
                          type="text"
                          value={formatCardNumber(cardData.number)}
                          onChange={handleCardNumberChange}
                          placeholder="1234 5678 9012 3456"
                          className={cn(
                            "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm",
                            cardErrors.number
                              ? "border-red-500"
                              : "border-gray-300"
                          )}
                        />
                        {cardErrors.number && (
                          <p className="text-red-500 text-xs mt-0.5">
                            {cardErrors.number}
                          </p>
                        )}
                      </div>

                      {/* Nombre del titular */}
                      <div>
                        <label
                          htmlFor="card-holder"
                          className="block text-xs font-medium text-gray-700 mb-1"
                        >
                          Nombre del titular
                        </label>
                        <input
                          id="card-holder"
                          type="text"
                          value={cardData.holder}
                          onChange={(e) => {
                            setCardData((prev) => ({
                              ...prev,
                              holder: e.target.value.toUpperCase(),
                            }));
                            if (cardErrors.holder) {
                              setCardErrors((prev) => ({
                                ...prev,
                                holder: "",
                              }));
                            }
                          }}
                          placeholder="JUAN PÉREZ"
                          className={cn(
                            "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm uppercase",
                            cardErrors.holder
                              ? "border-red-500"
                              : "border-gray-300"
                          )}
                        />
                        {cardErrors.holder && (
                          <p className="text-red-500 text-xs mt-0.5">
                            {cardErrors.holder}
                          </p>
                        )}
                      </div>

                      {/* Fecha de expiración y CVV */}
                      <div className="grid grid-cols-3 gap-2">
                        {/* Mes */}
                        <div>
                          <label
                            htmlFor="expiry-month"
                            className="block text-xs font-medium text-gray-700 mb-1"
                          >
                            Mes
                          </label>
                          <select
                            id="expiry-month"
                            value={cardData.expiryMonth}
                            onChange={(e) => {
                              setCardData((prev) => ({
                                ...prev,
                                expiryMonth: e.target.value,
                              }));
                              if (cardErrors.expiryMonth) {
                                setCardErrors((prev) => ({
                                  ...prev,
                                  expiryMonth: "",
                                }));
                              }
                            }}
                            className={cn(
                              "w-full px-2 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm",
                              cardErrors.expiryMonth
                                ? "border-red-500"
                                : "border-gray-300"
                            )}
                          >
                            <option value="">MM</option>
                            {months.map((month) => (
                              <option key={month.value} value={month.value}>
                                {month.value}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Año */}
                        <div>
                          <label
                            htmlFor="expiry-year"
                            className="block text-xs font-medium text-gray-700 mb-1"
                          >
                            Año
                          </label>
                          <select
                            id="expiry-year"
                            value={cardData.expiryYear}
                            onChange={(e) => {
                              setCardData((prev) => ({
                                ...prev,
                                expiryYear: e.target.value,
                              }));
                              if (cardErrors.expiryYear) {
                                setCardErrors((prev) => ({
                                  ...prev,
                                  expiryYear: "",
                                }));
                              }
                            }}
                            className={cn(
                              "w-full px-2 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm",
                              cardErrors.expiryYear
                                ? "border-red-500"
                                : "border-gray-300"
                            )}
                          >
                            <option value="">AAAA</option>
                            {years.map((year) => (
                              <option key={year.value} value={year.value}>
                                {year.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* CVV */}
                        <div>
                          <label
                            htmlFor="card-cvv"
                            className="block text-xs font-medium text-gray-700 mb-1"
                          >
                            CVV
                          </label>
                          <input
                            id="card-cvv"
                            type="text"
                            value={cardData.cvv}
                            onChange={handleCvvChange}
                            onFocus={() => setIsCardFlipped(true)}
                            onBlur={() => setIsCardFlipped(false)}
                            placeholder={(() => {
                              const brand = getCardBrand(cardData.number);
                              const isAmex =
                                brand?.toLowerCase().includes("american") ||
                                brand?.toLowerCase().includes("amex");
                              return isAmex ? "1234" : "123";
                            })()}
                            className={cn(
                              "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm",
                              cardErrors.cvv
                                ? "border-red-500"
                                : "border-gray-300"
                            )}
                          />
                          {cardErrors.cvv && (
                            <p className="text-red-500 text-xs mt-0.5">
                              {cardErrors.cvv}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Número de cuotas */}
                      <div>
                        <label
                          htmlFor="installments"
                          className="block text-xs font-medium text-gray-700 mb-1"
                        >
                          Número de cuotas
                        </label>
                        <select
                          id="installments"
                          value={cardData.installments}
                          onChange={(e) =>
                            setCardData((prev) => ({
                              ...prev,
                              installments: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm"
                        >
                          {installmentOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Mensaje de seguridad */}
                      <p className="text-center text-gray-400 text-xs">
                        Tu tarjeta está protegida con encriptación SSL
                      </p>
                    </div>
                  )}
                </div>

                {/* PSE */}
                <div>
                  <label
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                      paymentMethod === "pse"
                        ? "border-gray-900 bg-gray-50"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <input
                      type="radio"
                      name="payment-method"
                      checked={paymentMethod === "pse"}
                      onChange={() => setPaymentMethod("pse")}
                      className="accent-black w-4 h-4"
                    />
                    <Building2 className="w-5 h-5 text-gray-700" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">
                        PSE - Débito bancario
                      </p>
                      <p className="text-xs text-gray-500">
                        Pago directo desde tu cuenta bancaria
                      </p>
                    </div>
                    <Image
                      src={pseLogo}
                      alt="PSE"
                      width={32}
                      height={32}
                      className="object-contain"
                    />
                  </label>

                  {/* Selector de banco */}
                  {paymentMethod === "pse" && (
                    <div className="mt-2 ml-7">
                      <label
                        htmlFor="bank-select"
                        className="block text-xs font-medium text-gray-700 mb-1"
                      >
                        Selecciona tu banco
                      </label>
                      <div className="relative">
                        <select
                          id="bank-select"
                          value={selectedBank}
                          onChange={(e) => setSelectedBank(e.target.value)}
                          disabled={isLoadingBanks}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black bg-white appearance-none cursor-pointer text-sm"
                        >
                          <option value="">
                            {isLoadingBanks
                              ? "Cargando bancos..."
                              : "Elige tu banco..."}
                          </option>
                          {banks.map((bank) => (
                            <option key={bank.bankCode} value={bank.bankCode}>
                              {bank.bankName}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Botones */}
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => handleProcessPayment(getDocumentoConValor()!)}
                  disabled={!isPaymentEnabled() || isProcessingPayment}
                  className="w-full h-11 bg-gray-900 text-white rounded-lg font-semibold text-sm cursor-pointer hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessingPayment ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                        ></path>
                      </svg>
                      Procesando...
                    </span>
                  ) : (
                    `Pagar $${formatCurrency(
                      getDocumentoConValor()?.valor || "0"
                    )}`
                  )}
                </Button>

                <Button
                  onClick={handleBackToResumen}
                  variant="outline"
                  className="w-full text-sm md:text-base"
                >
                  Volver
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
