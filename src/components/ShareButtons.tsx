"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface ShareButtonsProps {
  className?: string;
  // Nombre de la variante que el usuario está viendo (p.ej. 'Televisor Smart 65" ...').
  // Sin esto se usaba document.title, que el servidor genera con la variante base
  // y NO refleja la talla/color elegidos.
  title?: string;
  // SKU de la variante mostrada: viaja en el enlace (`?sku=`) para que quien lo
  // abra vea la misma variante (la selección local vive solo en localStorage).
  sku?: string | null;
}

export default function ShareButtons({ className = "", title, sku }: ShareButtonsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ top: number; right: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Calcular posición del popover justo debajo del botón
  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPopoverPos({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
  }, [isOpen]);

  // Cerrar al hacer click afuera
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  const getShareUrl = useCallback(() => {
    if (typeof window === "undefined") return "";
    try {
      const url = new URL(window.location.href);
      if (sku) url.searchParams.set("sku", sku);
      return url.toString();
    } catch {
      return window.location.href;
    }
  }, [sku]);

  const getShareTitle = useCallback(() => {
    const variantTitle = (title || "").trim();
    if (variantTitle) return `${variantTitle} | Samsung Store`;
    if (typeof document === "undefined") return "";
    return document.title;
  }, [title]);

  const handleShare = useCallback((platform: string) => {
    const url = getShareUrl();
    const text = encodeURIComponent(`${getShareTitle()} ${url}`);
    const encodedUrl = encodeURIComponent(url);

    const urls: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${text}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      x: `https://x.com/intent/tweet?url=${encodedUrl}&text=${encodeURIComponent(getShareTitle())}`,
      instagram: `https://www.instagram.com/`,
      tiktok: `https://www.tiktok.com/`,
    };

    window.open(urls[platform], "_blank", "noopener,noreferrer");
    setIsOpen(false);
  }, [getShareUrl, getShareTitle]);

  const handleCopyLink = useCallback(async () => {
    const url = getShareUrl();
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setIsOpen(false);
    }, 1200);
  }, [getShareUrl]);

  const shareOptions = [
    {
      id: "whatsapp",
      label: "Compartir en WhatsApp",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" fill="#25D366"/>
          <path d="M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.893c-.001 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.579 0 11.94-5.335 11.943-11.893.002-3.178-1.238-6.165-3.473-8.452zM12.045 21.785h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.981.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885z" fill="#25D366"/>
        </svg>
      ),
    },
    {
      id: "facebook",
      label: "Compartir en Facebook",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M24 12c0-6.627-5.373-12-12-12S0 5.373 0 12c0 5.99 4.388 10.954 10.125 11.854V15.47H7.078V12h3.047V9.356c0-3.007 1.792-4.668 4.533-4.668 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874V12h3.328l-.532 3.47h-2.796v8.385C19.612 22.954 24 17.99 24 12z" fill="#1877F2"/>
          <path d="M16.671 15.47L17.203 12h-3.328V9.75c0-.949.465-1.874 1.956-1.874h1.513V4.923s-1.374-.235-2.686-.235c-2.741 0-4.533 1.66-4.533 4.668V12H7.078v3.47h3.047v8.385a12.09 12.09 0 003.75 0V15.47h2.796z" fill="white"/>
        </svg>
      ),
    },
    {
      id: "x",
      label: "Compartir en X",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" fill="#000"/>
        </svg>
      ),
    },
    {
      id: "instagram",
      label: "Compartir en Instagram",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <defs>
            <radialGradient id="ig-grad" cx="30%" cy="107%" r="150%">
              <stop offset="0%" stopColor="#fdf497"/>
              <stop offset="5%" stopColor="#fdf497"/>
              <stop offset="45%" stopColor="#fd5949"/>
              <stop offset="60%" stopColor="#d6249f"/>
              <stop offset="90%" stopColor="#285AEB"/>
            </radialGradient>
          </defs>
          <rect x="2" y="2" width="20" height="20" rx="5" fill="url(#ig-grad)"/>
          <circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="1.5" fill="none"/>
          <circle cx="17.5" cy="6.5" r="1.2" fill="white"/>
        </svg>
      ),
    },
    {
      id: "tiktok",
      label: "Compartir en TikTok",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.8a8.18 8.18 0 004.77 1.53V6.88a4.85 4.85 0 01-1-.19z" fill="#000"/>
        </svg>
      ),
    },
  ];

  return (
    <div className={className}>
      {/* Botón principal de compartir */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen((prev) => !prev)}
        className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors duration-200"
        aria-label="Compartir"
        title="Compartir"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" fill="#333"/>
        </svg>
      </button>

      {/* Popover via portal - se renderiza directamente en el body */}
      {isOpen && popoverPos && typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              ref={popoverRef}
              className="bg-white rounded-2xl shadow-xl border border-gray-100 py-3 min-w-[240px]"
              style={{
                position: "fixed",
                top: popoverPos.top,
                right: popoverPos.right,
                zIndex: 99999,
                animation: "sharePopoverIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              {/* Titulo */}
              <div className="px-4 pb-2 mb-1 border-b border-gray-100">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide" style={{ fontFamily: "SamsungSharpSans" }}>
                  Compartir con
                </span>
              </div>

              {/* Redes sociales */}
              {shareOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleShare(option.id)}
                  className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-gray-50 active:bg-gray-100 transition-colors duration-150 text-left"
                >
                  <span className="flex-shrink-0">{option.icon}</span>
                  <span className="text-sm font-medium text-gray-800" style={{ fontFamily: "SamsungSharpSans" }}>
                    {option.label}
                  </span>
                </button>
              ))}

              {/* Separador */}
              <div className="border-t border-gray-100 my-1.5" />

              {/* Copiar enlace */}
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-gray-50 active:bg-gray-100 transition-colors duration-150 text-left"
              >
                <span className="flex-shrink-0">
                  {copied ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="#25D366"/>
                    </svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" fill="#333"/>
                    </svg>
                  )}
                </span>
                <span className="text-sm font-medium text-gray-800" style={{ fontFamily: "SamsungSharpSans" }}>
                  {copied ? "Enlace copiado" : "Copiar enlace"}
                </span>
              </button>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
              @keyframes sharePopoverIn {
                from { opacity: 0; transform: translateY(-8px) scale(0.95); }
                to { opacity: 1; transform: translateY(0) scale(1); }
              }
            `}} />
          </>,
          document.body
        )
      }
    </div>
  );
}
