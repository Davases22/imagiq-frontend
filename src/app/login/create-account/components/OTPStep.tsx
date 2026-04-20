import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Edit3 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { apiPost } from "@/lib/api-client";
import { identifyEmailEarly } from "@/lib/posthogClient";

// Componente de input OTP con cajas individuales
function OTPInputBoxes({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, "").split("").slice(0, 6);

  const handleChange = (index: number, digit: string) => {
    // Solo permitir dígitos
    const cleanDigit = digit.replace(/\D/g, "").slice(-1);

    const newDigits = [...digits];
    newDigits[index] = cleanDigit;
    const newCode = newDigits.join("").slice(0, 6);
    onChange(newCode);

    // Auto-focus al siguiente input si se ingresó un dígito
    if (cleanDigit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Backspace: borrar y mover al anterior
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
        const newDigits = [...digits];
        newDigits[index - 1] = "";
        onChange(newDigits.join(""));
      }
    }
    // Arrow keys para navegar
    if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(pastedData);
    // Focus en el último dígito pegado o en el siguiente vacío
    const focusIndex = Math.min(pastedData.length, 5);
    inputRefs.current[focusIndex]?.focus();
  };

  return (
    <div className="flex gap-1.5 sm:gap-2 justify-center">
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <input
          key={index}
          ref={(el) => { inputRefs.current[index] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[index] || ""}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          disabled={disabled}
          className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-bold border-2 border-gray-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          autoComplete="one-time-code"
        />
      ))}
    </div>
  );
}

interface OTPStepProps {
  email: string;
  telefono: string;
  otpCode: string;
  otpSent: boolean;
  sendMethod: 'email' | 'whatsapp';
  onOTPChange: (code: string) => void;
  onSendOTP: (method?: 'email' | 'whatsapp') => void;
  error?: string; // Error de verificación
  onMethodChange: (method: 'email' | 'whatsapp') => void;
  onChangeEmail: (newEmail: string) => void;
  onChangePhone: (newPhone: string) => void;
  disabled?: boolean;
  showSendButton?: boolean; // Para mostrar botón de enviar en Step2
  onVerifyOTP?: () => void; // Para verificar el código
  loading?: boolean; // Estado de carga
}

