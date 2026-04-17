"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  ShieldAlert,
  AlertCircle,
  CreditCard,
  Clock,
  Wallet,
  Ban,
} from "lucide-react";
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
// Color scheme — top border + icon tint only
// ---------------------------------------------------------------------------

const borderColor: Record<ColorScheme, string> = {
  amber: "#f59e0b",
  red:   "#ef4444",
  blue:  "#3b82f6",
};

const iconBg: Record<ColorScheme, string> = {
  amber: "bg-amber-50 text-amber-600",
  red:   "bg-red-50 text-red-600",
  blue:  "bg-blue-50 text-blue-600",
};

// ---------------------------------------------------------------------------
// Icon renderer — lucide-react only, 28px stroke
// ---------------------------------------------------------------------------

function StatusIcon({ icon, scheme }: { icon: string; scheme: ColorScheme }) {
  const cls = `w-7 h-7 ${iconBg[scheme].split(" ")[1]}`;
  switch (icon) {
    case "shield": return <ShieldAlert className={cls} strokeWidth={1.75} aria-hidden="true" />;
    case "wallet": return <Wallet      className={cls} strokeWidth={1.75} aria-hidden="true" />;
    case "card":   return <CreditCard  className={cls} strokeWidth={1.75} aria-hidden="true" />;
    case "lock":   return <Ban         className={cls} strokeWidth={1.75} aria-hidden="true" />;
    case "clock":  return <Clock       className={cls} strokeWidth={1.75} aria-hidden="true" />;
    default:       return <AlertCircle className={cls} strokeWidth={1.75} aria-hidden="true" />;
  }
}

// ---------------------------------------------------------------------------
// WhatsApp icon (inline SVG — no external dep needed, kept minimal)
// ---------------------------------------------------------------------------

function WhatsAppIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 0.5C3.86 0.5 0.5 3.86 0.5 8c0 1.36.36 2.64.99 3.74L0.5 15.5l3.86-.98A7.453 7.453 0 0 0 8 15.5c4.14 0 7.5-3.36 7.5-7.5S12.14.5 8 .5zm4.08 10.45c-.17.47-1 .9-1.37.95-.37.05-.73.23-2.46-.51-2.07-.88-3.38-2.99-3.49-3.13-.1-.14-.85-1.13-.85-2.16 0-1.03.54-1.54.74-1.75.19-.21.42-.26.56-.26h.4c.13 0 .3-.05.47.36.17.41.58 1.41.63 1.51.05.1.09.22.02.35-.07.14-.1.22-.2.34-.1.12-.21.26-.3.35-.1.1-.2.2-.09.39.12.19.52.86 1.12 1.39.77.69 1.42.9 1.62 1 .2.1.31.08.43-.05.12-.13.5-.58.63-.78.13-.2.26-.17.44-.1.18.07 1.14.54 1.34.63.2.1.33.15.38.23.05.08.05.45-.12.92z"
      />
    </svg>
  );
}

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
  const rawCode    = searchParams.get("code")    ?? undefined;

  const errorInfo = getPaymentErrorInfo(rawCode, rawMessage);
  const scheme    = (errorInfo.colorScheme as ColorScheme) ?? "amber";

  useEffect(() => {
    setMounted(true);
    loadSavedCards();
  }, [loadSavedCards]);

  // Focus title for accessibility after mount
  useEffect(() => {
    if (mounted && titleRef.current) {
      titleRef.current.focus();
    }
  }, [mounted]);

  function handleAction(action: string) {
    switch (action as CtaAction) {
      case "retry":         router.push("/carrito");                 break;
      case "changeMethod":  router.push("/carrito?step=payment");    break;
      case "contactBank":   window.open("tel:018000", "_self");      break;
      case "viewOrders":    router.push("/mis-pedidos");             break;
      case "goHome":        router.push("/");                        break;
    }
  }

  return (
    <div
      className="min-h-screen bg-[#f7f7f8] flex items-start sm:items-center justify-center px-4 py-10 sm:py-16"
      style={{
        opacity: mounted ? 1 : 0,
        transition: "opacity 300ms ease",
      }}
    >
      <div className="w-full max-w-lg">
        {/* ---------------------------------------------------------------- */}
        {/* Card                                                              */}
        {/* ---------------------------------------------------------------- */}
        <div
          className="bg-white rounded-2xl shadow-sm overflow-hidden"
          style={{ borderTop: `4px solid ${borderColor[scheme]}` }}
        >
          <div className="px-6 pt-8 pb-8 sm:px-8">

            {/* Samsung wordmark */}
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-gray-400 text-center mb-6 select-none">
              Samsung
            </p>

            {/* Status icon */}
            <div className="flex justify-center mb-5">
              <div
                className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${iconBg[scheme]}`}
              >
                <StatusIcon icon={errorInfo.icon} scheme={scheme} />
              </div>
            </div>

            {/* Title */}
            <h1
              ref={titleRef}
              tabIndex={-1}
              role="alert"
              aria-live="assertive"
              className="text-xl font-semibold text-gray-900 text-center outline-none mb-2"
            >
              {errorInfo.title}
            </h1>

            {/* Description */}
            <p className="text-sm text-gray-600 text-center leading-relaxed">
              {errorInfo.description}
            </p>

            {/* Detail box — only if there is a raw message from the PSP */}
            {rawMessage && (
              <div className="mt-5 border-l-4 border-gray-300 bg-gray-50 rounded-r-lg px-4 py-3">
                <p className="text-xs text-gray-500 font-medium mb-0.5">Detalle del error</p>
                <p className="text-sm text-gray-700 leading-snug">{rawMessage}</p>
              </div>
            )}

            {/* Tip box — blue left-border style */}
            {errorInfo.tip && (
              <div className="mt-4 border-l-4 border-blue-400 bg-blue-50 rounded-r-lg px-4 py-3">
                <p className="text-sm text-blue-800 leading-snug">{errorInfo.tip}</p>
              </div>
            )}

            {/* Help link */}
            {errorInfo.helpLink && (
              <div className="mt-3 flex justify-center">
                <a
                  href={errorInfo.helpLink.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#0057B7] underline underline-offset-2 hover:text-[#004a9e] transition-colors"
                >
                  {errorInfo.helpLink.label}
                </a>
              </div>
            )}

            {/* Primary CTA */}
            <div className="mt-7">
              <button
                type="button"
                onClick={() => handleAction(errorInfo.primaryCta.action)}
                className="w-full py-3 px-5 rounded-xl text-sm font-semibold text-white bg-[#0057B7] hover:bg-[#004a9e] active:bg-[#003d84] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0057B7]"
                aria-label={errorInfo.primaryCta.label}
              >
                {errorInfo.primaryCta.label}
              </button>
            </div>

            {/* Secondary CTA — text link */}
            {errorInfo.secondaryCta && (
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => handleAction(errorInfo.secondaryCta!.action)}
                  className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 rounded"
                  aria-label={errorInfo.secondaryCta.label}
                >
                  {errorInfo.secondaryCta.label}
                </button>
              </div>
            )}

            {/* ------------------------------------------------------------ */}
            {/* Divider                                                       */}
            {/* ------------------------------------------------------------ */}
            <div className="mt-8 mb-6 border-t border-gray-100" />

            {/* ------------------------------------------------------------ */}
            {/* Alternative payment methods                                  */}
            {/* ------------------------------------------------------------ */}
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-4">
              Otras formas de pago
            </p>

            <div className="flex gap-3">
              {/* PSE */}
              <button
                type="button"
                onClick={() => router.push("/carrito?step=payment&method=pse")}
                className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0057B7]"
                aria-label="Pagar con PSE"
              >
                <Image
                  src={pseLogo}
                  alt="PSE"
                  width={32}
                  height={32}
                  className="object-contain shrink-0"
                />
                <div className="text-left">
                  <p className="text-xs font-semibold text-gray-800 leading-none">PSE</p>
                  <p className="text-[10px] text-gray-500 leading-tight mt-0.5">Debito bancario</p>
                </div>
              </button>

              {/* Addi */}
              <button
                type="button"
                onClick={() => router.push("/carrito?step=payment&method=addi")}
                className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0057B7]"
                aria-label="Pagar con Addi en cuotas"
              >
                <Image
                  src={addiLogo}
                  alt="Addi"
                  width={32}
                  height={32}
                  className="object-contain shrink-0"
                />
                <div className="text-left">
                  <p className="text-xs font-semibold text-gray-800 leading-none">Addi</p>
                  <p className="text-[10px] text-gray-500 leading-tight mt-0.5">Paga en cuotas</p>
                </div>
              </button>
            </div>

            {/* ------------------------------------------------------------ */}
            {/* Saved cards                                                   */}
            {/* ------------------------------------------------------------ */}
            {isLoadingCards && (
              <div className="mt-5 space-y-2">
                <div className="h-3 w-36 bg-gray-100 rounded animate-pulse" />
                <div className="h-11 bg-gray-100 rounded-xl animate-pulse" />
                <div className="h-11 bg-gray-100 rounded-xl animate-pulse" />
              </div>
            )}

            {!isLoadingCards && savedCards.length > 0 && (
              <div className="mt-5">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">
                  Reintentar con otra tarjeta
                </p>
                <div className="space-y-2">
                  {savedCards.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() =>
                        router.push(`/carrito?step=payment&savedCard=${card.id}`)
                      }
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0057B7]"
                      aria-label={`Pagar con tarjeta terminada en ${card.ultimos_dijitos}`}
                    >
                      <CardBrandLogo brand={card.marca} size="md" />
                      <div className="flex-1 text-left">
                        <p className="text-sm font-semibold text-gray-800 tracking-wider">
                          **** {card.ultimos_dijitos}
                        </p>
                        {card.nombre_titular && (
                          <p className="text-[10px] text-gray-500 uppercase truncate">
                            {card.nombre_titular}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-[#0057B7] font-medium whitespace-nowrap">
                        Usar esta
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------ */}
            {/* WhatsApp support                                              */}
            {/* ------------------------------------------------------------ */}
            <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-between gap-4">
              <p className="text-sm text-gray-500">Necesitas ayuda?</p>
              <a
                href="https://wa.me/573000000000?text=Hola%2C%20tuve%20un%20problema%20en%20el%20pago"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-green-700 font-medium hover:text-green-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 rounded"
                aria-label="Contactar soporte por WhatsApp"
              >
                <WhatsAppIcon />
                WhatsApp
              </a>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton shown while Suspense resolves searchParams
// ---------------------------------------------------------------------------

function ErrorCheckoutSkeleton() {
  return (
    <div className="min-h-screen bg-[#f7f7f8] flex items-start sm:items-center justify-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm overflow-hidden animate-pulse">
        <div className="h-1 bg-gray-200 w-full" />
        <div className="px-6 pt-8 pb-8 sm:px-8 space-y-4">
          <div className="h-3 w-20 bg-gray-100 rounded-full mx-auto" />
          <div className="w-12 h-12 bg-gray-100 rounded-full mx-auto" />
          <div className="h-5 w-48 bg-gray-200 rounded mx-auto" />
          <div className="h-4 w-64 bg-gray-100 rounded mx-auto" />
          <div className="h-4 w-56 bg-gray-100 rounded mx-auto" />
          <div className="h-11 w-full bg-gray-200 rounded-xl mt-6" />
          <div className="h-4 w-32 bg-gray-100 rounded mx-auto" />
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
