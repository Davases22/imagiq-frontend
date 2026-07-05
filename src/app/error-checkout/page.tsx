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
  Lock,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
import { getPaymentErrorInfo, type CtaAction } from "@/lib/payment-error-map";
import { useCardsCache } from "@/app/carrito/hooks/useCardsCache";
import CardBrandLogo from "@/components/ui/CardBrandLogo";
import pseLogo from "@/img/iconos/logo-pse.png";
import addiLogo from "@/img/iconos/addi_negro.png";
import { fbqTrackCustom } from "@/lib/meta-pixel";
import { posthogUtils } from "@/lib/posthogClient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ColorScheme = "amber" | "red" | "blue";

// ---------------------------------------------------------------------------
// Severity accent — tuned for the dark left rail (soft, low-chroma on black)
// ---------------------------------------------------------------------------

const accentText: Record<ColorScheme, string> = {
  amber: "text-amber-300",
  red:   "text-red-300",
  blue:  "text-sky-300",
};

const accentHalo: Record<ColorScheme, string> = {
  amber: "bg-amber-400/10 ring-amber-400/20",
  red:   "bg-red-400/10 ring-red-400/20",
  blue:  "bg-sky-400/10 ring-sky-400/20",
};

// ---------------------------------------------------------------------------
// Icon renderer — lucide-react, caller-controlled color/size
// ---------------------------------------------------------------------------

