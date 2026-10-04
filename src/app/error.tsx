"use client";

/**
 * Error boundary de ruta — el que faltaba.
 *
 * `global-error.tsx` solo entra cuando revienta el layout raíz. Un error dentro
 * de una página concreta o de sus componentes, que es el caso mucho más común,
 * no estaba cubierto por nadie: salía sin filtro y el cliente veía la pantalla
 * blanca de Next con el texto en inglés "Application error: a client-side
 * exception has occurred" (caso real en imagiq.com, 3-oct-2026).
 *
 * La diferencia práctica con el boundary global es que aquí el layout sigue
 * vivo, así que el usuario conserva la navegación y puede salir por su cuenta.
 *
 * Los fallos de carga de chunks no se tratan aquí: `chunkRecoveryScript` los
 * atrapa en el <head>, antes de que React exista.
 */

import { useEffect } from "react";
import PantallaDeError from "@/components/PantallaDeError";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[imagiq] Error de ruta:", error);
  }, [error]);

  return <PantallaDeError reset={reset} digest={error?.digest} />;
}
