"use client";

import { createPortal } from "react-dom";

/**
 * Espera corta del checkout: el logo de Samsung en negro sobre fondo blanco,
 * pintandose de izquierda a derecha en bucle.
 *
 * No reemplaza a LogoReloadAnimation (pantalla azul, 8 s, un solo pase): esa
 * acompana la compra y su texto "Ya casi es tuya". Esta es para esperas de uno
 * o dos segundos —abrir el modal de sesion, validar la clave—, donde una
 * pantalla azul de 8 segundos duraria mas que la espera misma.
 */

/**
 * OJO con el asset: una mascara SVG recorta por LUMINANCIA, asi que el logo
 * que haga de molde tiene que ser BLANCO sobre transparente. Con el SVG negro
 * del navbar la mascara saldria toda a cero y no se veria nada. Este es el
 * mismo PNG blanco que ya usa LogoReloadAnimation en produccion; el color
 * negro lo pone el relleno de abajo, no el asset.
 */
const LOGO_MOLDE =
  "https://res.cloudinary.com/dqsdl9bwv/image/upload/f_auto,q_auto:best/Dise%C3%B1o_sin_t%C3%ADtulo_-_2025-11-21T234250.302_ikybzx";

export default function SamsungLoader({
  etiqueta = "Cargando",
}: {
  /** Texto para lectores de pantalla; no se dibuja. */
  etiqueta?: string;
}) {
  // Al body, como el modal: dentro del arbol del checkout el navbar se quedaba
  // nitido por encima del velo.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[10120] flex items-center justify-center bg-white/25 backdrop-blur-[3px]">
      <svg
        viewBox="0 0 500 150"
        role="img"
        aria-label={etiqueta}
        className="w-[60%] max-w-[300px]"
      >
        <defs>
          <mask id="samsung-loader-mask">
            <image href={LOGO_MOLDE} x="0" y="0" width="500" height="150" />
          </mask>
          {/* Bordes suaves: sin el degradado se veria una banda recta cruzando
              las letras en vez de un relleno que avanza. */}
          <linearGradient id="samsung-loader-barrido" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#111111" stopOpacity="0" />
            <stop offset="0.45" stopColor="#111111" stopOpacity="1" />
            <stop offset="0.55" stopColor="#111111" stopOpacity="1" />
            <stop offset="1" stopColor="#111111" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Logo apagado: visible desde el primer fotograma, para que se lea
            Samsung y no aparezca de la nada. */}
        <rect
          x="0"
          y="0"
          width="500"
          height="150"
          fill="#111111"
          opacity="0.13"
          mask="url(#samsung-loader-mask)"
        />

        {/* El barrido que lo va pintando de negro, en bucle. */}
        <rect
          y="0"
          width="410"
          height="150"
          fill="url(#samsung-loader-barrido)"
          mask="url(#samsung-loader-mask)"
        >
          <animate
            attributeName="x"
            values="-410;500"
            dur="1.1s"
            repeatCount="indefinite"
          />
        </rect>
      </svg>
    </div>,
    document.body,
  );
}
