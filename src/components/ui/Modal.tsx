"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  showCloseButton?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  size = "md",
  showCloseButton = true,
}) => {
  // Bloquear scroll cuando el modal está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Cerrar con ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-3xl",
    xl: "max-w-5xl",
    "2xl": "max-w-7xl",
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-start sm:items-center justify-center p-0 sm:p-4 pt-0 sm:pt-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal - En mobile: pegado arriba, sin bordes redondeados arriba, altura máxima completa
          En desktop: centrado con bordes redondeados */}
      <div
        className={`relative w-full ${sizeClasses[size]} bg-white rounded-none sm:rounded-2xl shadow-2xl max-h-[100vh] sm:max-h-[90vh] overflow-y-auto`}
      >
        {/* Close button */}
        {showCloseButton && (
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="absolute top-3 right-3 p-2 bg-white border border-gray-200 shadow-sm hover:bg-gray-100 rounded-full transition-colors z-20 cursor-pointer"
          >
            <X className="w-5 h-5 text-gray-700" />
          </button>
        )}

        {/* Content */}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
