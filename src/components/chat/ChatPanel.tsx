"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FormattedMessage } from "@/components/chatbot/FormattedMessage";
import ChatProductCard from "@/app/chatbot/ChatProductCard";
import { useChatbot } from "@/contexts/ChatbotContext";
import { sendMessageToAgent } from "@/services/chatbot.service";

/**
 * Panel del asistente.
 *
 * Geometría
 * ---------
 * Tarjeta flotante acotada en escritorio y pantalla completa en móvil. La
 * versión anterior era `fixed inset-0` **con** `width: 420px`: como `inset-0`
 * fija a la vez `left` y `right`, la caja quedaba sobre-restringida y el
 * navegador resolvía `left:0`, pegando el panel al borde IZQUIERDO a toda
 * altura y tapando el logo y el menú del sitio.
 *
 * Un asistente no debe ocupar el alto completo: al hacerlo se come la cabecera
 * y el cliente pierde el sitio donde estaba. Se ancla abajo a la derecha, justo
 * encima del lanzador, y deja la página visible y utilizable.
 *
 * No bloquea la página
 * --------------------
 * A propósito no hay velo ni bloqueo de scroll, y un click fuera NO cierra: la
 * pregunta más común es sobre el producto que el cliente está mirando, así que
 * tiene que poder tocarlo sin perder la conversación. Escape sí cierra, pero
 * sólo cuando el foco está dentro del panel — si no, cerraría el chat al pulsar
 * Escape en el buscador del sitio.
 */

const QUICK_REPLIES = [
  "¿Qué celulares tienen?",
  "¿En qué tiendas están?",
  "¿Cómo va mi pedido?",
] as const;

