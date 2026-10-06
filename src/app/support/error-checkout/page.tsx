"use client";

/**
 * Pago de una orden de soporte que no se completó.
 *
 * Gemela de `/support/success-checkout`: mismo fondo y misma tarjeta que
 * `/soporte/inicio_de_soporte`, de donde viene el cliente. Si al fallar el pago
 * lo mandamos a una pantalla suelta de otro color, parece que se salió del
 * sitio justo en el peor momento.
 *
 * No muestra el estado crudo (`REJECTED`) ni redirige sola a los 8 segundos:
 * lo primero no significa nada para quien lo lee, y lo segundo lo saca de la
 * pantalla mientras todavía está entendiendo qué pasó.
 */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { WHATSAPP_NUMERO } from "@/components/sections/soporte/whatsapp/constants";

function Contenido() {
  const params = useSearchParams();
  const orderId = params?.get("orderId");

  return (
    <main
      className="min-h-screen bg-cover bg-center flex items-center justify-center p-6"
      style={{ backgroundImage: "url('/images/fondo_soporte.jpg')" }}
    >
      <div className="w-full max-w-lg rounded-xl bg-white/95 p-8 text-center shadow-xl backdrop-blur-sm">
        <div
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-rose-50/70"
          aria-hidden="true"
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fb7185"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </div>

        <h1 className="mb-3 text-2xl font-bold text-balance text-neutral-900">
          No se pudo completar el pago
        </h1>

        <p className="mb-6 text-sm leading-relaxed text-neutral-600">
          Tu banco no autorizó la transacción, así que no te cobramos nada.
          Puedes intentarlo de nuevo con otra tarjeta o pagar por PSE.
        </p>

        {orderId && (
          <div className="mb-6 rounded-xl bg-neutral-50 px-4 py-3">
            <p className="text-xs text-neutral-500">Número de orden</p>
            <p className="font-mono text-base font-semibold text-neutral-900">
              {orderId}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Link
            href="/soporte/inicio_de_soporte"
            className="w-full rounded-full bg-black px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-neutral-800"
          >
            Intentar de nuevo
          </Link>
          <Link
            href="/"
            className="w-full rounded-full border border-neutral-300 px-6 py-3 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-50"
          >
            Ir al inicio
          </Link>
        </div>

        <p className="mt-6 text-xs leading-relaxed text-neutral-500">
          ¿Sigue sin funcionar? Escríbenos por WhatsApp al{" "}
          <a
            href={`https://wa.me/${WHATSAPP_NUMERO}`}
            className="font-semibold text-neutral-900 underline underline-offset-2"
          >
            300 651 5136
          </a>
          .
        </p>
      </div>
    </main>
  );
}

export default function SupportErrorPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen bg-cover bg-center"
          style={{ backgroundImage: "url('/images/fondo_soporte.jpg')" }}
        />
      }
    >
      <Contenido />
    </Suspense>
  );
}
