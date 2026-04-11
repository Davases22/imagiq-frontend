// filepath: src/app/chatbot/ChatbotPanel.tsx
import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Step1 from "./step1";
import Step2 from "./step2";
import Step3 from "./step3";
import Step4 from "./step4";
import { X } from "lucide-react";

// Importa el servicio del agente conversacional
import { sendMessageToAgent, AgentProduct } from "@/services/chatbot.service";
// Importa el componente de mensaje formateado
import { FormattedMessage } from "@/components/chatbot/FormattedMessage";
// Importa el componente de ProductCard para el chat
import ChatProductCard from "./ChatProductCard";
// Importa el contexto del chat
import { useChatbot } from "@/contexts/ChatbotContext";

// Tipo de mensaje extendido que puede incluir productos
interface ChatMessage {
  from: "user" | "bot";
  text: string;
  products?: AgentProduct[]; // Productos del agente (si los hay)
}

export default function ChatbotPanel({ onClose }: Readonly<{ onClose: () => void }>) {
  const [step, setStep] = useState(0);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Usar el contexto en lugar de estado local
  const { messages, sessionId, addMessage, setSessionId } = useChatbot();

  // Ref para el contenedor de mensajes (auto-scroll)
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Ajustar el panel al viewport visible cuando el teclado iOS aparece.
  // Usa height + transform para que el panel siempre ocupe exactamente
  // el área visible, sin que iOS desplace el header fuera de pantalla.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const sync = () => {
      if (!panelRef.current) return;
      // Altura = viewport visible (excluye teclado)
      panelRef.current.style.height = `${vv.height}px`;
      // Compensar el scroll que iOS aplica al abrir teclado
      panelRef.current.style.transform = `translateY(${vv.offsetTop}px)`;
    };

    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, []);

  // Auto-scroll cuando cambian los mensajes o el estado de loading
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleNext = () => setStep((prev) => prev + 1);
  const handleReset = () => setStep(0);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  // Enviar mensaje al agente conversacional
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    addMessage({ from: "user", text: userMessage });
    setInput("");
    setLoading(true);

    try {
      const response = await sendMessageToAgent(userMessage, sessionId);

      // Guardar session_id para mantener el contexto
      if (response.session_id) {
        setSessionId(response.session_id);
      }

      // Mostrar el campo answer al usuario + productos si los hay
      addMessage({
        from: "bot",
        text: response.answer,
        products: response.products && response.products.length > 0 ? response.products : undefined
      });
    } catch {
      addMessage({ from: "bot", text: "Ocurrió un error al contactar al asistente." });
    } finally {
      setLoading(false);
    }
  };

  // Handle quick option buttons
  const handleQuickOption = async (optionText: string) => {
    addMessage({ from: "user", text: optionText });
    setLoading(true);

    try {
      const response = await sendMessageToAgent(optionText, sessionId);

      // Guardar session_id para mantener el contexto
      if (response.session_id) {
        setSessionId(response.session_id);
      }

      // Mostrar el campo answer al usuario + productos si los hay
      addMessage({
        from: "bot",
        text: response.answer,
        products: response.products && response.products.length > 0 ? response.products : undefined
      });
    } catch {
      addMessage({ from: "bot", text: "Ocurrió un error al contactar al asistente." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={panelRef}
      className="fixed inset-0 flex flex-col chatbot-panel shadow-2xl"
    >
      {/* Header mejorado */}
      <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-gray-900 to-black border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-full overflow-hidden">
            <Image
              src="/images/support-agent.png"
              alt="Agente de soporte"
              width={36}
              height={36}
              className="rounded-full object-cover"
            />
          </div>
          <div>
            <span className="font-bold text-lg text-white block">
              Samsung Asistente
            </span>
            <span className="text-xs text-gray-300 flex items-center gap-1">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              {' '}En línea
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-full transition-colors"
          aria-label="Cerrar chat"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      {/* Chat Body con scroll mejorado */}
      <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col scroll-smooth"
style={{
          scrollBehavior: 'smooth'
        }}
      >
        {step === 0 && (
          <div className="mb-8 flex flex-col gap-3">
            {messages.map((msg, idx) => (
              <div
                key={`${msg.from}-${idx}`}
                className="flex flex-col gap-3"
              >
                {/* Mensaje de texto */}
                <div
                  className={`rounded-2xl px-4 py-3 text-sm w-fit max-w-[85%] shadow-sm ${
                    msg.from === "bot"
                      ? "bg-gray-100 text-gray-800 border border-gray-200"
                      : "bg-white text-gray-900 border border-black self-end ml-auto"
                  }`}
                >
                  <FormattedMessage text={msg.text} />
                </div>

                {/* ProductCards si hay productos */}
                {msg.products && msg.products.length > 0 && (
                  <div className="flex flex-col gap-3 mt-2">
                    {msg.products.map((product) => (
                      <ChatProductCard
                        key={product.id}
                        codigoMarketBase={product.id}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="rounded-2xl px-4 py-3 text-sm w-fit max-w-[85%] bg-gray-100 text-gray-500 flex items-center gap-2 border border-gray-200">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                </div>
                <span>Samsung IA está escribiendo...</span>
              </div>
            )}
            {/* Elemento invisible para hacer scroll automático */}
            <div ref={messagesEndRef} />
          </div>
        )}
        {step === 1 && <Step1 onContinue={handleNext} />}
        {step === 2 && <Step2 onContinue={handleNext} />}
        {step === 3 && <Step3 onContinue={handleNext} />}
        {step === 4 && <Step4 />}
      </div>
      {/* Opciones: ahora justo encima del input */}
      {step === 0 && messages.length === 0 && (
        <div className="flex flex-col gap-2 px-4 pb-3">
          <button
            onClick={() => handleQuickOption("Necesito ayuda con mi compra")}
            className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 transition-all shadow-sm hover:shadow-md group"
          >
            <div className="w-8 h-8 rounded-full bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center transition-colors">
              <span className="text-lg">🛒</span>
            </div>
            <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">Ayuda con mi compra</span>
          </button>
          <button
            onClick={() => handleQuickOption("¿Cuál es el estado de mi compra?")}
            className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 transition-all shadow-sm hover:shadow-md group"
          >
            <div className="w-8 h-8 rounded-full bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center transition-colors">
              <span className="text-lg">📦</span>
            </div>
            <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">Estado de mi pedido</span>
          </button>
          <button
            onClick={() => handleQuickOption("Quiero conocer productos Samsung")}
            className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 transition-all shadow-sm hover:shadow-md group"
          >
            <div className="w-8 h-8 rounded-full bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center transition-colors">
              <span className="text-lg">📱</span>
            </div>
            <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">Explorar productos</span>
          </button>
        </div>
      )}
      {/* Chat Input habilitado */}
      {step === 0 && (
        <form
          className="p-4 border-t border-gray-200 bg-white bg-opacity-95 backdrop-blur-sm flex gap-2"
          onSubmit={handleSend}
        >
          <input
            type="text"
            className="flex-1 rounded-full border-2 border-gray-200 px-5 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 bg-white transition-all"
            placeholder="Escribe tu mensaje..."
            value={input}
            onChange={handleInputChange}
            autoFocus
            disabled={loading}
          />
          <button
            type="submit"
            className="bg-gradient-to-r from-gray-900 to-black text-white rounded-full px-6 py-2.5 text-sm font-semibold shadow-md hover:shadow-lg hover:from-black hover:to-gray-900 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || !input.trim()}
          >
            Enviar
          </button>
        </form>
      )}
      {/* Botón para volver al inicio si está en steps */}
      {step > 0 && (
        <div className="p-4 border-t border-gray-100 bg-transparent flex justify-end">
          <button
            className="text-sm text-gray-900 hover:underline"
            type="button"
            onClick={handleReset}
          >
            Volver al inicio
          </button>
        </div>
      )}
    </div>
  );
}