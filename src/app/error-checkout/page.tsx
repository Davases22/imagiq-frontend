"use client";

/**
 * Página de error de checkout — rediseño Stripe-inspired split screen.
 *
 * Layout:
 *   Mobile  → columna única: panel de icono arriba, contenido abajo
 *   Desktop → split screen: panel izquierdo 40% (marca + icono animado),
 *             panel derecho 60% (detalles del error, CTAs, métodos alternativos)
 *
 * Datos de entrada vía searchParams: ?message=...&code=...&type=...
 * Requiere: `getPaymentErrorInfo` de @/lib/payment-error-map
 */

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { getPaymentErrorInfo } from "@/lib/payment-error-map";
import { useCardsCache } from "@/app/carrito/hooks/useCardsCache";
import CardBrandLogo from "@/components/ui/CardBrandLogo";
import pseLogo from "@/img/iconos/logo-pse.png";
import addiLogo from "@/img/iconos/addi_negro.png";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CtaAction =
  | "retry"
  | "changeMethod"
  | "contactBank"
  | "viewOrders"
  | "goHome";

type ColorScheme = "amber" | "red" | "blue";

// ---------------------------------------------------------------------------
// Inline SVG icon components
// ---------------------------------------------------------------------------

interface IconProps {
  colorClass: string;
  size?: number;
}

