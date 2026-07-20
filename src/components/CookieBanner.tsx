"use client";

import React, { useState, useEffect } from "react";
import { saveLocationPermission } from "@/lib/consent/location";

/**
 * CookieBanner - Sistema de Consentimiento de Cookies y Ubicación ULTRA-PROTEGIDO
 *
 * ESTRATEGIA DE TRACKING DUAL:
 *
 * 1. CLIENT-SIDE (requiere consentimiento):
 *    - Google Tag Manager (GTM)
 *    - Meta Pixel (Facebook)
 *    - TikTok Pixel
 *    - Microsoft Clarity
 *    - Sentry
 *
 * 2. SERVER-SIDE (siempre activo):
 *    - Meta CAPI (Conversions API)
 *    - TikTok Events API
 *    - Modo FULL si hay consentimiento (con PII hasheado)
 *    - Modo ANONYMOUS si NO hay consentimiento (sin PII, IP anonimizada)
 *
 * Base legal Colombia (Ley 1581/2012):
 * - Datos anonimizados NO requieren consentimiento
 * - Tracking client-side SÍ requiere consentimiento
 *
 * PROTECCIÓN ANTI-REAPARICIÓN:
 * - Triple verificación: localStorage + sessionStorage + cookie
 * - Detección de manipulación de storage
 * - Timestamp de aceptación para auditoría
 * - Sistema de "accepted" vs "rejected" explícito
 */

const STORAGE_KEY = "imagiq_consent";
const CONSENT_VERSION = "2.0";
const SESSION_KEY = "imagiq_consent_session";
const COOKIE_NAME = "imagiq_consent_backup";

// Estados posibles del consentimiento
type ConsentDecision = "accepted" | "rejected" | "pending";

interface ConsentState {
  analytics: boolean; // Clarity, Sentry
  marketing: boolean; // GTM, Meta Pixel, TikTok Pixel
  decision: ConsentDecision; // Estado explícito de la decisión
  timestamp: number;
  version: string;
}

/**
 * Lee el consentimiento de TODAS las fuentes con protección
 */
function getConsentFromAllSources(): ConsentState | null {
  if (typeof window === "undefined") return null;

  try {
    // 1. Intentar leer de localStorage (fuente principal)
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as ConsentState;
      // Validar estructura completa
      if (
        typeof parsed.analytics === "boolean" &&
        typeof parsed.marketing === "boolean" &&
        typeof parsed.decision === "string" &&
        typeof parsed.timestamp === "number" &&
        parsed.decision !== "pending"
      ) {
        return parsed;
      }
    }

    // 2. Intentar leer de sessionStorage (backup de sesión)
    const sessionStored = sessionStorage.getItem(SESSION_KEY);
    if (sessionStored) {
      const parsed = JSON.parse(sessionStored) as ConsentState;
      if (parsed.decision !== "pending") {
        // Restaurar a localStorage si se perdió
        localStorage.setItem(STORAGE_KEY, sessionStored);
        return parsed;
      }
    }

    // 3. Intentar leer de cookie (último recurso)
    const cookieValue = getCookie(COOKIE_NAME);
    if (cookieValue) {
      const parsed = JSON.parse(decodeURIComponent(cookieValue)) as ConsentState;
      if (parsed.decision !== "pending") {
        // Restaurar a localStorage y sessionStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(parsed));
        return parsed;
      }
    }

    return null;
  } catch (error) {
    console.error("🍪 [CookieBanner] Error reading consent:", error);
    return null;
  }
}

/**
 * Guarda el consentimiento en TODAS las fuentes (triple protección)
 */
function saveConsentToAllSources(
  analytics: boolean,
  marketing: boolean,
  decision: ConsentDecision
): void {
  const consent: ConsentState = {
    analytics,
    marketing,
    decision,
    timestamp: Date.now(),
    version: CONSENT_VERSION,
  };

  const serialized = JSON.stringify(consent);

  // 1. Guardar en localStorage (principal)
  localStorage.setItem(STORAGE_KEY, serialized);

  // 2. Guardar en sessionStorage (backup de sesión)
  sessionStorage.setItem(SESSION_KEY, serialized);

  // 3. Guardar en cookie (backup permanente, expira en 365 días)
  setCookie(COOKIE_NAME, encodeURIComponent(serialized), 365);

  // Disparar evento para que los scripts reaccionen
  window.dispatchEvent(new CustomEvent("consentChange", { detail: consent }));
}

/**
 * Helpers para cookies
 */
