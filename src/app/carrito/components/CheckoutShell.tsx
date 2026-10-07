"use client";

/**
 * Shell del checkout: agrega la columna del indicador de pasos SOLO a partir
 * de step2 (cuando el usuario dio "Continuar" en el carrito). En /carrito y
 * /carrito/step1 los children se renderizan a ancho completo, igual que antes
 * de introducir el indicador.
 */

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import CheckoutStepIndicator, { milestoneFromPath } from "./CheckoutStepIndicator";

export default function CheckoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const inProgress = milestoneFromPath(pathname) !== null;

  // Con el carrito vacio no hay nada que comprar: estar en Entrega, Pago o
  // Confirmar no lleva a ninguna parte y deja pantallas a medias (totales en
  // cero, pasos que no pueden avanzar). Se devuelve al carrito.
  //
  // Se lee localStorage y no useCart a proposito: el hook no avisa cuando
  // termino de cargar, asi que durante la hidratacion el carrito parece vacio
  // y echaria a quien si tiene productos. localStorage es sincrono.
  //
  // Solo al ENTRAR a un paso (depende de pathname): asi, si el carrito se
  // vacia como parte de cerrar una compra, no se interrumpe lo que este
  // haciendo la pantalla.
  useEffect(() => {
    if (!inProgress) return;
    let vacio = true;
    try {
      const guardado = JSON.parse(localStorage.getItem("cart-items") ?? "[]");
      vacio = !Array.isArray(guardado) || guardado.length === 0;
    } catch {
      vacio = true;
    }
    if (vacio) router.replace("/carrito/step1");
  }, [pathname, inProgress, router]);

  // Al cambiar de paso, arriba del todo. Sin esto —y se nota sobre todo en
  // movil, donde los pasos son largos— se llegaba al paso siguiente a media
  // pagina, con el titulo fuera de pantalla, tanto al continuar como al volver.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname]);

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
