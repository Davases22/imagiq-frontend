"use client";

/**
 * Pantalla que ve el cliente cuando la aplicación revienta.
 *
 * Va con estilos en línea, no con Tailwind, a propósito: esta pantalla tiene
 * que poder dibujarse incluso cuando lo que falló fue la hoja de estilos o el
 * layout raíz. Si dependiera de clases que quizá no cargaron, el usuario vería
 * texto suelto sobre fondo blanco — justo lo que venimos a evitar.
 *
 * Tampoco importa iconos ni `next/image`: cada dependencia es una forma más de
 * que la pantalla de error falle a su vez.
 */

import { useEffect, useState } from "react";
import { limpiarDatosDelSitio } from "@/lib/client-error-recovery";

// Negro, no el azul de la marca: es el color que la tienda ya usa para sus
// botones principales y el que David dejó en el global-error que está en
// producción. Una pantalla de error no es el lugar para estrenar una paleta.
const ACENTO = "#000000";

export function PantallaDeError({
  reset,
  digest,
}: {
  /** Reintenta el render sin recargar. Lo entrega el error boundary de Next. */
  reset?: () => void;
  /** Identificador del error que genera Next; sirve para rastrearlo en soporte. */
  digest?: string;
}) {
  const [limpiando, setLimpiando] = useState(false);

  // El botón de reintentar de Next no recarga la página, sólo vuelve a montar
  // el árbol. Si lo que está roto es el estado guardado en el navegador, eso no
  // arregla nada, así que se ofrece la limpieza como segunda salida.
  const alLimpiar = () => {
    setLimpiando(true);
    limpiarDatosDelSitio();
    window.location.href = "/";
  };

  // Que el error quede en la consola: es lo único que hoy le podemos pedir al
  // cliente que nos mande ("F12 → Console").
  useEffect(() => {
    if (digest) {
      console.error(`[imagiq] Error de aplicación. digest=${digest}`);
    }
  }, [digest]);

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        backgroundColor: "#ffffff",
        color: "#111111",
        fontFamily:
          "var(--font-inter), Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
      }}
    >
      <main style={{ width: "100%", maxWidth: "440px", textAlign: "center" }}>
        <div
          style={{
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "0.18em",
            color: ACENTO,
            marginBottom: "28px",
          }}
        >
          SAMSUNG
        </div>

        <h1
          style={{
            fontSize: "22px",
            lineHeight: 1.3,
            fontWeight: 700,
            margin: "0 0 12px",
            textWrap: "balance",
          }}
        >
          No pudimos cargar la página
        </h1>

        <p
          style={{
            fontSize: "15px",
            lineHeight: 1.6,
            color: "#555555",
            margin: "0 0 28px",
          }}
        >
          Fue un problema al abrirla en tu navegador, no en tu compra. Vuelve a
          intentarlo y, si sigue igual, usa el último botón: deja tu navegador
          como nuevo sin borrar nada de tu cuenta.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button
            onClick={() => (reset ? reset() : window.location.reload())}
            style={{
              width: "100%",
              padding: "14px 20px",
              borderRadius: "9999px",
              border: "none",
              backgroundColor: ACENTO,
              color: "#ffffff",
              fontSize: "15px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>

          <button
            onClick={() => (window.location.href = "/")}
            style={{
              width: "100%",
              padding: "14px 20px",
              borderRadius: "9999px",
              border: "1px solid #d4d4d4",
              backgroundColor: "#ffffff",
              color: "#111111",
              fontSize: "15px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Ir al inicio
          </button>

          <button
            onClick={alLimpiar}
            disabled={limpiando}
            style={{
              width: "100%",
              padding: "12px 20px",
              borderRadius: "9999px",
              border: "none",
              backgroundColor: "transparent",
              color: "#777777",
              fontSize: "14px",
              fontWeight: 500,
              cursor: limpiando ? "default" : "pointer",
              textDecoration: "underline",
              textUnderlineOffset: "3px",
            }}
          >
            {limpiando ? "Limpiando…" : "Limpiar datos y reintentar"}
          </button>
        </div>

        <p
          style={{
            fontSize: "13px",
            lineHeight: 1.6,
            color: "#777777",
            margin: "28px 0 0",
          }}
        >
          ¿Sigue sin cargar? Escríbenos por WhatsApp al{" "}
          <a
            href="https://wa.me/573228639389"
            style={{ color: ACENTO, fontWeight: 600 }}
          >
            322 863 9389
          </a>
          .
        </p>

        {digest && (
          <p
            style={{
              fontSize: "11px",
              color: "#aaaaaa",
              margin: "16px 0 0",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            }}
          >
            ref: {digest}
          </p>
        )}
      </main>
    </div>
  );
}

export default PantallaDeError;