function ShieldIcon({ colorClass, size = 80 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M40 10L14 22v18c0 14.4 11.2 27.8 26 31 14.8-3.2 26-16.6 26-31V22L40 10z"
        className={colorClass}
        fill="currentColor"
        opacity="0.15"
      />
      <path
        d="M40 14L17 25v15c0 12.8 9.9 24.7 23 27.7C53.1 64.7 63 52.8 63 40V25L40 14z"
        className={colorClass}
        fill="currentColor"
        opacity="0.3"
      />
      <path
        d="M32 40l5 5 11-11"
        className={colorClass}
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0"
      />
      <line
        x1="32"
        y1="32"
        x2="48"
        y2="48"
        className={colorClass}
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <line
        x1="48"
        y1="32"
        x2="32"
        y2="48"
        className={colorClass}
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function WalletIcon({ colorClass, size = 80 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="12"
        y="26"
        width="56"
        height="38"
        rx="6"
        className={colorClass}
        fill="currentColor"
        opacity="0.15"
      />
      <rect
        x="12"
        y="26"
        width="56"
        height="38"
        rx="6"
        className={colorClass}
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        d="M12 36h56"
        className={colorClass}
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        d="M20 20h36a6 6 0 0 1 6 6H14a6 6 0 0 1 6-6z"
        className={colorClass}
        fill="currentColor"
        opacity="0.3"
      />
      <circle
        cx="56"
        cy="48"
        r="6"
        className={colorClass}
        fill="currentColor"
        opacity="0.5"
      />
      <circle cx="56" cy="48" r="3" className={colorClass} fill="currentColor" />
    </svg>
  );
}

function CardIcon({ colorClass, size = 80 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="10"
        y="22"
        width="60"
        height="40"
        rx="6"
        className={colorClass}
        fill="currentColor"
        opacity="0.12"
      />
      <rect
        x="10"
        y="22"
        width="60"
        height="40"
        rx="6"
        className={colorClass}
        stroke="currentColor"
        strokeWidth="3"
      />
      <rect
        x="10"
        y="32"
        width="60"
        height="10"
        className={colorClass}
        fill="currentColor"
        opacity="0.3"
      />
      <rect
        x="18"
        y="50"
        width="16"
        height="5"
        rx="2"
        className={colorClass}
        fill="currentColor"
        opacity="0.5"
      />
      <line
        x1="52"
        y1="48"
        x2="62"
        y2="58"
        className={colorClass}
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1="62"
        y1="48"
        x2="52"
        y2="58"
        className={colorClass}
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LockIcon({ colorClass, size = 80 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="16"
        y="36"
        width="48"
        height="34"
        rx="6"
        className={colorClass}
        fill="currentColor"
        opacity="0.15"
      />
      <rect
        x="16"
        y="36"
        width="48"
        height="34"
        rx="6"
        className={colorClass}
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        d="M28 36V26a12 12 0 0 1 24 0v10"
        className={colorClass}
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle
        cx="40"
        cy="52"
        r="5"
        className={colorClass}
        fill="currentColor"
        opacity="0.6"
      />
      <line
        x1="40"
        y1="57"
        x2="40"
        y2="63"
        className={colorClass}
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClockIcon({ colorClass, size = 80 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        cx="40"
        cy="40"
        r="28"
        className={colorClass}
        fill="currentColor"
        opacity="0.12"
      />
      <circle
        cx="40"
        cy="40"
        r="28"
        className={colorClass}
        stroke="currentColor"
        strokeWidth="3"
      />
      <line
        x1="40"
        y1="20"
        x2="40"
        y2="40"
        className={colorClass}
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <line
        x1="40"
        y1="40"
        x2="54"
        y2="50"
        className={colorClass}
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <circle cx="40" cy="40" r="3" className={colorClass} fill="currentColor" />
    </svg>
  );
}

function AlertIcon({ colorClass, size = 80 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M40 12L8 66h64L40 12z"
        className={colorClass}
        fill="currentColor"
        opacity="0.12"
      />
      <path
        d="M40 14L9 66h62L40 14z"
        className={colorClass}
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <line
        x1="40"
        y1="34"
        x2="40"
        y2="52"
        className={colorClass}
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <circle cx="40" cy="59" r="3" className={colorClass} fill="currentColor" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Icon renderer
// ---------------------------------------------------------------------------

function ErrorIcon({
  icon,
  colorClass,
}: {
  icon: string;
  colorClass: string;
}) {
  const props = { colorClass, size: 80 };
  switch (icon) {
    case "shield":
      return <ShieldIcon {...props} />;
    case "wallet":
      return <WalletIcon {...props} />;
    case "card":
      return <CardIcon {...props} />;
    case "lock":
      return <LockIcon {...props} />;
    case "clock":
      return <ClockIcon {...props} />;
    default:
      return <AlertIcon {...props} />;
  }
}

// getPaymentErrorInfo is now imported from @/lib/payment-error-map

// ---------------------------------------------------------------------------
// Color scheme maps
// ---------------------------------------------------------------------------

const schemeMap: Record<
  ColorScheme,
  {
    leftBg: string;
    leftBgFrom: string;
    leftBgTo: string;
    iconWrapper: string;
    iconColor: string;
    badge: string;
    primaryBtn: string;
    infoBox: string;
    tipBox: string;
    altCardBorder: string;
    altCardHover: string;
  }
> = {
  amber: {
    leftBg: "from-amber-400 to-amber-600",
    leftBgFrom: "#f59e0b",
    leftBgTo: "#d97706",
    iconWrapper: "bg-amber-50 ring-4 ring-amber-200",
    iconColor: "text-amber-600",
    badge: "bg-amber-100 text-amber-800",
    primaryBtn:
      "bg-[#0057B7] hover:bg-[#004a9e] active:bg-[#003d84] text-white focus-visible:ring-[#0057B7]",
    infoBox: "bg-amber-50 border-amber-200 text-amber-900",
    tipBox: "bg-blue-50 border-blue-200 text-blue-900",
    altCardBorder: "border-amber-200 hover:border-amber-400",
    altCardHover: "hover:bg-amber-50",
  },
  red: {
    leftBg: "from-orange-400 to-orange-700",
    leftBgFrom: "#fb923c",
    leftBgTo: "#c2410c",
    iconWrapper: "bg-orange-50 ring-4 ring-orange-200",
    iconColor: "text-orange-600",
    badge: "bg-orange-100 text-orange-800",
    primaryBtn:
      "bg-[#0057B7] hover:bg-[#004a9e] active:bg-[#003d84] text-white focus-visible:ring-[#0057B7]",
    infoBox: "bg-orange-50 border-orange-200 text-orange-900",
    tipBox: "bg-blue-50 border-blue-200 text-blue-900",
    altCardBorder: "border-orange-200 hover:border-orange-400",
    altCardHover: "hover:bg-orange-50",
  },
  blue: {
    leftBg: "from-blue-500 to-blue-700",
    leftBgFrom: "#3b82f6",
    leftBgTo: "#1d4ed8",
    iconWrapper: "bg-blue-50 ring-4 ring-blue-200",
    iconColor: "text-blue-600",
    badge: "bg-blue-100 text-blue-800",
    primaryBtn:
      "bg-[#0057B7] hover:bg-[#004a9e] active:bg-[#003d84] text-white focus-visible:ring-[#0057B7]",
    infoBox: "bg-blue-50 border-blue-200 text-blue-900",
    tipBox: "bg-indigo-50 border-indigo-200 text-indigo-900",
    altCardBorder: "border-blue-200 hover:border-blue-400",
    altCardHover: "hover:bg-blue-50",
  },
};

// ---------------------------------------------------------------------------
// Inner page (needs useSearchParams — must be inside Suspense)
// ---------------------------------------------------------------------------

function ErrorCheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [mounted, setMounted] = useState(false);
  const { savedCards, isLoadingCards, loadSavedCards } = useCardsCache();

  const rawMessage = searchParams.get("message") ?? undefined;
  const rawCode = searchParams.get("code") ?? undefined;

  // Use the comprehensive error map from @/lib/payment-error-map
  const errorInfo = getPaymentErrorInfo(rawCode, rawMessage);
  const scheme = schemeMap[errorInfo.colorScheme as ColorScheme] ?? schemeMap.amber;

  useEffect(() => {
    setMounted(true);
    loadSavedCards();
  }, [loadSavedCards]);

  // Focus the title after mount for accessibility
  useEffect(() => {
    if (mounted && titleRef.current) {
      titleRef.current.focus();
    }
  }, [mounted]);

  function handleAction(action: CtaAction) {
    switch (action) {
      case "retry":
        router.push("/carrito");
        break;
      case "changeMethod":
        router.push("/carrito?step=payment");
        break;
      case "contactBank":
        // Open phone dialer — generic bank support
        window.open("tel:018000", "_self");
        break;
      case "viewOrders":
        router.push("/mis-pedidos");
        break;
      case "goHome":
        router.push("/");
        break;
    }
  }

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Global animation styles                                             */}
      {/* ------------------------------------------------------------------ */}
      <style>{`
        @keyframes ec-fade-up {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ec-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes ec-icon-bounce {
          0%   { transform: scale(0.8) translateY(8px); opacity: 0; }
          60%  { transform: scale(1.08) translateY(-4px); opacity: 1; }
          80%  { transform: scale(0.97) translateY(2px); }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes ec-icon-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
          50%       { box-shadow: 0 0 0 12px rgba(245, 158, 11, 0.15); }
        }
        @keyframes ec-scale-in {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }

        .ec-page-enter {
          animation: ec-fade-in 0.3s ease both;
        }
        .ec-panel-enter {
          animation: ec-fade-up 0.45s cubic-bezier(0.4,0,0.2,1) both;
        }
        .ec-panel-enter-delay-1 {
          animation: ec-fade-up 0.45s cubic-bezier(0.4,0,0.2,1) 0.08s both;
        }
        .ec-panel-enter-delay-2 {
          animation: ec-fade-up 0.45s cubic-bezier(0.4,0,0.2,1) 0.16s both;
        }
        .ec-panel-enter-delay-3 {
          animation: ec-fade-up 0.45s cubic-bezier(0.4,0,0.2,1) 0.22s both;
        }
        .ec-panel-enter-delay-4 {
          animation: ec-fade-up 0.45s cubic-bezier(0.4,0,0.2,1) 0.28s both;
        }
        .ec-panel-enter-delay-5 {
          animation: ec-fade-up 0.45s cubic-bezier(0.4,0,0.2,1) 0.34s both;
        }
        .ec-icon-bounce {
          animation: ec-icon-bounce 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.1s both,
                     ec-icon-pulse 2.5s ease-in-out 0.8s infinite;
        }
        .ec-alt-card {
          animation: ec-scale-in 0.35s ease both;
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        .ec-alt-card:hover {
          transform: scale(1.03);
          box-shadow: 0 4px 16px rgba(0,0,0,0.10);
        }
        .ec-primary-btn {
          transition: transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
        }
        .ec-primary-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(0,87,183,0.30);
        }
        .ec-primary-btn:active {
          transform: translateY(0);
          box-shadow: none;
        }
        .ec-secondary-btn {
          transition: color 0.15s ease, text-decoration-color 0.15s ease;
        }
      `}</style>

      {/* ------------------------------------------------------------------ */}
      {/* Root layout                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div
        className={`min-h-screen flex flex-col lg:flex-row ${mounted ? "ec-page-enter" : "opacity-0"}`}
      >
        {/* ================================================================ */}
        {/* LEFT PANEL — brand + animated icon                               */}
        {/* ================================================================ */}
        <div
          className="relative flex flex-col items-center justify-center px-8 py-10 lg:py-0 lg:w-2/5 lg:min-h-screen overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${scheme.leftBgFrom} 0%, ${scheme.leftBgTo} 100%)`,
          }}
          aria-hidden="true"
        >
          {/* Decorative blobs */}
          <div
            className="absolute -top-20 -left-20 w-72 h-72 rounded-full opacity-20 blur-3xl"
            style={{ background: "rgba(255,255,255,0.4)" }}
          />
          <div
            className="absolute -bottom-16 -right-16 w-56 h-56 rounded-full opacity-10 blur-2xl"
            style={{ background: "rgba(0,0,0,0.25)" }}
          />

          <div className="relative z-10 flex flex-col items-center gap-6">
            {/* Wordmark */}
            <div className="text-white/90 font-bold tracking-widest text-sm uppercase">
              ImagiQ
            </div>

            {/* Animated icon wrapper */}
            <div
              className={`ec-icon-bounce rounded-2xl p-5 ${scheme.iconWrapper}`}
            >
              <ErrorIcon icon={errorInfo.icon} colorClass={scheme.iconColor} />
            </div>

            {/* Short label under icon — visible on mobile too */}
            <p className="text-white font-semibold text-base text-center leading-snug max-w-[200px] lg:max-w-[240px]">
              {errorInfo.category === "system"
                ? "Error temporal"
                : errorInfo.category === "fraud"
                  ? "Pago bloqueado"
                  : errorInfo.category === "funds"
                    ? "Fondos insuficientes"
                    : errorInfo.category === "auth"
                      ? "Verificación fallida"
                      : errorInfo.category === "card" || errorInfo.category === "data"
                        ? "Problema con tu tarjeta"
                        : "Pago rechazado"}
            </p>

            {/* Subtle divider line only on desktop */}
            <div className="hidden lg:block w-12 h-0.5 rounded-full bg-white/30 mt-1" />

            {/* Reassurance copy — desktop only */}
            <p className="hidden lg:block text-white/75 text-xs text-center max-w-[200px] leading-relaxed">
              No realizamos ningún cargo a tu cuenta.
            </p>
          </div>
        </div>

        {/* ================================================================ */}
        {/* RIGHT PANEL — error details + CTAs                               */}
        {/* ================================================================ */}
        <div className="flex-1 bg-white lg:bg-gray-50 flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-16 xl:px-20 lg:min-h-screen">
          <div className="w-full max-w-lg mx-auto lg:mx-0">

            {/* 1. Error title */}
            <div className="ec-panel-enter">
              <span
                className={`inline-block text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full mb-4 ${scheme.badge}`}
              >
                Pago no procesado
              </span>
              <h1
                ref={titleRef}
                tabIndex={-1}
                role="alert"
                aria-live="assertive"
                className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight outline-none"
                style={{ letterSpacing: "-0.02em" }}
              >
                {errorInfo.title}
              </h1>
            </div>

            {/* 2. Description */}
            <p className="ec-panel-enter-delay-1 mt-3 text-base text-gray-600 leading-relaxed">
              {errorInfo.description}
            </p>

            {/* 3. Error detail box (message from ePayco) */}
            {rawMessage && (
              <div
                className={`ec-panel-enter-delay-2 mt-5 flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${scheme.infoBox}`}
              >
                <svg
                  className="shrink-0 mt-0.5 opacity-70"
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="8" y1="5" x2="8" y2="5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="8" y1="7.5" x2="8" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span>
                  <span className="font-semibold">Detalle: </span>
                  {rawMessage}
                </span>
              </div>
            )}

            {/* 4. Helpful tip */}
            {errorInfo.tip && (
              <div
                className={`ec-panel-enter-delay-2 mt-4 flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${scheme.tipBox}`}
              >
                <svg
                  className="shrink-0 mt-0.5 opacity-70"
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M8 1.5A5.5 5.5 0 0 0 5 11.5V13a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-1.5A5.5 5.5 0 0 0 8 1.5z"
                    stroke="currentColor"
                    strokeWidth="1.3"
                  />
                  <line x1="6" y1="15" x2="10" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span>{errorInfo.tip}</span>
              </div>
            )}

            {/* 5. 3DS help link */}
            {errorInfo.helpLink && (
              <div className="ec-panel-enter-delay-2 mt-3">
                <a
                  href={errorInfo.helpLink.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-[#0057B7] underline underline-offset-2 hover:text-[#004a9e] ec-secondary-btn"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
                    <line x1="7" y1="4.5" x2="7" y2="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <line x1="7" y1="6.5" x2="7" y2="9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  {errorInfo.helpLink.label}
                </a>
              </div>
            )}

            {/* 6. Primary CTA */}
            <div className="ec-panel-enter-delay-3 mt-8">
              <button
                type="button"
                onClick={() => handleAction(errorInfo.primaryCta.action as CtaAction)}
                className={`ec-primary-btn w-full py-4 px-6 rounded-2xl text-base font-bold shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${scheme.primaryBtn}`}
                aria-label={errorInfo.primaryCta.label}
              >
                {errorInfo.primaryCta.label}
              </button>
            </div>

            {/* 7. Secondary CTA */}
            {errorInfo.secondaryCta && (
              <div className="ec-panel-enter-delay-3 mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => handleAction(errorInfo.secondaryCta!.action as CtaAction)}
                  className="ec-secondary-btn text-sm text-gray-500 underline underline-offset-2 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 rounded"
                  aria-label={errorInfo.secondaryCta.label}
                >
                  {errorInfo.secondaryCta.label}
                </button>
              </div>
            )}

            {/* ------------------------------------------------------------ */}
            {/* 8. Alternative payment methods                               */}
            {/* ------------------------------------------------------------ */}
            <div className="ec-panel-enter-delay-4 mt-10">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
                Otras formas de pago
              </p>
              <div className="grid grid-cols-2 gap-3">
                {/* PSE */}
                <button
                  type="button"
                  onClick={() => router.push("/carrito?step=payment&method=pse")}
                  className={`ec-alt-card flex flex-col items-center gap-2 p-4 rounded-2xl border bg-white cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0057B7] ${scheme.altCardBorder} ${scheme.altCardHover}`}
                  aria-label="Pagar con PSE"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white">
                    <Image src={pseLogo} alt="PSE" width={35} height={35} className="object-contain" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-gray-800">PSE</p>
                    <p className="text-[10px] text-gray-500 leading-tight mt-0.5">
                      Debito bancario
                    </p>
                  </div>
                </button>

                {/* Addi */}
                <button
                  type="button"
                  onClick={() =>
                    router.push("/carrito?step=payment&method=addi")
                  }
                  className={`ec-alt-card flex flex-col items-center gap-2 p-4 rounded-2xl border bg-white cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0057B7] ${scheme.altCardBorder} ${scheme.altCardHover}`}
                  aria-label="Pagar con Addi en cuotas"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white">
                    <Image src={addiLogo} alt="Addi" width={35} height={35} className="object-contain" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-gray-800">Addi</p>
                    <p className="text-[10px] text-gray-500 leading-tight mt-0.5">
                      Paga en cuotas
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* ------------------------------------------------------------ */}
            {/* 8b. Saved cards — retry with a different card               */}
            {/* ------------------------------------------------------------ */}
            {isLoadingCards && (
              <div className="ec-panel-enter-delay-4 mt-6 space-y-2">
                <div className="h-3 w-40 bg-gray-200 rounded animate-pulse" />
                <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
                <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
              </div>
            )}
            {!isLoadingCards && savedCards.length > 0 && (
              <div className="ec-panel-enter-delay-4 mt-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                  Reintentar con otra tarjeta
                </p>
                <div className="space-y-2">
                  {savedCards.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => router.push(`/carrito?step=payment&savedCard=${card.id}`)}
                      className={`ec-alt-card w-full flex items-center gap-3 p-3 rounded-xl border bg-white cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0057B7] ${scheme.altCardBorder} ${scheme.altCardHover}`}
                      aria-label={`Pagar con tarjeta terminada en ${card.ultimos_dijitos}`}
                    >
                      <CardBrandLogo brand={card.marca} size="md" />
                      <div className="flex-1 text-left">
                        <p className="text-sm font-bold text-gray-800 tracking-wider">
                          **** {card.ultimos_dijitos}
                        </p>
                        {card.nombre_titular && (
                          <p className="text-[10px] text-gray-500 uppercase truncate">
                            {card.nombre_titular}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-[#0057B7] font-semibold whitespace-nowrap">
                        Usar esta
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------ */}
            {/* 9. Support footer                                            */}
            {/* ------------------------------------------------------------ */}
            <div className="ec-panel-enter-delay-5 mt-8 pt-6 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-sm text-gray-500">Necesitas ayuda?</p>
              <a
                href="https://wa.me/573000000000?text=Hola%2C%20tuve%20un%20problema%20en%20el%20pago"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-green-200 bg-green-50 text-green-800 text-sm font-medium hover:bg-green-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                aria-label="Contactar soporte por WhatsApp"
              >
                {/* WhatsApp icon */}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M8 0.5C3.86 0.5 0.5 3.86 0.5 8c0 1.36.36 2.64.99 3.74L0.5 15.5l3.86-.98A7.453 7.453 0 0 0 8 15.5c4.14 0 7.5-3.36 7.5-7.5S12.14.5 8 .5zm4.08 10.45c-.17.47-1 .9-1.37.95-.37.05-.73.23-2.46-.51-2.07-.88-3.38-2.99-3.49-3.13-.1-.14-.85-1.13-.85-2.16 0-1.03.54-1.54.74-1.75.19-.21.42-.26.56-.26h.4c.13 0 .3-.05.47.36.17.41.58 1.41.63 1.51.05.1.09.22.02.35-.07.14-.1.22-.2.34-.1.12-.21.26-.3.35-.1.1-.2.2-.09.39.12.19.52.86 1.12 1.39.77.69 1.42.9 1.62 1 .2.1.31.08.43-.05.12-.13.5-.58.63-.78.13-.2.26-.17.44-.1.18.07 1.14.54 1.34.63.2.1.33.15.38.23.05.08.05.45-.12.92z"
                    fill="currentColor"
                  />
                </svg>
                Chatear por WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Skeleton shown while Suspense resolves searchParams
// ---------------------------------------------------------------------------

function ErrorCheckoutSkeleton() {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row animate-pulse">
      <div className="lg:w-2/5 min-h-[240px] lg:min-h-screen bg-amber-300" />
      <div className="flex-1 bg-white lg:bg-gray-50 flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-16 xl:px-20">
        <div className="w-full max-w-lg mx-auto lg:mx-0 space-y-4">
          <div className="h-5 w-32 bg-gray-200 rounded-full" />
          <div className="h-9 w-3/4 bg-gray-200 rounded-xl" />
          <div className="h-4 w-full bg-gray-100 rounded" />
          <div className="h-4 w-5/6 bg-gray-100 rounded" />
          <div className="h-14 w-full bg-gray-200 rounded-2xl mt-8" />
          <div className="h-4 w-40 bg-gray-100 rounded mx-auto" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default export — Suspense boundary required for searchParams in Next.js 15
// ---------------------------------------------------------------------------

export default function ErrorCheckoutPage() {
  return (
    <Suspense fallback={<ErrorCheckoutSkeleton />}>
      <ErrorCheckoutContent />
    </Suspense>
  );
}
