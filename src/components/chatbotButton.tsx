"use client";
import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { MessageCircle } from "lucide-react";

export default function ChatbotButton({
  onClick,
}: Readonly<{ onClick?: () => void }>) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [position, setPosition] = useState(0); // Posición relativa desde el centro
  const [isDragging, setIsDragging] = useState(false);
  const [hasMoved, setHasMoved] = useState(false); // Para detectar si hubo movimiento
  const dragStartY = useRef(0);
  const initialPosition = useRef(0);
  const buttonRef = useRef<HTMLDivElement>(null);

  // Cargar posición guardada al montar
  useEffect(() => {
    const savedPosition = localStorage.getItem('chatbot-button-position');
    if (savedPosition) {
      setPosition(parseFloat(savedPosition));
    }
  }, []);

  // Mostrar tooltip después de 2 segundos (menos intrusivo)
  useEffect(() => {
    const timer = setTimeout(() => setShowTooltip(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Ocultar tooltip automáticamente después de 5 segundos
  useEffect(() => {
    if (showTooltip) {
      const timer = setTimeout(() => setShowTooltip(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showTooltip]);

  // Defensa en profundidad: si el gesto empezó en la × del tooltip, el
  // contenedor NO debe iniciar arrastre/click (que abriría el chat). La ×
  // ya frena mousedown/touchstart con stopPropagation, pero esta guarda
  // cubre cualquier caso donde el evento igual llegue aquí.
  const startedOnCloseButton = (target: EventTarget | null): boolean =>
    target instanceof Element &&
    !!target.closest('[aria-label="Cerrar mensaje"]');

  // Handlers para arrastre con mouse
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Solo click izquierdo
    if (startedOnCloseButton(e.target)) return; // × del tooltip: no abrir chat
    setIsDragging(true);
    setHasMoved(false); // Resetear el estado de movimiento
    dragStartY.current = e.clientY;
    initialPosition.current = position;
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const deltaY = e.clientY - dragStartY.current;

    // Si el movimiento es mayor a 5px, considerarlo como arrastre
    if (Math.abs(deltaY) > 5) {
      setHasMoved(true);
    }

    const newPosition = initialPosition.current + deltaY;

    // Limitar el movimiento a la mitad de la pantalla (hacia arriba y hacia abajo)
    const maxMove = window.innerHeight / 2;
    const clampedPosition = Math.max(-maxMove, Math.min(maxMove, newPosition));

    setPosition(clampedPosition);
  };

  const handleMouseUp = () => {
    setIsDragging(false);

    // Si hubo movimiento, guardar la posición. Si no, es un click
    if (hasMoved) {
      localStorage.setItem('chatbot-button-position', position.toString());
    } else {
      // Es un click, ejecutar la función onClick
      onClick?.();
    }
  };

  // Handlers para arrastre táctil
  const handleTouchStart = (e: React.TouchEvent) => {
    if (startedOnCloseButton(e.target)) return; // × del tooltip: no abrir chat
    setIsDragging(true);
    setHasMoved(false); // Resetear el estado de movimiento
    dragStartY.current = e.touches[0].clientY;
    initialPosition.current = position;
    e.preventDefault(); // Prevenir scroll mientras se arrastra
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging) return;

    e.preventDefault(); // Prevenir scroll mientras se arrastra

    const deltaY = e.touches[0].clientY - dragStartY.current;

    // Si el movimiento es mayor a 5px, considerarlo como arrastre
    if (Math.abs(deltaY) > 5) {
      setHasMoved(true);
    }

    const newPosition = initialPosition.current + deltaY;

    // Limitar el movimiento a la mitad de la pantalla
    const maxMove = window.innerHeight / 2;
    const clampedPosition = Math.max(-maxMove, Math.min(maxMove, newPosition));

    setPosition(clampedPosition);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);

    // Si hubo movimiento, guardar la posición. Si no, es un click
    if (hasMoved) {
      localStorage.setItem('chatbot-button-position', position.toString());
    } else {
      // Es un click/tap, ejecutar la función onClick
      onClick?.();
    }
  };

  // Event listeners globales
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("touchmove", handleTouchMove, { passive: false });
      document.addEventListener("touchend", handleTouchEnd);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.removeEventListener("touchmove", handleTouchMove);
        document.removeEventListener("touchend", handleTouchEnd);
      };
    }
  }, [isDragging, position]);

  return (
    <div
      ref={buttonRef}
      className="fixed right-6 z-50 flex items-end gap-3 transition-none"
      style={{
        bottom: `calc(max(1.5rem, env(safe-area-inset-bottom, 1.5rem)) + 170px - ${position}px)`,
        cursor: isDragging ? "grabbing" : "grab",
        touchAction: "none", // Prevenir scroll en móviles al tocar el botón
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {/* Burbuja de mensaje mejorada */}
      {showTooltip && (
        <div className="relative bg-white shadow-xl rounded-2xl px-4 py-3 max-w-[180px] mb-1 animate-chatbot-slide-in border border-gray-100">
          <p className="text-sm text-gray-800 font-medium leading-tight">
            ¿Dudas? Estoy aquí para ayudarte 👋
          </p>
          {/* Triángulo apuntando al botón */}
          <div className="absolute -right-2 bottom-4 w-0 h-0 border-t-[8px] border-t-transparent border-l-[8px] border-l-white border-b-[8px] border-b-transparent"></div>
          {/* Botón de cerrar tooltip. IMPORTANTE: frenar mousedown/touchstart
              además del click. El contenedor externo usa onMouseDown/onTouchStart
              para arrastrar/abrir el chat; sin stopPropagation en esos eventos,
              tocar la × burbujea al contenedor y abre el chat (bug en mobile y
              desktop). El stopPropagation del onClick por sí solo no basta. */}
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setShowTooltip(false);
            }}
            className="absolute -top-2 -right-2 w-5 h-5 bg-gray-700 hover:bg-gray-800 rounded-full flex items-center justify-center text-xs text-white shadow-md transition-colors before:absolute before:-inset-2.5 before:content-['']"
            aria-label="Cerrar mensaje"
          >
            ×
          </button>
        </div>
      )}

      {/* Botón con foto de persona o icono de fallback */}
      <button
        className="relative flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-xl rounded-full transition-all duration-300 hover:scale-105 active:scale-95 border-2 border-white"
        aria-label="Abrir chat de ayuda"
        type="button"
      >
        {!imageError ? (
          <Image
            src="/images/support-agent.png"
            alt="Agente de soporte"
            width={64}
            height={64}
            className="rounded-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <MessageCircle className="w-7 h-7 text-white" />
        )}
        {/* Indicador verde de "en línea" mejorado */}
        <span className="absolute bottom-1 right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse"></span>
      </button>
    </div>
  );
}
