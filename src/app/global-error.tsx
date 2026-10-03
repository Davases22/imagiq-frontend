"use client";

/**
 * Error boundary global — la última red.
 *
 * Next.js monta este archivo cuando el fallo ocurre en el layout raíz, es
 * decir cuando ni siquiera `error.tsx` alcanza a dibujarse. Por eso reemplaza
 * el documento entero y tiene que traer sus propios `<html>` y `<body>`: en
 * ese punto el layout de la app ya no existe.
 *
 * Es lo que evita que un cliente vuelva a ver la pantalla cruda de Next
 * ("Application error: a client-side exception has occurred"), como pasó en
 * imagiq.com el 3-oct-2026.
 */

import { useEffect } from "react";
import PantallaDeError from "@/components/PantallaDeError";
import { intentarAutoRecuperacion } from "@/lib/client-error-recovery";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Caso más común: archivo viejo tras un despliegue. Recarga sola, una vez.
    if (intentarAutoRecuperacion(error)) return;

    console.error("[imagiq] Error global:", error);
  }, [error]);

  return (
    <html lang="es-CO">
      <body style={{ margin: 0 }}>
        <PantallaDeError reset={reset} digest={error?.digest} />
      </body>
    </html>
  );
}
