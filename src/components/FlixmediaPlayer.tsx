/**
 * FlixmediaPlayer Component
 *
 * Usa la API de Match de Flixmedia para verificar contenido ANTES de cargar.
 * Si no hay contenido, redirige inmediatamente sin esperar.
 */

"use client";

import { useEffect, memo, useCallback, useState, useRef } from "react";
import { parseSkuString, checkFlixmediaAvailability, checkFlixmediaAvailabilityByEan, hasPremiumContent as checkPremiumContent } from "@/lib/flixmedia";
import { useRouter } from "next/navigation";

declare global {
  interface Window {
    flixJsCallbacks?: {
      // Dual API: Flixmedia llama con (type) para notificar, o se registra con (fn, type)
      setLoadCallback: (typeOrFn: unknown, type?: string) => void;
      loadService: (type: string) => void;
      // pagedata-specific.js de Flixmedia lo invoca durante el render
      flixCartClick?: () => void;
    };
  }
}

interface FlixmediaPlayerProps {
  mpn?: string | null;
  ean?: string | null;
  productName?: string;
  className?: string;
  productId?: string;
  segmento?: string | string[];
  // Cuando es true, no redirige si no hay contenido (para uso embebido)
  preventRedirect?: boolean;
  // Cuando es true, salta Match API y carga loader.js directo (mas rapido, para pagina multimedia)
  skipMatchApi?: boolean;
  // Información del producto para verificar contenido premium
  apiProduct?: {
    imagenPremium?: string[][];
    videoPremium?: string[][];
    imagen_premium?: string[][];
    video_premium?: string[][];
  };
  productColors?: Array<{
    imagen_premium?: string[];
    video_premium?: string[];
  }>;
}

const DISTRIBUTOR_ID = "17257";
const LANGUAGE = "f5";


