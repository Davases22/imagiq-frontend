"use client";

/**
 * Error boundary de ruta.
 *
 * Next.js monta este archivo cuando algo revienta dentro de una página o de
 * cualquiera de sus componentes. Hasta hoy la app no tenía ninguno, así que el
 * error salía sin filtro: el cliente veía la pantalla blanca de Next con el
 * texto en inglés "Application error: a client-side exception has occurred"
 * (caso real en imagiq.com, 3-oct-2026) y no tenía ninguna salida.
 *
 * Importante: este boundary NO cubre lo que falle en el layout raíz. De eso se
 * encarga `global-error.tsx`.
 */

import { useEffect } from "react";
import PantallaDeError from "@/components/PantallaDeError";
import { intentarAutoRecuperacion } from "@/lib/client-error-recovery";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Si el error es por un archivo que quedó viejo tras un despliegue, esto
    // recarga solo y el cliente ni se entera. Devuelve true si va a recargar,
    // en cuyo caso no vale la pena seguir haciendo nada aquí.
    if (intentarAutoRecuperacion(error)) return;

    console.error("[imagiq] Error de ruta:", error);
  }, [error]);

  return <PantallaDeError reset={reset} digest={error?.digest} />;
}
