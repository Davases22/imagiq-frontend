"use client";

/**
 * Indicador de progreso del checkout.
 *
 * Empieza DESPUÉS del carrito (cuando el usuario da "Continuar"): el carrito
 * no es un paso, es el punto de partida. Hitos: Tus datos → Entrega → Pago →
 * Confirmar (los steps internos 4/5/6 se agrupan en "Pago" porque cuotas y
 * facturación son sub-pasos condicionales que confundirían el conteo).
 *
 * Desktop: riel vertical fino — hecho (círculo negro + check), actual (negro
 * con halo suave + label bold), pendiente (borde gris). Móvil: barra
 * segmentada compacta + "Paso X de 4".
 */

import { usePathname } from "next/navigation";
import { Check } from "lucide-react";

const MILESTONES = [
  { id: 1, name: "Tus datos" },
  { id: 2, name: "Entrega" },
  { id: 3, name: "Pago" },
  { id: 4, name: "Confirmar" },
];

/** null = aún en el carrito (no mostrar indicador) */
export function milestoneFromPath(pathname: string): number | null {
  if (pathname.includes("/step2")) return 1;
  if (pathname.includes("/step3")) return 2;
  if (pathname.includes("/step4") || pathname.includes("/step5") || pathname.includes("/step6")) return 3;
  if (pathname.includes("/step7")) return 4;
  return null; // /carrito y /carrito/step1: sin indicador
}

export default function CheckoutStepIndicator() {
  const pathname = usePathname() || "";
  const current = milestoneFromPath(pathname);
  if (current === null) return null;

  return (
    <nav aria-label="Progreso de compra">
      {/* ---------- Móvil: barra segmentada + paso actual ---------- */}
      <div className="md:hidden">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-sm font-bold text-gray-900">
            {MILESTONES[current - 1].name}
          </span>
          <span className="text-xs font-medium text-gray-400">
            Paso {current} de {MILESTONES.length}
          </span>
        </div>
        <div className="flex gap-1.5">
          {MILESTONES.map((s) => (
            <div
              key={s.id}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                s.id <= current ? "bg-gray-900" : "bg-gray-200"
              }`}
            />
          ))}
        </div>
      </div>

      {/* ---------- Desktop: riel vertical ---------- */}
      <ol className="hidden md:flex md:flex-col">
        {MILESTONES.map((step, i) => {
          const done = current > step.id;
          const active = current === step.id;
          return (
            <li key={step.id} aria-current={active ? "step" : undefined}>
              <div className="flex items-center gap-4">
                <span
                  className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-base font-semibold transition-all duration-300 ${
                    done
                      ? "bg-gray-900 text-white"
                      : active
                        ? "bg-gray-900 text-white shadow-[0_0_0_5px_rgba(17,24,39,0.12)]"
                        : "border-2 border-gray-200 bg-white text-gray-400"
                  }`}
                >
                  {done ? <Check strokeWidth={3} className="h-5 w-5" /> : step.id}
                </span>
                <span
                  className={`text-base transition-colors duration-300 ${
                    active
                      ? "font-bold text-gray-900"
                      : done
                        ? "font-semibold text-gray-700"
                        : "font-medium text-gray-400"
                  }`}
                >
                  {step.name}
                </span>
              </div>
              {i < MILESTONES.length - 1 && (
                <div
                  className={`ml-6 h-12 w-0.5 -translate-x-1/2 transition-colors duration-300 ${
                    done ? "bg-gray-900" : "bg-gray-200"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
