"use client";

/**
 * Error global de la app: reemplaza el "Application error: a client-side
 * exception has occurred" de Next por un mensaje con botón de reintento.
 * Estilos inline porque el CSS de la app pudo no haber cargado.
 */

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
          background: "#f9fafb",
          color: "#111827",
          padding: 16,
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 22, margin: "0 0 12px" }}>No pudimos cargar la página</h1>
          <p style={{ margin: "0 0 24px", color: "#4b5563", lineHeight: 1.5 }}>
            Puede ser un problema momentáneo de conexión. Intenta de nuevo en unos segundos.
          </p>
          <button
            onClick={() => {
              reset();
              window.location.reload();
            }}
            style={{
              background: "#000",
              color: "#fff",
              border: 0,
              borderRadius: 999,
              padding: "12px 28px",
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