function FlixmediaPlayerComponent({
  mpn,
  ean,
  className = "",
  productId,
  segmento,
  preventRedirect = false,
  skipMatchApi = false,
  apiProduct,
  productColors
}: FlixmediaPlayerProps) {
  const router = useRouter();
  // Container ID ÚNICO por producto: evita que scripts de Flixmedia del producto anterior
  // (append.js, inpage.js con polling setTimeout) interfieran con el contenido nuevo.
  // Estos scripts buscan su container por ID y manipulan el DOM (resize, accordion, etc.).
  // Con un ID estático, los scripts viejos encuentran el container nuevo y lo corrompen.
  const containerId = `flix-inpage-${productId || 'default'}`;
  const [hasContent, setHasContent] = useState<boolean | null>(null);
  const [hasFlixError, setHasFlixError] = useState(false);
  // contentReady es INDEPENDIENTE de hasContent: en modo embebido/skipMatchApi
  // hasContent se pone true de inmediato (antes de que exista contenido visible),
  // así que el skeleton necesita su propia señal de "ya hay contenido real".
  // La alimentan: callback inpage, callback registrado, MutationObserver
  // (primer elemento real en el container) y la rama positiva del timeout de 4s.
  const [contentReady, setContentReady] = useState(false);
  const [skeletonGone, setSkeletonGone] = useState(false);

  // Crossfade de salida: al confirmar contenido, el skeleton se desvanece
  // (transition-opacity 300ms) y se desmonta después — nunca display:none en
  // seco, para enmascarar el swap de lazysizes sin flash de placeholders.
  useEffect(() => {
    if (!contentReady) return;
    const t = setTimeout(() => setSkeletonGone(true), 450);
    return () => clearTimeout(t);
  }, [contentReady]);

  // Refs para mantener valores actuales (evitar stale closures)
  // Router ref es CLAVE: useRouter() cambia de referencia en Next.js, lo que
  // causaba que redirectToView se recreara y el effect se re-ejecutara innecesariamente
  const routerRef = useRef(router);
  const segmentoRef = useRef(segmento);
  const productIdRef = useRef(productId);
  const apiProductRef = useRef(apiProduct);
  const productColorsRef = useRef(productColors);
  const preventRedirectRef = useRef(preventRedirect);
  const skipMatchApiRef = useRef(skipMatchApi);

  // Actualizar refs cuando cambien las props
  useEffect(() => {
    routerRef.current = router;
    segmentoRef.current = segmento;
    productIdRef.current = productId;
    apiProductRef.current = apiProduct;
    productColorsRef.current = productColors;
    preventRedirectRef.current = preventRedirect;
    skipMatchApiRef.current = skipMatchApi;
  }, [router, segmento, productId, apiProduct, productColors, preventRedirect, skipMatchApi]);

  const applyStyles = useCallback(() => {
    if (document.getElementById("flixmedia-player-styles")) return;
    const style = document.createElement("style");
    style.id = "flixmedia-player-styles";
    style.textContent = `
      [class*="flix_hotspot"], [id*="flix_hotspot"], div[class*="hotspot"] {
        display: none !important;
        visibility: hidden !important;
      }
      [id^="flix-inpage"] { width: 100%; min-height: 200px; }
      [id*="flix-inpage"] { width: 100%; min-height: 200px; }

      /* Ocultar errores de Flixmedia con fondo azul */
      [style*="background-color: rgb(23, 64, 122)"],
      [style*="background-color:#17407A"],
      [style*="background-color: #17407A"],
      [style*="background:#17407A"],
      [style*="background: #17407A"],
      div[style*="17407A"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        height: 0 !important;
        overflow: hidden !important;
      }
    `;
    document.head.appendChild(style);
  }, []);

  const hasPremiumContentCheck = useCallback((): boolean => {
    return checkPremiumContent(apiProductRef.current, productColorsRef.current);
  }, []);

  const redirectToView = useCallback(() => {
    if (preventRedirectRef.current) return;

    const currentSegmento = segmentoRef.current;
    const currentProductId = productIdRef.current;
    const isPremiumSegment = currentSegmento && (Array.isArray(currentSegmento) ? currentSegmento[0] : currentSegmento)?.toUpperCase() === 'PREMIUM';
    const hasPremium = hasPremiumContentCheck();

    const route = (isPremiumSegment || hasPremium)
      ? `/productos/viewpremium/${currentProductId}`
      : `/productos/view/${currentProductId}`;

    routerRef.current.replace(route);
  }, [hasPremiumContentCheck]);

  useEffect(() => {
    // Reset estado para nueva inicialización (evita stale state de producto anterior en SPA nav)
    setHasContent(null);
    setHasFlixError(false);
    setContentReady(false);
    setSkeletonGone(false);

    // Durante SPA navigation, mpn pasa brevemente por null mientras selectedProductData
    // se resetea y useProduct carga datos frescos. NO inicializar en este estado transitorio:
    // - Evita redirect accidental a view (init() llama redirectToView cuando no hay MPN)
    // - Evita limpiar globals de Flixmedia innecesariamente
    // El effect se re-ejecutará cuando mpn reciba el valor correcto del nuevo producto.
    if (!mpn && !ean) {
      console.log('[FLIX] Effect: mpn y ean son null → esperando datos del producto');
      return;
    }

    let isMounted = true;
    const abortController = new AbortController();
    let observer: MutationObserver | null = null;
    let initTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let cartClickGuardId: ReturnType<typeof setInterval> | null = null;

    // Limpiar scripts y callbacks de Flixmedia para inicialización limpia.
    // IMPORTANTE: Solo se llama al INICIO de una nueva inicialización (dentro del setTimeout),
    // NUNCA en el cleanup del effect (StrictMode cancelaría el timeout del mount 1).
    //
    // NO borrar FlixjQ/FlixjQ2/FlixServices: los scripts del producto anterior (append.js,
    // inpage.js) tienen polling con setTimeout recursivo que NO se puede cancelar. Si borramos
    // estos globals, cada ciclo de setTimeout produce "FlixjQ is not defined" y corrompe el
    // estado del nuevo loader.js. Dejándolos, los scripts viejos usan el FlixjQ existente
    // sin errores, y el nuevo loader.js lo sobrescribe con su versión fresca.
    const cleanupFlixmedia = () => {
      // Remover scripts y iframes de Flixmedia del DOM (detiene nuevas cargas pero no setTimeouts internos)
      document.querySelectorAll('script[data-flix-distributor]').forEach(s => s.remove());
      document.querySelectorAll('script[src*="flixfacts.com"], script[src*="flixcar.com"]').forEach(s => s.remove());
      document.querySelectorAll('iframe[src*="flixcar.com"], iframe[src*="flixfacts.com"]').forEach(el => el.remove());
      // Solo limpiar callbacks para evitar que scripts del producto anterior invoquen nuestros handlers
      delete window.flixJsCallbacks;
    };

    const initStartTime = performance.now();

    const init = async () => {
      let targetMpn: string | null = null;
      let targetEan: string | null = null;

      if (mpn) {
        const skus = parseSkuString(mpn);
        if (skus.length > 0) targetMpn = skus[0];
      }
      if (!targetMpn && ean) {
        const eans = parseSkuString(ean);
        if (eans.length > 0) targetEan = eans[0];
      }

      console.log('[FLIX] Init (+0ms) SKU:', { mpn, targetMpn, targetEan });

      if (!targetMpn && !targetEan) {
        if (!preventRedirectRef.current) {
          redirectToView();
        } else {
          setHasContent(false);
        }
        return;
      }

      // Precargar loader.js MIENTRAS se verifica Match API (en paralelo)
      const preloadLink = document.createElement('link');
      preloadLink.rel = 'preload';
      preloadLink.as = 'script';
      preloadLink.href = '//media.flixfacts.com/js/loader.js';
      document.head.appendChild(preloadLink);

      // Modo embebido (preventRedirect) o skipMatchApi: cargar loader.js directo sin Match API
      if (preventRedirectRef.current || skipMatchApiRef.current) {
        setHasContent(true);
      } else {
        // Verificar si hay contenido con la API de Match
        try {
          let matched = false;

          if (targetMpn) {
            console.log('[FLIX] Verificando Match API para:', targetMpn);

            const checks: Promise<{ available: boolean }>[] = [
              checkFlixmediaAvailability(targetMpn, undefined, undefined, abortController.signal)
            ];
            if (targetMpn.includes('/')) {
              const baseMpn = targetMpn.split('/')[0];
              checks.push(checkFlixmediaAvailability(baseMpn, undefined, undefined, abortController.signal));
            }

            const results = await Promise.all(checks);
            if (!isMounted) return;

            if (results.some(r => r.available)) {
              matched = true;
              setHasContent(true);
            }
          } else if (targetEan) {
            const result = await checkFlixmediaAvailabilityByEan(
              targetEan, undefined, undefined, abortController.signal
            );
            if (!isMounted) return;

            if (result.available) {
              matched = true;
              setHasContent(true);
            }
          }

          if (!matched) {
            // No confiar en el negativo del Match API: algunos MPNs (ej: con '/')
            // no son reconocidos por Match API pero sí por loader.js/service.js.
            // Seguir con loader.js como verificación definitiva.
            // El callback NOSHOW o el timeout de 4s manejarán el redirect si realmente no hay contenido.
            console.log('[FLIX] Match API: sin match → verificando con loader.js');
          }
        } catch (error) {
          if (abortController.signal.aborted || !isMounted) return;
          console.log('[FLIX] Error de red en Match API → fallback con loader.js', error);
          // noshow callback manejará la detección de "sin contenido"
        }
      }

      // Limpiar estado de Flixmedia antes de cargar nuevo contenido
      cleanupFlixmedia();
      if (!isMounted) return;

      const container = document.getElementById(containerId);
      if (!container) return;
      container.innerHTML = '';

      // Configurar callbacks de Flixmedia ANTES de cargar el script
      // Según la guía de integración, Flixmedia llama setLoadCallback(type) para notificar:
      // - 'inpage': contenido cargado exitosamente
      // - 'noshow': no hay contenido disponible (reemplaza el timeout de 2s)
      // También soporta setLoadCallback(fn, type) como API de registro
      window.flixJsCallbacks = {
        setLoadCallback: (typeOrFn: unknown, type?: string) => {
          const callbackType = typeof typeOrFn === 'string' ? typeOrFn : type;
          const fn = typeof typeOrFn === 'function' ? typeOrFn : null;

          if (callbackType === 'inpage') {
            console.log(`[FLIX] Callback INPAGE: contenido listo (+${Math.round(performance.now() - initStartTime)}ms)`);
            applyStyles();
            if (isMounted) {
              setHasContent(true);
              setContentReady(true);
            }
          } else if (callbackType === 'noshow') {
            console.log(`[FLIX] Callback NOSHOW: sin contenido (+${Math.round(performance.now() - initStartTime)}ms)`);
            if (!isMounted) return;
            observer?.disconnect();
            setHasContent(false);
            setHasFlixError(true);
            if (!preventRedirectRef.current) redirectToView();
          }

          if (fn) fn();
        },
        loadService: () => {}
      };

      // Callback del botón de carrito de Flixmedia. Su pagedata-specific.js
      // invoca window.flixJsCallbacks.flixCartClick() durante el render; si para
      // entonces Flixmedia ya reemplazó nuestro objeto de callbacks con el suyo
      // (lo hace al cargar loader.js), la función se pierde y su domTest lanza
      // "flixCartClick is not a function", abortando el render → contenido en
      // blanco INTERMITENTE (depende del timing/carga del hilo principal).
      // ensureFlixCartClick la reasigna sobre el objeto vigente; el guard corto
      // de abajo cubre la ventana de la carrera pase lo que pase.
      const flixCartClickHandler = () => {
        const currentSegmento = segmentoRef.current;
        const currentProductId = productIdRef.current;
        const isPremiumSegment = currentSegmento && (Array.isArray(currentSegmento) ? currentSegmento[0] : currentSegmento)?.toUpperCase() === 'PREMIUM';
        const hasPremium = hasPremiumContentCheck();
        const route = (isPremiumSegment || hasPremium)
          ? `/productos/viewpremium/${currentProductId}`
          : `/productos/view/${currentProductId}`;
        routerRef.current.push(route);
      };
      const ensureFlixCartClick = () => {
        const cb = window.flixJsCallbacks;
        if (cb && typeof cb.flixCartClick !== 'function') {
          cb.flixCartClick = flixCartClickHandler;
        }
      };
      ensureFlixCartClick();

      // Verificar si hay error de Flixmedia (fondo azul, texto de error)
      const checkForFlixError = () => {
        const cont = document.getElementById(containerId);
        if (!cont) return false;
        const text = cont.textContent?.toLowerCase() || '';
        const hasErrorText = text.includes('producto no encontrado') ||
                            text.includes('no se pudo cargar') ||
                            text.includes('product not found') ||
                            text.includes('no content available');
        const hasBlueBackground = cont.innerHTML.includes('17407A') ||
                                 cont.innerHTML.includes('rgb(23, 64, 122)');
        return hasErrorText || hasBlueBackground;
      };

      // Verificar si loader.js renderizó contenido multimedia real
      const hasRealContent = (cont: HTMLElement): boolean => {
        if (cont.children.length === 0) return false;
        return cont.querySelector('iframe') !== null ||
               cont.querySelectorAll('img').length > 1 ||
               cont.querySelector('video') !== null ||
               cont.querySelector('[class*="flix-"]') !== null;
      };

      // MutationObserver: detección de errores visuales (fondo azul) + primera
      // aparición de contenido real (dispara el crossfade del skeleton)
      observer = new MutationObserver(() => {
        if (!isMounted) { observer?.disconnect(); return; }
        const cont = document.getElementById(containerId);
        if (cont && hasRealContent(cont)) {
          setContentReady(true);
        }
        if (checkForFlixError()) {
          console.log('[FLIX] Error visual de Flixmedia detectado → redirigiendo');
          observer?.disconnect();
          setHasFlixError(true);
          if (!preventRedirectRef.current) redirectToView();
        }
      });
      observer.observe(container, { childList: true, subtree: true, attributes: true });

      // Cargar loader.js
      console.log(`[FLIX] Cargando loader.js MPN: ${targetMpn} (+${Math.round(performance.now() - initStartTime)}ms)`);
      const script = document.createElement("script");
      script.type = "text/javascript";
      script.async = true;
      script.setAttribute("data-flix-distributor", DISTRIBUTOR_ID);
      script.setAttribute("data-flix-language", LANGUAGE);
      script.setAttribute("data-flix-brand", "Samsung");
      script.setAttribute("data-flix-mpn", targetMpn || "");
      script.setAttribute("data-flix-ean", targetEan || "");
      script.setAttribute("data-flix-sku", "");
      script.setAttribute("data-flix-inpage", containerId);
      script.setAttribute("data-flix-button", "");
      script.setAttribute("data-flix-button-image", "");
      script.setAttribute("data-flix-price", "");
      script.setAttribute("data-flix-fallback-language", "");
      script.onload = () => {
        console.log(`[FLIX] loader.js listo (+${Math.round(performance.now() - initStartTime)}ms)`);
        applyStyles();

        // También intentar registrar callbacks con la API de Flixmedia (por si usa registro)
        // Esto es un safety net: si Flixmedia reemplazó flixJsCallbacks con su propia impl
        try {
          if (window.flixJsCallbacks && typeof window.flixJsCallbacks.setLoadCallback === 'function') {
            window.flixJsCallbacks.setLoadCallback(() => {
              console.log(`[FLIX] Registered INPAGE callback fired (+${Math.round(performance.now() - initStartTime)}ms)`);
              applyStyles();
              if (isMounted) {
                setHasContent(true);
                setContentReady(true);
              }
            }, 'inpage');
            window.flixJsCallbacks.setLoadCallback(() => {
              console.log(`[FLIX] Registered NOSHOW callback fired (+${Math.round(performance.now() - initStartTime)}ms)`);
              if (!isMounted) return;
              observer?.disconnect();
              setHasContent(false);
              setHasFlixError(true);
              if (!preventRedirectRef.current) redirectToView();
            }, 'noshow');
          }
        } catch { /* flixJsCallbacks may have been replaced */ }
        // Flixmedia ya cargó y pudo reemplazar el objeto de callbacks: reasignar
        // flixCartClick sobre el objeto vigente antes de que corra pagedata-specific.js
        ensureFlixCartClick();
      };
      script.onerror = () => {
        console.log('[FLIX] Error cargando loader.js → redirigiendo');
        if (!isMounted) return;
        setHasContent(false);
        if (!preventRedirectRef.current) redirectToView();
      };
      script.src = "//media.flixfacts.com/js/loader.js";
      document.head.appendChild(script);

      // Guard de la carrera: durante la carga de Flixmedia, garantizar que
      // flixCartClick siempre exista sobre el objeto de callbacks vigente, sin
      // importar cuándo Flixmedia lo reemplace. Cubre la ventana en que corre
      // su domTest (~primeros segundos). Se detiene solo a los 6s y en cleanup.
      cartClickGuardId = setInterval(ensureFlixCartClick, 120);
      setTimeout(() => {
        if (cartClickGuardId) { clearInterval(cartClickGuardId); cartClickGuardId = null; }
      }, 6000);

      // Verificación a los 4s: si loader.js cargó pero no renderizó contenido real → redirigir
      // Esto cubre el caso donde ni inpage ni noshow callbacks se disparan
      setTimeout(() => {
        if (!isMounted) return;
        const cont = document.getElementById(containerId);
        if (!cont) return;

        if (checkForFlixError() || !hasRealContent(cont)) {
          console.log('[FLIX] Sin contenido real después de 4s → redirigiendo', {
            children: cont.children.length,
            innerHTML_length: cont.innerHTML.length,
            hasIframe: !!cont.querySelector('iframe'),
            hasImages: cont.querySelectorAll('img').length,
          });
          observer?.disconnect();
          setHasContent(false);
          setHasFlixError(true);
          if (!preventRedirectRef.current) redirectToView();
        } else {
          // Sí hay contenido real: asegurar que el skeleton se retire aunque
          // ningún callback ni mutación lo haya marcado (red de seguridad)
          setContentReady(true);
        }
      }, 4000);
    };

    // Siempre limpiar y re-inicializar. No intentar "reutilizar" contenido existente:
    // - Los scripts de Flixmedia inyectan wrappers vacíos que pasan selectores DOM pero no tienen contenido visible
    // - Al navegar de vuelta al mismo producto, el container tiene elementos rotos de scripts viejos
    // - StrictMode solo corre en dev: el flash es cosmético, el bug de contenido roto es funcional
    // El setTimeout(0) sigue siendo necesario: en StrictMode, mount 1 encola el timeout,
    // cleanup lo cancela, mount 2 encola uno nuevo que sí ejecuta. Solo se ejecuta UNA init().
    initTimeoutId = setTimeout(() => {
      cleanupFlixmedia();
      init();
    }, 0);

    return () => {
      isMounted = false;
      if (initTimeoutId) clearTimeout(initTimeoutId);
      if (cartClickGuardId) clearInterval(cartClickGuardId);
      abortController.abort();
      observer?.disconnect();
    };
  // Re-ejecutar cuando mpn o productId cambian.
  // NO incluir ean: cuando la API carga, ean pasa de null a un valor real para el MISMO producto,
  // lo que dispararía una segunda init que destruye el contenido ya cargado.
  // productId cubre cambios de producto. mpn cubre cambios de SKU dentro del mismo producto.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mpn, productId]);

  // Sin contenido: no renderizar nada (ni mensaje)
  if (!mpn && !ean) return null;
  if (hasContent === false || hasFlixError) return null;

  // Renderizar container - visible cuando hay contenido o aún cargando (null).
  // El skeleton va como OVERLAY absoluto sobre el container SIEMPRE montado:
  // el container es el target data-flix-inpage y desmontarlo/condicionarlo
  // rompe los scripts de Flixmedia que lo buscan por id.
  return (
    <div className={`${className} w-full min-h-[200px] relative`}>
      <div
        id={containerId}
        className="w-full"
      />
      {!skeletonGone && (
        <div
          aria-hidden="true"
          className={`absolute inset-0 z-[1] overflow-hidden pointer-events-none bg-white transition-opacity duration-300 ${contentReady ? "opacity-0" : "opacity-100"}`}
        >
          <div className="h-full w-full animate-pulse px-4 py-8">
            <div className="mx-auto max-w-5xl space-y-4">
              <div className="mx-auto h-7 w-2/3 rounded-lg bg-gray-200" />
              <div className="mx-auto h-4 w-1/2 rounded bg-gray-100" />
              <div className="mt-6 h-56 w-full rounded-2xl bg-gray-100" />
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="h-20 rounded-xl bg-gray-100" />
                <div className="h-20 rounded-xl bg-gray-100" />
                <div className="h-20 rounded-xl bg-gray-100" />
                <div className="h-20 rounded-xl bg-gray-100" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const FlixmediaPlayer = memo(FlixmediaPlayerComponent, (prevProps, nextProps) => {
  // Solo comparar mpn y productId (los deps del effect) + flags de comportamiento.
  // NO incluir ean: cambia de null→valor cuando la API carga, pero es el mismo producto.
  // Incluirlo causa re-render innecesario que puede interferir con Flixmedia.
  return prevProps.mpn === nextProps.mpn &&
         prevProps.productId === nextProps.productId &&
         prevProps.preventRedirect === nextProps.preventRedirect &&
         prevProps.skipMatchApi === nextProps.skipMatchApi;
});

FlixmediaPlayer.displayName = "FlixmediaPlayer";
export default FlixmediaPlayer;
