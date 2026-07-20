"use client";

/**
 * CheckoutLoginModal
 *
 * Se abre en el checkout cuando el correo que ingresó el invitado pertenece a
 * una cuenta REGISTRADA (rol 2). Ofrece dos formas de iniciar sesión:
 *  - Clave: POST /api/auth/login
 *  - Código (OTP): POST /api/auth/otp/send-login → /api/auth/otp/verify-login,
 *    por email o por teléfono.
 *
 * Al iniciar sesión con éxito devuelve { access_token, user } vía onSuccess;
 * el padre (Step2) persiste la sesión y avanza el checkout.
 */

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ClipboardEvent as ReactClipboardEvent } from "react";
import { X, Loader2, Eye, EyeOff } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { apiPost } from "@/lib/api-client";

/** Logo oficial de Gmail (multicolor de Google) para el canal de correo. */
function GmailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#4caf50" d="M45,16.2l-5,2.75l-5,4.75L35,40h7c1.657,0,3-1.343,3-3V16.2z" />
      <path fill="#1e88e5" d="M3,16.2l3.614,1.71L13,23.7V40H6c-1.657,0-3-1.343-3-3V16.2z" />
      <polygon fill="#e53935" points="35,11.2 24,19.45 13,11.2 12,17 13,23.7 24,31.95 35,23.7 36,17" />
      <path fill="#c62828" d="M3,12.298V16.2l10,7.5V11.2L9.876,8.859C9.132,8.301,8.228,8,7.298,8h0C4.924,8,3,9.924,3,12.298z" />
      <path fill="#fbc02d" d="M45,12.298V16.2l-10,7.5V11.2l3.124-2.341C38.868,8.301,39.772,8,40.702,8h0C43.076,8,45,9.924,45,12.298z" />
    </svg>
  );
}

// Guard de intentos del código: máximo 5, luego bloqueo de 20 min. Se persiste
// por email en localStorage para que sobreviva a recargas de la página.
const MAX_OTP_ATTEMPTS = 5;
const OTP_LOCK_MS = 20 * 60 * 1000;
const otpLockKey = (email: string) => `checkout_otp_lock_${email.toLowerCase()}`;

function readOtpLock(email: string): { count: number; lockedUntil: number | null } {
  try {
    const raw = localStorage.getItem(otpLockKey(email));
    if (!raw) return { count: 0, lockedUntil: null };
    const parsed = JSON.parse(raw) as { count?: number; lockedUntil?: number | null };
    return { count: parsed.count ?? 0, lockedUntil: parsed.lockedUntil ?? null };
  } catch {
    return { count: 0, lockedUntil: null };
  }
}

function writeOtpLock(
  email: string,
  data: { count: number; lockedUntil: number | null },
) {
  try {
    localStorage.setItem(otpLockKey(email), JSON.stringify(data));
  } catch {
    /* localStorage no disponible: el guard queda solo en memoria */
  }
}

function clearOtpLock(email: string) {
  try {
    localStorage.removeItem(otpLockKey(email));
  } catch {
    /* noop */
  }
}

/**
 * Entrada de código OTP en 6 casillas. Se llena de izquierda a derecha, avanza y
 * retrocede el foco solo, acepta pegar el código completo y llama a onComplete
 * cuando se completan los 6 dígitos (para auto-verificar sin pulsar el botón).
 */
