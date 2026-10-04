"use client";

/**
 * Error boundary global — la última red.
 *
 * Next.js monta este archivo cuando el fallo ocurre en el layout raíz, es
 * decir cuando ni siquiera `error.tsx` alcanza a dibujarse. Por eso reemplaza
 * el documento entero y tiene que traer sus propios `<html>` y `<body>`: en
 * ese punto el layout de la app ya no existe.
 *
 * Aquí NO se intenta recuperar de un chunk que no cargó: de eso se encarga
 * `chunkRecoveryScript`, que corre inline en el <head> y actúa aunque el bundle
 * de Next nunca llegue — mucho antes de que React pueda montar este boundary.
 * Lo que queda para esta pantalla son los errores que sí dejaron arrancar la
 * app y reventaron después, incluido el almacenamiento del navegador en mal
 * estado, que ninguna recarga arregla.
 */

import { useEffect } from "react";
import PantallaDeError from "@/components/PantallaDeError";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
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