export function OTPStep({
  email,
  telefono,
  otpCode,
  otpSent,
  sendMethod,
  onOTPChange,
  onSendOTP,
  onMethodChange,
  onChangeEmail,
  onChangePhone,
  disabled,
  showSendButton = false,
  onVerifyOTP,
  loading = false,
  error,
}: OTPStepProps) {
  const [editMode, setEditMode] = useState<'email' | 'phone' | null>(null);
  const [tempEmail, setTempEmail] = useState(email);
  const [tempPhone, setTempPhone] = useState(telefono);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string>("");

  // Sincronizar valores temporales cuando cambien las props
  useEffect(() => {
    setTempEmail(email);
  }, [email]);

  useEffect(() => {
    setTempPhone(telefono);
  }, [telefono]);

  // Limpiar error cuando cambie el modo de edición
  useEffect(() => {
    setValidationError("");
  }, [editMode]);

  // Refs para controlar la auto-verificación
  const isVerifyingRef = useRef(false);
  const verifyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastVerifiedCodeRef = useRef<string>("");

  // Auto-verificar cuando el código tenga 6 dígitos (con protección contra llamadas múltiples)
  useEffect(() => {
    // Limpiar timeout anterior
    if (verifyTimeoutRef.current) {
      clearTimeout(verifyTimeoutRef.current);
      verifyTimeoutRef.current = null;
    }

    // No verificar si:
    // - El código no tiene 6 dígitos
    // - Ya estamos verificando
    // - Está deshabilitado
    // - Está cargando
    // - No hay función de verificación
    // - Hay un error activo (el usuario necesita corregir)
    // - Es el mismo código que ya intentamos verificar
    if (
      otpCode.length !== 6 ||
      isVerifyingRef.current ||
      disabled ||
      loading ||
      !onVerifyOTP ||
      error ||
      otpCode === lastVerifiedCodeRef.current
    ) {
      return;
    }

    // Debounce de 300ms para evitar llamadas mientras el usuario escribe
    verifyTimeoutRef.current = setTimeout(() => {
      if (!isVerifyingRef.current && otpCode.length === 6 && !error) {
        isVerifyingRef.current = true;
        lastVerifiedCodeRef.current = otpCode;
        onVerifyOTP();
        // Reset después de un tiempo para permitir re-intentos
        setTimeout(() => {
          isVerifyingRef.current = false;
        }, 1000);
      }
    }, 300);

    return () => {
      if (verifyTimeoutRef.current) {
        clearTimeout(verifyTimeoutRef.current);
      }
    };
  }, [otpCode, onVerifyOTP, loading, disabled, error]);

  // Resetear el código verificado cuando el error se limpia (permitir re-intento)
  useEffect(() => {
    // Si el error se limpió, resetear el ref para permitir verificar el mismo código de nuevo
    if (!error) {
      lastVerifiedCodeRef.current = "";
    }
  }, [error, otpCode]);

  const handleSaveEdit = async () => {
    setIsValidating(true);
    setValidationError("");

    try {
      if (editMode === 'email') {
        // Validar que el email sea diferente al actual
        if (tempEmail.toLowerCase() === email.toLowerCase()) {
          setValidationError("El email es el mismo que el actual");
          setIsValidating(false);
          return;
        }

        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(tempEmail)) {
          setValidationError("Formato de email inválido");
          setIsValidating(false);
          return;
        }

        // Verificar si el email ya está registrado
        try {
          const response = await apiPost<{ exists: boolean; message?: string }>("/api/auth/check-email", {
            email: tempEmail.toLowerCase(),
          });

          if (response.exists) {
            setValidationError("Este correo electrónico ya está registrado. Por favor, usa otro o inicia sesión.");
            setIsValidating(false);
            return;
          }
        } catch (error) {
          console.log("⚠️ No se pudo validar el email, permitiendo cambio:", error);
        }

        // Si pasa las validaciones, guardar el cambio
        onChangeEmail(tempEmail);
        setEditMode(null);
        setValidationError("");
      } else if (editMode === 'phone') {
        // Validar que el teléfono sea diferente al actual
        if (tempPhone === telefono) {
          setValidationError("El teléfono es el mismo que el actual");
          setIsValidating(false);
          return;
        }

        // Validar longitud del teléfono
        if (tempPhone.length !== 10) {
          setValidationError("El teléfono debe tener 10 dígitos");
          setIsValidating(false);
          return;
        }

        // Verificar si el teléfono ya está registrado
        try {
          const response = await apiPost<{ exists: boolean; message?: string }>("/api/auth/check-phone", {
            telefono: tempPhone,
            codigo_pais: "57", // Colombia por defecto
          });

          if (response.exists) {
            setValidationError("Este número de teléfono ya está registrado. Por favor, usa otro o inicia sesión.");
            setIsValidating(false);
            return;
          }
        } catch (error) {
          console.log("⚠️ No se pudo validar el teléfono, permitiendo cambio:", error);
        }

        // Si pasa las validaciones, guardar el cambio
        onChangePhone(tempPhone);
        setEditMode(null);
        setValidationError("");
      }
    } catch (error) {
      console.error("Error al validar cambio:", error);
      setValidationError("Error al validar. Intenta de nuevo.");
    } finally {
      setIsValidating(false);
    }
  };

  const handleCancelEdit = () => {
    setTempEmail(email);
    setTempPhone(telefono);
    setEditMode(null);
    setValidationError("");
  };

  return (
    <div className="space-y-4">
      {/* Layout de dos columnas: Datos de verificación (izq) + Selector de método (der) */}
      {/* Usar lg:grid-cols-2 en lugar de md para que en tablet (768px) se mantenga en una columna */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Columna izquierda: Datos de verificación */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <p className="text-xs text-gray-600 font-bold">Datos de verificación</p>

          {/* Email */}
          <div className="space-y-2">
            {editMode === 'email' ? (
              <div className="space-y-2">
                <Label htmlFor="edit-email" className="text-xs">Correo electrónico</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={tempEmail}
                  onChange={(e) => {
                    setTempEmail(e.target.value);
                    setValidationError(""); // Limpiar error al escribir
                  }}
                  onBlur={(e) => identifyEmailEarly(e.target.value)}
                  disabled={disabled || isValidating}
                  className="text-sm"
                />
                {validationError && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <span className="font-bold">✗</span>
                    {validationError}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleCancelEdit}
                    disabled={disabled || isValidating}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={disabled || !tempEmail || isValidating}
                    className="flex-1 bg-black text-white hover:bg-gray-800"
                  >
                    {isValidating ? "Validando..." : "Guardar"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-gray-600">Email:</span>{" "}
                  <span className="font-medium">{email}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditMode('email')}
                  disabled={disabled}
                  className="text-blue-600 hover:text-blue-700 text-xs flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Edit3 className="w-3 h-3" />
                  Cambiar
                </button>
              </div>
            )}
          </div>

          {/* Teléfono */}
          <div className="space-y-2">
            {editMode === 'phone' ? (
              <div className="space-y-2">
                <Label htmlFor="edit-phone" className="text-xs">Número de teléfono</Label>
                <Input
                  id="edit-phone"
                  type="tel"
                  placeholder="3001234567"
                  value={tempPhone}
                  onChange={(e) => {
                    setTempPhone(e.target.value.replace(/\D/g, ""));
                    setValidationError(""); // Limpiar error al escribir
                  }}
                  disabled={disabled || isValidating}
                  maxLength={10}
                  className="text-sm"
                />
                {validationError && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <span className="font-bold">✗</span>
                    {validationError}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleCancelEdit}
                    disabled={disabled || isValidating}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={disabled || !tempPhone || tempPhone.length !== 10 || isValidating}
                    className="flex-1 bg-black text-white hover:bg-gray-800"
                  >
                    {isValidating ? "Validando..." : "Guardar"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-gray-600">Teléfono:</span>{" "}
                  <span className="font-medium">+57 {telefono}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditMode('phone')}
                  disabled={disabled}
                  className="text-blue-600 hover:text-blue-700 text-xs flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Edit3 className="w-3 h-3" />
                  Cambiar
                </button>
              </div>
            )}
          </div>

          {editMode && (
            <p className="text-xs text-gray-800 bg-gray-100 p-2 rounded">
              Si cambias estos datos, deberás reenviar un nuevo código de verificación.
            </p>
          )}
        </div>

        {/* Columna derecha: Selector de método de envío O Verificación OTP */}
        {!otpSent ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex flex-col justify-center">
            <p className="text-xs text-gray-600 font-bold mb-3">Canal de envío</p>
            <p className="text-sm text-gray-600 mb-4">
              ¿Dónde deseas recibir tu código?
            </p>
            <div className="flex flex-row gap-3">
              <button
                type="button"
                onClick={() => onMethodChange('whatsapp')}
                disabled={disabled}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition ${sendMethod === 'whatsapp'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-300 bg-white hover:border-gray-400 opacity-70'
                  }`}
              >
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/500px-WhatsApp.svg.png"
                  alt="WhatsApp"
                  className="w-6 h-6"
                />
                <span className="font-medium text-gray-700">WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={() => onMethodChange('email')}
                disabled={disabled}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition ${sendMethod === 'email'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 bg-white hover:border-gray-400 opacity-70'
                  }`}
              >
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Gmail_icon_%282020%29.svg/512px-Gmail_icon_%282020%29.svg.png"
                  alt="Email"
                  className="w-6 h-auto object-contain"
                />
                <span className="font-medium text-gray-700">Email</span>
              </button>
            </div>

            {/* Botón de enviar código (solo en Step2) */}
            {showSendButton && (
              <div className="mt-4">
                <Button
                  type="button"
                  onClick={() => onSendOTP(sendMethod)}
                  disabled={disabled}
                  className="w-full bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 font-bold py-3 px-8 text-base rounded-lg"
                >
                  Enviar código
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex flex-col justify-center">
            <p className="text-xs text-gray-600 font-bold mb-3">Verificación</p>
            <p className="text-sm text-gray-600 mb-4 flex items-center justify-center gap-2">
              Enviamos un código de 6 dígitos vía
              {sendMethod === 'email' ? (
                <>
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Gmail_icon_%282020%29.svg/512px-Gmail_icon_%282020%29.svg.png"
                    alt="Email"
                    className="w-5 h-auto inline"
                  />
                  <span className="font-medium">Email</span>
                </>
              ) : (
                <>
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/500px-WhatsApp.svg.png"
                    alt="WhatsApp"
                    className="w-5 h-5 inline"
                  />
                  <span className="font-medium text-green-600">WhatsApp</span>
                </>
              )}
            </p>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Código de verificación</Label>
                <OTPInputBoxes
                  value={otpCode}
                  onChange={onOTPChange}
                  disabled={disabled || loading}
                />
                {loading && (
                  <p className="text-xs text-gray-500 text-center">Verificando...</p>
                )}
                {error && !loading && (
                  <p className="text-xs text-red-600 text-center bg-red-50 py-2 px-3 rounded-lg">
                    {error}
                  </p>
                )}
              </div>

              <Button
                type="button"
                onClick={() => onSendOTP(sendMethod)}
                disabled={disabled || loading}
                className="w-full bg-black text-white hover:bg-gray-800"
              >
                Reenviar código
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