function StatusIcon({ icon, className }: { icon: string; className: string }) {
  switch (icon) {
    case "shield": return <ShieldAlert className={className} strokeWidth={1.5} aria-hidden="true" />;
    case "wallet": return <Wallet      className={className} strokeWidth={1.5} aria-hidden="true" />;
    case "card":   return <CreditCard  className={className} strokeWidth={1.5} aria-hidden="true" />;
    case "lock":   return <Ban         className={className} strokeWidth={1.5} aria-hidden="true" />;
    case "clock":  return <Clock       className={className} strokeWidth={1.5} aria-hidden="true" />;
    default:       return <AlertCircle className={className} strokeWidth={1.5} aria-hidden="true" />;
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
// Minimalist reveal keyframes (Stripe-like: short, ease-out, no bounce).
// Rendered once; disabled under prefers-reduced-motion.
// ---------------------------------------------------------------------------

const REVEAL_STYLES = `
  @keyframes ecReveal { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  @keyframes ecHalo   { from { opacity: 0; transform: scale(.85); }       to { opacity: 1; transform: none; } }
  .ec-reveal { opacity: 0; animation: ecReveal .55s cubic-bezier(.16,.84,.44,1) both; }
  .ec-halo   { animation: ecHalo .7s cubic-bezier(.16,.84,.44,1) both; }
  .ec-details > summary { list-style: none; }
  .ec-details > summary::-webkit-details-marker { display: none; }
  .ec-chevron { transition: transform .2s ease; }
  .ec-details[open] .ec-chevron { transform: rotate(180deg); }
  @media (prefers-reduced-motion: reduce) {
    .ec-reveal, .ec-halo { animation: none !important; opacity: 1 !important; transform: none !important; }
  }
`;

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

  // Analytics: un evento por rechazo de pago (solo al montar)
  useEffect(() => {
    fbqTrackCustom("PaymentRejected", {
      error_code: rawCode || "unknown",
      error_category: errorInfo.category,
      can_retry: errorInfo.canRetry,
      currency: "COP",
    });

    posthogUtils.capture("payment_rejected", {
      error_code: rawCode || "unknown",
      error_category: errorInfo.category,
      error_title: errorInfo.title,
      can_retry: errorInfo.canRetry,
      primary_action: errorInfo.primaryCta.action,
      currency: "COP",
      $set: {
        last_payment_rejection_code: rawCode || "unknown",
        last_payment_rejection_category: errorInfo.category,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <div className="min-h-screen w-full bg-white text-gray-900 lg:h-screen lg:overflow-hidden">
      <style>{REVEAL_STYLES}</style>

      <div className="flex min-h-screen flex-col lg:h-screen lg:flex-row">
        {/* ================================================================ */}
        {/* LEFT — dark context rail: brand · what happened · reassurance     */}
        {/* ================================================================ */}
        <aside className="relative flex flex-col justify-between overflow-hidden bg-[#0a0a0a] px-7 py-10 sm:px-10 lg:w-[44%] lg:max-w-[600px] lg:shrink-0 lg:px-14 lg:py-14">
          {/* soft radial glows */}
          <div aria-hidden className="pointer-events-none absolute -left-24 -top-28 h-80 w-80 rounded-full bg-white/[0.05] blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-white/[0.03] blur-3xl" />

          {/* brand */}
          <p
            className="ec-reveal relative text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60 select-none"
            style={{ animationDelay: "40ms" }}
          >
            Samsung Store
          </p>

          {/* status */}
          <div className="relative my-10 max-w-md lg:my-0">
            {/* icon + title on the same row */}
            <div className="flex items-center gap-3.5">
              <div
                className={`ec-halo inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full ring-1 ${accentHalo[scheme]}`}
                style={{ animationDelay: "80ms" }}
              >
                <StatusIcon icon={errorInfo.icon} className={`h-6 w-6 ${accentText[scheme]}`} />
              </div>

              <h1
                ref={titleRef}
                tabIndex={-1}
                role="alert"
                aria-live="assertive"
                className="ec-reveal text-2xl font-semibold leading-tight tracking-tight text-white outline-none sm:text-[26px]"
                style={{ animationDelay: "120ms" }}
              >
                {errorInfo.title}
              </h1>
            </div>

            <p
              className="ec-reveal mt-4 max-w-sm text-[15px] leading-relaxed text-white/80"
              style={{ animationDelay: "180ms" }}
            >
              {errorInfo.description}
            </p>

            {/* reassurance — a rejected payment means no charge was captured */}
            <div
              className="ec-reveal mt-7 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.08] px-3.5 py-1.5"
              style={{ animationDelay: "240ms" }}
            >
              <Lock className="h-3.5 w-3.5 text-white/75" strokeWidth={1.75} aria-hidden="true" />
              <span className="text-xs font-medium text-white/90">No se realizó ningún cobro a tu tarjeta</span>
            </div>
          </div>

          {/* footer — trust marker */}
          <div
            className="ec-reveal relative flex items-center gap-2 text-xs text-white/60"
            style={{ animationDelay: "300ms" }}
          >
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            <span>Pago protegido &middot; procesado por ePayco</span>
          </div>
        </aside>

        {/* ================================================================ */}
        {/* RIGHT — white action panel                                        */}
        {/* ================================================================ */}
        <main className="flex flex-1 flex-col bg-white px-6 py-9 sm:px-10 lg:h-screen lg:overflow-y-auto lg:px-14 lg:py-14">
          <div className="mx-auto w-full max-w-md">

            {/* Detail box — only on the GENERIC fallback, where the title doesn't
                convey the reason. On mapped errors the title already says it, so
                showing the raw PSP text here would be redundant. */}
            {errorInfo.category === "generic" && rawMessage && (
              <div
                className="ec-reveal rounded-xl border border-gray-200/80 bg-gray-50 px-4 py-3"
                style={{ animationDelay: "120ms" }}
              >
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-gray-400">
                  Detalle del error
                </p>
                <p className="text-sm leading-snug text-gray-700">{rawMessage}</p>
              </div>
            )}

            {/* Explainer — collapsible dropdown, closed by default (e.g. how 3D
                Secure works and why the bank asks for it) */}
            {errorInfo.explainer && (
              <details
                className="ec-reveal ec-details mt-4 overflow-hidden rounded-xl border border-gray-200/80 bg-white"
                style={{ animationDelay: "180ms" }}
              >
                <summary className="flex cursor-pointer items-center gap-2.5 px-4 py-3.5">
                  <ShieldAlert className="h-5 w-5 shrink-0 text-gray-900" strokeWidth={1.6} aria-hidden="true" />
                  <span className="flex-1 text-sm font-semibold text-gray-900">
                    {errorInfo.explainer.heading}
                  </span>
                  <ChevronDown className="ec-chevron h-4 w-4 shrink-0 text-gray-400" strokeWidth={2} aria-hidden="true" />
                </summary>
                <div className="px-4 pb-4">
                  <p className="text-xs leading-relaxed text-gray-500">
                    {errorInfo.explainer.intro}
                  </p>
                  <ol className="mt-3.5 space-y-2.5">
                    {errorInfo.explainer.steps.map((step, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-900 text-[11px] font-semibold text-white">
                          {i + 1}
                        </span>
                        <span className="text-xs leading-relaxed text-gray-600">{step}</span>
                      </li>
                    ))}
                  </ol>
                  {errorInfo.explainer.image && (
                    // Docs diagram from ePayco's CDN — plain <img> (external host not in
                    // next/image remotePatterns; allowed by the `https:` CSP img-src).
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={errorInfo.explainer.image.url}
                      alt={errorInfo.explainer.image.alt}
                      loading="lazy"
                      className="mt-4 w-full rounded-lg border border-gray-200/80 bg-gray-50"
                    />
                  )}
                </div>
              </details>
            )}

            {/* Tip box */}
            {errorInfo.tip && (
              <div
                className="ec-reveal mt-4 rounded-xl border-l-2 border-gray-900/70 bg-gray-50 px-4 py-3"
                style={{ animationDelay: "220ms" }}
              >
                <p className="text-sm leading-snug text-gray-600">{errorInfo.tip}</p>
              </div>
            )}

            {/* Help link */}
            {errorInfo.helpLink && (
              <div className="ec-reveal mt-3" style={{ animationDelay: "260ms" }}>
                <a
                  href={errorInfo.helpLink.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-500 underline decoration-gray-300 underline-offset-4 transition-colors hover:text-gray-900"
                >
                  {errorInfo.helpLink.label}
                </a>
              </div>
            )}

            {/* Primary CTA */}
            <div className="ec-reveal mt-7" style={{ animationDelay: "300ms" }}>
              <button
                type="button"
                onClick={() => handleAction(errorInfo.primaryCta.action)}
                className="w-full rounded-xl bg-[#0a0a0a] px-5 py-3.5 text-sm font-semibold text-white transition-transform duration-150 hover:bg-[#1f1f1f] active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
                aria-label={errorInfo.primaryCta.label}
              >
                {errorInfo.primaryCta.label}
              </button>
            </div>

            {/* Secondary CTA — text link */}
            {errorInfo.secondaryCta && (
              <div className="ec-reveal mt-3 flex justify-center" style={{ animationDelay: "330ms" }}>
                <button
                  type="button"
                  onClick={() => handleAction(errorInfo.secondaryCta!.action)}
                  className="rounded text-sm text-gray-500 underline decoration-gray-300 underline-offset-4 transition-colors hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                  aria-label={errorInfo.secondaryCta.label}
                >
                  {errorInfo.secondaryCta.label}
                </button>
              </div>
            )}

            {/* Divider */}
            <div className="ec-reveal my-8 border-t border-gray-100" style={{ animationDelay: "360ms" }} />

            {/* Alternative payment methods */}
            <div className="ec-reveal" style={{ animationDelay: "380ms" }}>
              <p className="mb-4 text-xs font-medium uppercase tracking-widest text-gray-400">
                Otras formas de pago
              </p>

              <div className="flex gap-3">
                {/* PSE */}
                <button
                  type="button"
                  onClick={() => router.push("/carrito?step=payment&method=pse")}
                  className="flex flex-1 items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 transition-colors hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
                  aria-label="Pagar con PSE"
                >
                  <Image src={pseLogo} alt="PSE" width={32} height={32} className="shrink-0 object-contain" />
                  <div className="text-left">
                    <p className="text-xs font-semibold leading-none text-gray-800">PSE</p>
                    <p className="mt-0.5 text-[10px] leading-tight text-gray-500">Debito bancario</p>
                  </div>
                </button>

                {/* Addi */}
                <button
                  type="button"
                  onClick={() => router.push("/carrito?step=payment&method=addi")}
                  className="flex flex-1 items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 transition-colors hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
                  aria-label="Pagar con Addi en cuotas"
                >
                  <Image src={addiLogo} alt="Addi" width={32} height={32} className="shrink-0 object-contain" />
                  <div className="text-left">
                    <p className="text-xs font-semibold leading-none text-gray-800">Addi</p>
                    <p className="mt-0.5 text-[10px] leading-tight text-gray-500">Paga en cuotas</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Saved cards */}
            {isLoadingCards && (
              <div className="mt-5 space-y-2">
                <div className="h-3 w-36 animate-pulse rounded bg-gray-100" />
                <div className="h-11 animate-pulse rounded-xl bg-gray-100" />
                <div className="h-11 animate-pulse rounded-xl bg-gray-100" />
              </div>
            )}

            {!isLoadingCards && savedCards.length > 0 && (
              <div className="ec-reveal mt-5" style={{ animationDelay: "420ms" }}>
                <p className="mb-3 text-xs font-medium uppercase tracking-widest text-gray-400">
                  Reintentar con otra tarjeta
                </p>
                <div className="space-y-2">
                  {savedCards.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => router.push(`/carrito?step=payment&savedCard=${card.id}`)}
                      className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 transition-colors hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
                      aria-label={`Pagar con tarjeta terminada en ${card.ultimos_dijitos}`}
                    >
                      <CardBrandLogo brand={card.marca} size="md" />
                      <div className="flex-1 text-left">
                        <p className="text-sm font-semibold tracking-wider text-gray-800">
                          **** {card.ultimos_dijitos}
                        </p>
                        {card.nombre_titular && (
                          <p className="truncate text-[10px] uppercase text-gray-500">
                            {card.nombre_titular}
                          </p>
                        )}
                      </div>
                      <span className="whitespace-nowrap text-xs font-medium text-gray-900">
                        Usar esta
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* WhatsApp support */}
            <div className="ec-reveal mt-8 flex items-center justify-between gap-4 border-t border-gray-100 pt-6" style={{ animationDelay: "460ms" }}>
              <p className="text-sm text-gray-500">Necesitas ayuda?</p>
              <a
                href="https://wa.me/573000000000?text=Hola%2C%20tuve%20un%20problema%20en%20el%20pago"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded text-sm font-medium text-green-700 transition-colors hover:text-green-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                aria-label="Contactar soporte por WhatsApp"
              >
                <WhatsAppIcon />
                WhatsApp
              </a>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton shown while Suspense resolves searchParams — split, matches layout
// ---------------------------------------------------------------------------

function ErrorCheckoutSkeleton() {
  return (
    <div className="grid min-h-screen lg:h-screen lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      <aside className="flex flex-col justify-between bg-[#0a0a0a] px-7 py-10 sm:px-10 lg:w-[44%] lg:max-w-[600px] lg:shrink-0 lg:px-14 lg:py-14">
        <div className="h-3 w-20 rounded-full bg-white/10" />
        <div className="my-10 space-y-4 lg:my-0">
          <div className="h-12 w-12 rounded-full bg-white/10" />
          <div className="h-7 w-56 rounded bg-white/10" />
          <div className="h-4 w-72 rounded bg-white/[0.06]" />
          <div className="h-7 w-60 rounded-full bg-white/[0.05]" />
        </div>
        <div className="h-3 w-40 rounded bg-white/[0.06]" />
      </aside>
      <main className="flex-1 bg-white px-6 py-9 sm:px-10 lg:px-14 lg:py-14">
        <div className="mx-auto w-full max-w-md animate-pulse space-y-4">
          <div className="h-16 w-full rounded-xl bg-gray-100" />
          <div className="h-11 w-full rounded-xl bg-gray-200" />
          <div className="h-4 w-32 rounded bg-gray-100" />
          <div className="mt-4 flex gap-3">
            <div className="h-14 flex-1 rounded-xl bg-gray-100" />
            <div className="h-14 flex-1 rounded-xl bg-gray-100" />
          </div>
        </div>
      </main>
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
