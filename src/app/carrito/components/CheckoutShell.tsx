"use client";

/**
 * Shell del checkout: agrega la columna del indicador de pasos SOLO a partir
 * de step2 (cuando el usuario dio "Continuar" en el carrito). En /carrito y
 * /carrito/step1 los children se renderizan a ancho completo, igual que antes
 * de introducir el indicador.
 */

import { usePathname } from "next/navigation";
import CheckoutStepIndicator, { milestoneFromPath } from "./CheckoutStepIndicator";

export default function CheckoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const inProgress = milestoneFromPath(pathname) !== null;

  if (!inProgress) return <>{children}</>;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 md:flex-row md:gap-8 md:px-6">
      {/* Patrón correcto de sticky en flex: el ASIDE mismo es sticky +
          self-start (no se estira), así se queda FIJO a top-28 al hacer scroll
          dentro de la fila. */}
      <aside className="w-full pt-4 md:w-56 md:flex-shrink-0 md:self-start md:sticky md:top-28 md:pt-10">
        <CheckoutStepIndicator />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