export default function ChatPanel({ onClose }: Readonly<{ onClose: () => void }>) {
  const { messages, sessionId, addMessage, setSessionId } = useChatbot();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showThinking, setShowThinking] = useState(false);

  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const composingRef = useRef(false);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Foco al abrir y devolución del foco al cerrar. Sin esto, quien navega con
  // teclado queda tirado al principio del documento al cerrar el panel.
  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    composerRef.current?.focus();
    return () => restoreFocusRef.current?.focus?.();
  }, []);

  // Escape ACOTADO al panel (ver nota de cabecera).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (panelRef.current?.contains(document.activeElement)) {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // El teclado de iOS reduce el viewport visible; sin esto la caja de escritura
  // queda debajo del teclado.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () => {
      if (panelRef.current) {
        panelRef.current.style.setProperty("--chat-vh", `${vv.height}px`);
      }
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, []);

  // Auto-scroll que NO pelea con el usuario: sólo baja si ya estaba abajo. La
  // versión anterior hacía scrollIntoView en cada cambio, así que arrastraba al
  // cliente al final de una respuesta que aún estaba leyendo.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const distanceFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
    if (distanceFromBottom < 120) {
      list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
    }
  }, [messages, showThinking]);

  // El indicador de "pensando" no aparece antes de 400ms: por debajo de ese
  // umbral un parpadeo se percibe como un fallo, no como progreso.
  useEffect(() => {
    if (!loading) {
      setShowThinking(false);
      return;
    }
    const timer = setTimeout(() => setShowThinking(true), 400);
    return () => clearTimeout(timer);
  }, [loading]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || loading) return;

      addMessage({ from: "user", text: message });
      setInput("");
      setLoading(true);

      try {
        const response = await sendMessageToAgent(message, sessionId);
        if (response.session_id) setSessionId(response.session_id);
        addMessage({
          from: "bot",
          text: response.answer,
          products: response.products?.length ? response.products : undefined,
        });
      } catch (error) {
        // El backend acompaña sus rechazos con un mensaje ya redactado; se
        // muestra ese en vez de un código de estado.
        addMessage({
          from: "bot",
          text:
            error instanceof Error && error.message
              ? error.message
              : "No pude responderte en este momento. ¿Lo intentamos de nuevo?",
        });
      } finally {
        setLoading(false);
      }
    },
    [addMessage, loading, sessionId, setSessionId],
  );

  const onComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // `composingRef` evita enviar a medias una palabra acentuada o un texto
    // escrito con teclado predictivo: durante la composición, Enter confirma
    // el candidato, no envía el mensaje.
    if (event.key === "Enter" && !event.shiftKey && !composingRef.current) {
      event.preventDefault();
      void send(input);
    }
  };

  const lastAssistantMessage =
    [...messages].reverse().find((m) => m.from === "bot")?.text ?? "";

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-labelledby={titleId}
      className={cn(
        "fixed z-[60] flex flex-col overflow-hidden bg-background text-foreground",
        // Móvil: pantalla completa, usando el alto visible real.
        "inset-0 h-[var(--chat-vh,100dvh)] w-full",
        // Escritorio: tarjeta acotada, anclada sobre el lanzador.
        "sm:inset-auto sm:bottom-[88px] sm:right-5 sm:h-[min(620px,calc(100dvh-120px))] sm:w-[400px]",
        "sm:rounded-2xl sm:border sm:border-border sm:shadow-2xl",
        "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-200",
      )}
    >
      {/* Cabecera: barra de herramientas real, sin degradado ni "persona" falsa */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="min-w-0">
          <h2 id={titleId} tabIndex={-1} className="truncate text-[15px] font-semibold">
            Asistente ImagiQ
          </h2>
          <p className="truncate text-[11px] text-muted-foreground">
            Respuestas generadas con IA
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Cerrar el asistente"
          className="h-9 w-9 shrink-0 rounded-full"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </header>

      {/* Conversación */}
      <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center px-2 text-center">
            <p className="text-[15px] font-medium">¿En qué te ayudo?</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Busco productos, reviso disponibilidad en tiendas y resuelvo dudas
              de envíos, pagos o tu pedido.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-5">
          {messages.map((message, index) => (
            <div
              key={`${message.from}-${index}`}
              className={cn("flex flex-col gap-1", message.from === "user" && "items-end")}
            >
              {/* Asistente sin burbuja, cliente con burbuja: la asimetría hace
                  la conversación más legible que dos burbujas enfrentadas. */}
              <div
                className={cn(
                  "text-[14px] leading-relaxed",
                  message.from === "user"
                    ? "max-w-[85%] rounded-2xl rounded-br-md bg-muted px-3.5 py-2.5"
                    : "max-w-full",
                )}
              >
                <FormattedMessage text={message.text} />
              </div>

              {message.products && message.products.length > 0 && (
                <div className="mt-2 flex flex-col gap-2">
                  {/* Tope de 3: más tarjetas dentro de un panel de 400px se
                      lee como spam y entierra la respuesta. */}
                  {message.products.slice(0, 3).map((product) => (
                    <ChatProductCard key={product.id} codigoMarketBase={product.id} />
                  ))}
                </div>
              )}
            </div>
          ))}

          {showThinking && (
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <span className="flex gap-1" aria-hidden="true">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.2s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.1s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
              </span>
              Buscando…
            </div>
          )}
        </div>
      </div>

      {/* Región de anuncio: se emite la respuesta COMPLETA una sola vez. Volcar
          texto parcial aquí hace que los lectores de pantalla relean la frase
          entera en cada cambio. */}
      <p aria-live="polite" className="sr-only">
        {loading ? "" : lastAssistantMessage}
      </p>

      {/* Sugerencias: sólo al principio, para no competir con la conversación */}
      {messages.length === 0 && (
        <div className="flex shrink-0 gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {QUICK_REPLIES.map((reply) => (
            <Button
              key={reply}
              variant="outline"
              size="sm"
              onClick={() => void send(reply)}
              className="shrink-0 rounded-full px-4 text-[13px] font-normal"
            >
              {reply}
            </Button>
          ))}
        </div>
      )}

      {/* Caja de escritura */}
      <form
        className="flex shrink-0 items-end gap-2 border-t border-border p-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))" }}
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
      >
        <textarea
          ref={composerRef}
          rows={1}
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            // Crece con el contenido hasta un tope, para que un mensaje largo
            // no empuje la conversación fuera de la vista.
            event.target.style.height = "auto";
            event.target.style.height = `${Math.min(event.target.scrollHeight, 120)}px`;
          }}
          onKeyDown={onComposerKeyDown}
          onCompositionStart={() => (composingRef.current = true)}
          onCompositionEnd={() => (composingRef.current = false)}
          aria-label="Escribe tu mensaje"
          placeholder="Pregunta por un modelo, precio o tu pedido…"
          disabled={loading}
          className={cn(
            "max-h-[120px] min-h-[42px] flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2.5",
            // 16px exactos: por debajo, iOS hace zoom al enfocar y descoloca
            // toda la página.
            "text-[16px] leading-snug outline-none placeholder:text-muted-foreground",
            "focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
          )}
        />
        <Button
          type="submit"
          size="icon"
          disabled={loading || !input.trim()}
          aria-label="Enviar mensaje"
          className="h-[42px] w-[42px] shrink-0 rounded-xl"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>
    </div>
  );
}