function OtpInput({
  value,
  onChange,
  onComplete,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete: (v: string) => void;
  disabled?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const prevLen = useRef(value.length);

  useEffect(() => {
    // Enfocar la primera casilla vacía al montar.
    refs.current[Math.min(value.length, 5)]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Si las casillas se vacían (p.ej. tras un intento fallido) devolver el
    // foco a la primera para reintentar sin tener que hacer clic.
    if (value.length === 0 && prevLen.current > 0) refs.current[0]?.focus();
    prevLen.current = value.length;
  }, [value.length]);

  const focusAt = (i: number) =>
    refs.current[Math.max(0, Math.min(i, 5))]?.focus();

  const commit = (raw: string) => {
    const clean = raw.replace(/\D/g, "").slice(0, 6);
    onChange(clean);
    if (clean.length === 6) onComplete(clean);
  };

  const handleChange = (index: number, raw: string) => {
    const only = raw.replace(/\D/g, "");
    if (!only) return;
    commit(value.slice(0, index) + only + value.slice(index + 1));
    focusAt(Math.min(index + only.length, 5));
  };

  const handleKeyDown = (
    index: number,
    e: ReactKeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (value[index]) {
        onChange((value.slice(0, index) + value.slice(index + 1)).replace(/\D/g, ""));
        focusAt(index);
      } else if (index > 0) {
        onChange((value.slice(0, index - 1) + value.slice(index)).replace(/\D/g, ""));
        focusAt(index - 1);
      }
    } else if (e.key === "ArrowLeft") {
      focusAt(index - 1);
    } else if (e.key === "ArrowRight") {
      focusAt(index + 1);
    }
  };

  const handlePaste = (
    index: number,
    e: ReactClipboardEvent<HTMLInputElement>,
  ) => {
    e.preventDefault();
    const pasted = (e.clipboardData.getData("text") || "").replace(/\D/g, "");
    if (!pasted) return;
    commit(value.slice(0, index) + pasted);
    focusAt(Math.min(index + pasted.length, 5));
  };

  return (
    <div className="flex justify-between gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          value={value[i] ?? ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => handlePaste(i, e)}
          onFocus={(e) => e.target.select()}
          className="h-12 w-full rounded-lg border border-gray-300 text-center text-xl font-semibold text-gray-900 focus:border-gray-900 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
        />
      ))}
    </div>
  );
}

interface LoginResult {
  access_token: string;
  user: {
    id: string;
    email: string;
    nombre: string;
    apellido: string;
    numero_documento: string;
    telefono: string;
    rol?: number;
  };
}

interface CheckoutLoginModalProps {
  email: string;
  /** Teléfono enmascarado de la cuenta (p.ej. "•••••• 8092") para el canal WhatsApp. */
  phoneHint?: string | null;
  onClose: () => void;
  onSuccess: (result: LoginResult) => void;
}

type Mode = "password" | "otp";
type OtpChannel = "email" | "telefono";