function setCookie(name: string, value: string, days: number): void {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

function getCookie(name: string): string | null {
  const nameEQ = name + "=";
  const ca = document.cookie.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === " ") c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

export default function CookieBanner() {
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Vista del modal: principal o preferencias (estilo "Configurar" de Samsung)
  const [view, setView] = useState<"main" | "config">("main");
  const [prefAnalytics, setPrefAnalytics] = useState(true);
  const [prefMarketing, setPrefMarketing] = useState(true);

  // Montar componente
  useEffect(() => {
    setMounted(true);
  }, []);

  // Verificar si debe mostrarse CON PROTECCIÓN ANTI-REAPARICIÓN
  useEffect(() => {
    if (!mounted) return;
    if (typeof window === "undefined") return;

    const consent = getConsentFromAllSources();

    if (!consent) {
      setShow(true);
      return;
    }

    // Hidratar los toggles con la elección REAL guardada. Sin esto arrancaban
    // siempre en ON: un usuario que rechazó, al reabrir "Configurar" y dar
    // "Guardar preferencias", otorgaba analytics+marketing sin querer.
    setPrefAnalytics(!!consent.analytics);
    setPrefMarketing(!!consent.marketing);

    // Verificar que la decisión sea explícita (no pending)
    if (consent.decision === "accepted") {
      setShow(false);
    } else if (consent.decision === "rejected") {
      // Si rechazó, mostrar nuevamente para darle oportunidad de cambiar de opinión
      setShow(true);
    } else {
      // Decisión inválida o pending, mostrar banner
      setShow(true);
    }
  }, [mounted]);

  const handleAccept = async () => {
    // 1. Guardar consentimiento de cookies en TODAS las fuentes
    saveConsentToAllSources(true, true, "accepted");

    // 2. Guardar consentimiento de ubicación
    saveLocationPermission(true);

    // 3. Solicitar ubicación del navegador
    if (typeof window !== "undefined" && navigator.geolocation) {
      try {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const locationData = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: Date.now(),
            };
            localStorage.setItem("imagiq_user_location", JSON.stringify(locationData));
          },
          (_error) => {
            // User denied location or error occurred - consent already saved
          }
        );
      } catch {
        // Geolocation not available
      }
    }

    // 4. Ocultar banner
    setShow(false);
  };

  const handleReject = () => {
    // Guardar rechazo explícito (NO guardar en ubicación para volver a preguntar)
    saveConsentToAllSources(false, false, "rejected");

    // Ocultar banner temporalmente (volverá a aparecer en próxima visita)
    setShow(false);
  };

  const handleSavePreferences = () => {
    // Preferencias granulares (el sistema de consentimiento ya distingue
    // analytics vs marketing). Si apagó ambas, equivale a rechazo explícito.
    const anyAccepted = prefAnalytics || prefMarketing;
    saveConsentToAllSources(
      prefAnalytics,
      prefMarketing,
      anyAccepted ? "accepted" : "rejected"
    );
    setShow(false);
  };

  // No renderizar hasta que esté montado y deba mostrarse
  if (!mounted || !show) {
    return null;
  }

  // Modal centrado estilo Samsung oficial: wordmark + "Continuar sin aceptar"
  // arriba, texto con links de políticas, botones pill Configurar/Aceptar Todo.
  // Sin backdrop oscuro (como samsung.com): la página sigue visible detrás.
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[99999] flex justify-center px-4 pt-6 sm:pt-8"
      style={{ zIndex: 999999 }}
    >
      <div
        role="dialog"
        aria-modal="false"
        aria-label="Preferencias de cookies"
        className="pointer-events-auto w-full max-w-[460px] rounded-xl bg-white p-6 shadow-[0_8px_40px_rgba(0,0,0,0.25)]"
      >
        {/* Encabezado: wordmark + continuar sin aceptar */}
        <div className="mb-4 flex items-start justify-between gap-4">
          {/* Wordmark oficial de Samsung (mismo asset que usa el navbar) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://res.cloudinary.com/dnglv0zqg/image/upload/v1760575601/Samsung_black_ec1b9h.svg"
            alt="Samsung"
            className="-mt-1.5 h-7 w-auto"
            style={{ height: "28px", width: "auto" }}
          />
          <button
            onClick={handleReject}
            className="text-sm font-semibold text-gray-900 underline underline-offset-2 hover:text-gray-600 whitespace-nowrap"
          >
            Continuar sin aceptar
          </button>
        </div>

        {view === "main" ? (
          <>
            <p className="mb-5 text-[13px] leading-relaxed text-gray-800">
              Nuestra web usa cookies, incluidas las cookies opcionales, para
              ofrecerle la mejor experiencia en nuestro sitio y para mostrarle
              anuncios relevantes según su uso de nuestro sitio web. Usted puede
              manejar sus preferencias o aceptar todas las cookies. Para obtener
              más información, consulte nuestra{" "}
              <a
                href="/soporte/politica-cookies"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline underline-offset-2"
              >
                Política de privacidad
              </a>{" "}
              y{" "}
              <a
                href="/soporte/politica-cookies"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline underline-offset-2"
              >
                Política de cookies
              </a>
              .
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setView("config")}
                className="flex-1 rounded-full border-2 border-[#000000] px-5 py-2.5 text-sm font-bold text-[#000000] transition-colors hover:bg-[#000000]/5"
              >
                Configurar
              </button>
              <button
                onClick={handleAccept}
                className="flex-1 rounded-full bg-[#000000] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#222222]"
              >
                Aceptar Todo
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-4 space-y-3">
              {/* Esenciales: siempre activas */}
              <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Esenciales</p>
                  <p className="text-xs text-gray-500">Necesarias para que el sitio funcione</p>
                </div>
                <span className="text-xs font-semibold text-gray-400">Siempre activas</span>
              </div>

              {/* Análisis */}
              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Análisis</p>
                  <p className="text-xs text-gray-500">Nos ayudan a mejorar el sitio</p>
                </div>
                <input
                  type="checkbox"
                  checked={prefAnalytics}
                  onChange={(e) => setPrefAnalytics(e.target.checked)}
                  className="h-5 w-5 accent-[#000000]"
                />
              </label>

              {/* Marketing */}
              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Marketing</p>
                  <p className="text-xs text-gray-500">Anuncios relevantes (Google, Meta, TikTok)</p>
                </div>
                <input
                  type="checkbox"
                  checked={prefMarketing}
                  onChange={(e) => setPrefMarketing(e.target.checked)}
                  className="h-5 w-5 accent-[#000000]"
                />
              </label>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setView("main")}
                className="flex-1 rounded-full border-2 border-gray-300 px-5 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50"
              >
                Volver
              </button>
              <button
                onClick={handleSavePreferences}
                className="flex-1 rounded-full bg-[#000000] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#222222]"
              >
                Guardar preferencias
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
