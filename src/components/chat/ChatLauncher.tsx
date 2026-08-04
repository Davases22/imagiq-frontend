"use client";

import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Botón flotante que abre el asistente.
 *
 * Qué se quitó respecto de la versión anterior, y por qué:
 *
 * - **Arrastre vertical.** El botón se podía mover y guardaba su posición en
 *   localStorage, con detección click-vs-arrastre por un umbral de 5px. Ningún
 *   widget de referencia (Intercom, Zendesk, Crisp) lo permite: mueve un
 *   elemento fijo fuera de su sitio esperado, rompe el orden de tabulación y
 *   convierte un click simple en un gesto ambiguo.
 * - **El desplazamiento de +170px** sobre el borde inferior, que lo dejaba
 *   flotando a media altura sin relación con nada.
 * - **La burbuja de saludo automática** a los 2 segundos. Interrumpe antes de
 *   que nadie haya leído la página; si se quiere reactivar, debe condicionarse
 *   a permanencia real en la página, no a un temporizador.
 * - **El degradado azul**, que no pertenece a la paleta de la tienda.
 */
export default function ChatLauncher({
  onClick,
  hidden,
}: Readonly<{ onClick: () => void; hidden?: boolean }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Abrir el asistente de la tienda"
      aria-haspopup="dialog"
      className={cn(
        // 56px: el tamaño medio de los lanzadores de referencia y muy por
        // encima del mínimo táctil de 44px.
        "fixed bottom-5 right-5 z-50 grid h-14 w-14 place-items-center rounded-full",
        "bg-foreground text-background shadow-lg",
        "transition-[transform,opacity,box-shadow] duration-200 ease-out",
        "hover:shadow-xl hover:brightness-110 active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "motion-reduce:transition-none motion-reduce:active:scale-100",
        hidden && "pointer-events-none scale-90 opacity-0",
      )}
      style={{
        bottom: "max(1.25rem, env(safe-area-inset-bottom, 1.25rem))",
        right: "max(1.25rem, env(safe-area-inset-right, 1.25rem))",
      }}
    >
      <MessageCircle className="h-6 w-6" aria-hidden="true" />
    </button>
  );
}