export default function CheckoutLoginModal({
  email,
  phoneHint,
  onClose,
  onSuccess,
}: CheckoutLoginModalProps) {
  const [mode, setMode] = useState<Mode>("password");
  const [password, setPassword] = useState("");
  const [otpChannel, setOtpChannel] = useState<OtpChannel>("email");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [nowTs, setNowTs] = useState<number>(() => Date.now());
  // Teléfono enmascarado a mostrar en el canal WhatsApp. Si el padre no lo pasó
  // (según por qué camino se abrió el modal), lo resolvemos aquí con el email.
  const [hint, setHint] = useState<string | null>(phoneHint ?? null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);

  // Cerrar con Escape + enfocar el modal al abrir (accesibilidad).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Resolver el teléfono enmascarado si no vino por props (p.ej. el modal se
  // abrió por el catch de "ya registrado", que no trae telefonoMask).
  useEffect(() => {
    if (phoneHint) {
      setHint(phoneHint);
      return;
    }
    let cancelled = false;
    apiPost<{ telefonoMask?: string | null }>("/api/auth/check-email", { email })
      .then((r) => {
        if (!cancelled) setHint(r?.telefonoMask ?? null);
      })
      .catch(() => {
        /* sin hint: se mostrará el texto genérico */
      });
    return () => {
      cancelled = true;
    };
  }, [email, phoneHint]);

  // Cargar el estado de bloqueo por intentos (persistido por email).
  useEffect(() => {
    const lock = readOtpLock(email);
    setOtpAttempts(lock.count);
    if (lock.lockedUntil && lock.lockedUntil > Date.now()) {
      setLockedUntil(lock.lockedUntil);
    } else if (lock.lockedUntil) {
      clearOtpLock(email);
    }
  }, [email]);

  // Cuenta regresiva del bloqueo: tick cada segundo y auto-liberar al vencer.
  useEffect(() => {
    if (!lockedUntil) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNowTs(t);
      if (t >= lockedUntil) {
        setLockedUntil(null);
        setOtpAttempts(0);
        clearOtpLock(email);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [lockedUntil, email]);

  const remainingMs = lockedUntil ? Math.max(0, lockedUntil - nowTs) : 0;
  const isLocked = remainingMs > 0;
  const remainingLabel = `${Math.floor(remainingMs / 60000)}:${String(
    Math.floor((remainingMs % 60000) / 1000),
  ).padStart(2, "0")}`;

  // Medir el contenido para animar la altura del modal entre estados: cada modo
  // usa su altura natural (nada de espacio vacío) pero la transición es suave.
  useEffect(() => {
    const el = contentRef.current;
    if (el) setContentHeight(el.scrollHeight);
  }, [mode, otpSent, isLocked, error, hint, otpChannel]);

  const handlePasswordLogin = async () => {
    if (loading) return; // evitar doble envío (Enter repetido)
    if (!password) {
      setError("Ingresa tu contraseña.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await apiPost<LoginResult>("/api/auth/login", {
        email,
        contrasena: password,
      });
      if (!result?.access_token || !result?.user) {
        throw new Error("Respuesta de inicio de sesión inválida.");
      }
      onSuccess(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (loading) return; // evitar spam de OTP (Enter repetido)
    if (isLocked) return; // bloqueado por demasiados intentos
    setLoading(true);
    setError("");
    setOtpCode(""); // limpiar cualquier código previo al (re)enviar
    try {
      // La identidad SIEMPRE es el email (único por cuenta). El canal solo
      // decide el medio de entrega: 'email' o 'whatsapp' (al teléfono
      // registrado de la cuenta, que el backend resuelve por el email). Así el
      // teléfono no hace de identidad aunque se repita en otra cuenta.
      await apiPost("/api/auth/otp/send-login", {
        metodo: otpChannel === "email" ? "email" : "whatsapp",
        email,
      });
      setOtpSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar el código.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (codeArg?: string) => {
    if (loading) return; // evitar doble verificación (Enter/auto-verify repetido)
    if (isLocked) return; // bloqueado por demasiados intentos
    const code = codeArg ?? otpCode;
    if (code.length !== 6) {
      setError("El código debe tener 6 dígitos.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      // Verificación SIEMPRE por email: el código quedó atado a la cuenta del
      // email, sin importar por qué canal se entregó.
      const result = await apiPost<LoginResult>("/api/auth/otp/verify-login", {
        codigo: code,
        email,
      });
      if (!result?.access_token || !result?.user) {
        throw new Error("Código inválido o expirado.");
      }
      clearOtpLock(email); // éxito: reiniciar el contador de intentos
      onSuccess(result);
    } catch (e) {
      // Intento fallido: contar y, al llegar al máximo, bloquear 20 min.
      const count = otpAttempts + 1;
      if (count >= MAX_OTP_ATTEMPTS) {
        const until = Date.now() + OTP_LOCK_MS;
        writeOtpLock(email, { count, lockedUntil: until });
        setOtpAttempts(count);
        setLockedUntil(until);
        setError("Demasiados intentos. Por seguridad, intenta de nuevo en 20 minutos.");
      } else {
        writeOtpLock(email, { count, lockedUntil: null });
        setOtpAttempts(count);
        const base = e instanceof Error ? e.message : "Código incorrecto.";
        const left = MAX_OTP_ATTEMPTS - count;
        setError(`${base} Te ${left === 1 ? "queda" : "quedan"} ${left} intento${left === 1 ? "" : "s"}.`);
      }
      setOtpCode(""); // limpiar las casillas para reintentar
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-login-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl outline-none"
      >
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Logo Samsung (mismo asset que el navbar) */}
        <div className="-mt-1 mb-4 flex justify-center">
          <img
            src="https://res.cloudinary.com/dnglv0zqg/image/upload/v1760575601/Samsung_black_ec1b9h.svg"
            alt="Samsung"
            className="h-10 w-auto"
          />
        </div>

        <h2 id="checkout-login-title" className="mb-1 text-xl font-semibold text-gray-900">Inicia sesión</h2>
        <p className="mb-4 text-sm text-gray-500">
          El correo <span className="font-medium text-gray-700">{email}</span> ya
          tiene una cuenta. Inicia sesión para continuar con tu compra.
        </p>

        {/* Tabs clave / código */}
        <div className="mb-4 flex rounded-lg bg-gray-100 p-1 text-sm font-medium">
          <button
            onClick={() => { setMode("password"); setError(""); }}
            className={`flex-1 rounded-md py-2 transition ${mode === "password" ? "bg-white shadow text-gray-900" : "text-gray-500"}`}
          >
            Con contraseña
          </button>
          <button
            onClick={() => { setMode("otp"); setError(""); }}
            className={`flex-1 rounded-md py-2 transition ${mode === "otp" ? "bg-white shadow text-gray-900" : "text-gray-500"}`}
          >
            Con código
          </button>
        </div>

        {/* Alto animado: cada estado usa su altura natural, con transición suave
            para que no salte al cambiar de pestaña/estado. */}
        <div
          style={{ height: contentHeight }}
          className="overflow-hidden transition-[height] duration-200 ease-out"
        >
          <div ref={contentRef}>
        {mode === "password" ? (
          <div className="space-y-3">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePasswordLogin()}
                placeholder="Tu contraseña"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-10 text-sm focus:border-gray-900 focus:outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <button
              onClick={handlePasswordLogin}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-black py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Iniciar sesión
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Canal del código */}
            <div className="flex gap-2 text-sm">
              <button
                onClick={() => { setOtpChannel("email"); setOtpSent(false); setError(""); }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-2 ${otpChannel === "email" ? "border-black bg-gray-100 text-gray-900" : "border-gray-300 text-gray-600"}`}
              >
                <GmailIcon className="h-4 w-5" />
                Al correo
              </button>
              <button
                onClick={() => { setOtpChannel("telefono"); setOtpSent(false); setError(""); }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-2 ${otpChannel === "telefono" ? "border-black bg-gray-100 text-gray-900" : "border-gray-300 text-gray-600"}`}
              >
                <FaWhatsapp className="h-4 w-4 text-[#25D366]" />
                Al teléfono
              </button>
            </div>

            {isLocked ? (
              <div className="rounded-lg bg-red-50 px-3 py-3 text-center text-sm text-red-600">
                Demasiados intentos.
                <br />
                Podrás intentar de nuevo en{" "}
                <span className="font-semibold tabular-nums">{remainingLabel}</span> min.
              </div>
            ) : !otpSent ? (
              <>
                <p className="text-xs text-gray-500">
                  {otpChannel === "email" ? (
                    <>Te enviaremos un código a <span className="font-medium text-gray-700">{email}</span>.</>
                  ) : hint ? (
                    <>Te enviaremos un código por WhatsApp al <span className="font-medium text-gray-700">{hint}</span>.</>
                  ) : (
                    "Te enviaremos un código por WhatsApp al teléfono registrado en tu cuenta."
                  )}
                </p>
                <button
                  onClick={handleSendOtp}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-black py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Enviar código
                </button>
              </>
            ) : (
              <>
                <p className="text-xs text-gray-500">
                  Ingresa el código de 6 dígitos que enviamos{" "}
                  {otpChannel === "email" ? (
                    <>a <span className="font-medium text-gray-700">{email}</span></>
                  ) : hint ? (
                    <>por WhatsApp al <span className="font-medium text-gray-700">{hint}</span></>
                  ) : (
                    "por WhatsApp a tu teléfono"
                  )}
                  .
                </p>
                <OtpInput
                  value={otpCode}
                  onChange={setOtpCode}
                  onComplete={(v) => handleVerifyOtp(v)}
                  disabled={loading}
                />
                <button
                  onClick={() => handleVerifyOtp()}
                  disabled={loading || otpCode.length !== 6}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-black py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Verificar y continuar
                </button>
                <button
                  onClick={handleSendOtp}
                  disabled={loading}
                  className="w-full text-xs text-gray-500 hover:text-gray-700"
                >
                  Reenviar código
                </button>
              </>
            )}
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
