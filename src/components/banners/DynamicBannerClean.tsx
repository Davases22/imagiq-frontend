"use client";

/**
 * Banner Dinámico con Carrusel
 *
 * Componente reutilizable para mostrar banners del API con soporte para:
 * - Carrusel automático de múltiples banners
 * - Videos y/o imágenes (desktop y mobile)
 * - Animaciones fade + slide suaves
 * - Posicionamiento dinámico de contenido
 * - Indicadores de navegación
 */

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useDynamicBanner } from "@/hooks/useDynamicBanner";
import { useCarouselController } from "@/hooks/useCarouselController";
import { parsePosition, parseTextStyles } from "@/utils/bannerCoordinates";
import type { Banner, BannerPosition, BannerTextStyles, ContentBlock } from "@/types/banner";
import { getCloudinaryUrl, isBannerVideo } from "@/lib/cloudinary";

type CSS = React.CSSProperties;

/**
 * Props del componente principal
 */
interface DynamicBannerProps {
  placement?: string;
  className?: string;
  showOverlay?: boolean;
  children?: React.ReactNode;
  displayDuration?: number;
  trackPlayedVideos?: boolean;
  mockBanner?: Banner | null; // Datos mock para pruebas sin API
  isMobile?: boolean; // Forzar vista mobile para testing
}

/**
 * Props del contenido del banner
 */
interface BannerContentProps {
  title: string | null;
  description: string | null;
  cta: string | null;
  color: string;
  positionStyle?: CSS;
  isMobile?: boolean;
  textStyles?: BannerTextStyles | null;
  videoEnded: boolean;
  linkUrl: string | null;
  isWrappedInLink?: boolean; // Nueva prop para evitar Links anidados
}

/**
 * Convierte una BannerPosition parseada a estilos CSS porcentuales simples
 */
const positionToPercentCSS = (position: BannerPosition | null): CSS => {
  if (!position) {
    return { left: "50%", top: "50%" };
  }
  return { left: `${position.x}%`, top: `${position.y}%` };
};

/**
 * Carga una imagen de forma asíncrona
 */
async function loadImage(src?: string): Promise<HTMLImageElement | null> {
  if (!src) return null;
  const img = new Image();
  return new Promise<HTMLImageElement | null>((res) => {
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

/**
 * Skeleton de carga
 */
function BannerSkeleton() {
  return (
    <div className="relative w-full min-h-[400px] bg-gray-200 animate-pulse">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-gray-400">Cargando banner...</div>
      </div>
    </div>
  );
}

/**
 * Contenido del banner (título, descripción, CTA)
 * Con animación de reveal cuando el video termina (igual que HeroSection)
 */
function BannerContent({
  title,
  description,
  cta,
  color,
  positionStyle,
  isMobile,
  textStyles,
  videoEnded,
  linkUrl,
  isWrappedInLink,
}: Readonly<BannerContentProps>) {
  const final: CSS = {
    color,
    transform: "translate(-50%, -50%)",
    opacity: videoEnded ? 1 : 0,
    transition: "all 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.3s",
    pointerEvents: videoEnded ? "auto" : "none",
  };
  if (positionStyle) Object.assign(final, positionStyle);
  if (isMobile && !positionStyle?.left) final.left = "50%";

  const content = (
    <div
      className={`absolute max-w-2xl px-6 ${isMobile
        ? "md:hidden flex flex-col items-center text-center"
        : "hidden md:block"
        }`}
      style={final}
    >
      {title && (
        <h2
          className="text-3xl md:text-5xl lg:text-6xl font-bold mb-3 md:mb-4"
          style={textStyles?.title || {}}
        >
          {title}
        </h2>
      )}
      {description && (
        <p
          className="text-base md:text-xl lg:text-2xl mb-4 md:mb-6"
          style={textStyles?.description || {}}
        >
          {description}
        </p>
      )}
      {cta &&
        (isWrappedInLink ? (
          // Si el banner completo es un Link, renderizar el CTA como span para evitar anidamiento
          <span
            className="inline-block px-6 py-2.5 rounded-full font-semibold text-sm md:text-base transition-all duration-300"
            style={{
              borderWidth: "2px",
              borderColor: color,
              backgroundColor: "transparent",
              ...(textStyles?.cta || {}),
            }}
          >
            {cta}
          </span>
        ) : linkUrl ? (
          // Si el banner NO es clickeable pero el CTA tiene URL, renderizar como Link
          <Link
            href={linkUrl}
            className="inline-block px-6 py-2.5 rounded-full font-semibold text-sm md:text-base transition-all duration-300 hover:scale-105"
            style={{
              borderWidth: "2px",
              borderColor: color,
              backgroundColor: "transparent",
              ...(textStyles?.cta || {}),
            }}
          >
            {cta}
          </Link>
        ) : (
          // Si no hay URL, renderizar como span
          <span
            className="inline-block px-6 py-2.5 rounded-full font-semibold text-sm md:text-base"
            style={{
              borderWidth: "2px",
              borderColor: color,
              backgroundColor: "transparent",
              ...(textStyles?.cta || {}),
            }}
          >
            {cta}
          </span>
        ))}
    </div>
  );

  return content;
}

/**
 * Componente para renderizar bloques de contenido
 */
function ContentBlocksOverlay({
  blocks,
  isMobile,
  forceShow,
  bannerLinkUrl,
}: Readonly<{
  blocks: ContentBlock[];
  isMobile?: boolean;
  forceShow?: boolean; // Forzar mostrar sin clases responsive
  bannerLinkUrl?: string | null; // URL del banner como fallback para CTAs
}>) {
  return (
    <>
      {blocks.map((block) => {
        const position = isMobile ? block.position_mobile : block.position_desktop;

        // Configuración del contenedor: usar mobile si existe, sino desktop
        const textAlign = isMobile && block.textAlign_mobile
          ? block.textAlign_mobile
          : block.textAlign || 'center';
        const gap = isMobile && block.gap_mobile
          ? block.gap_mobile
          : block.gap || '12px';

        // Si forceShow está activo, no usar clases responsive
        const visibilityClass = forceShow
          ? 'absolute z-10'
          : `absolute z-10 ${isMobile ? 'md:hidden' : 'hidden md:block'}`;

        // Ajustar transform basado en textAlign (el dashboard guarda según la justificación)
        let transformX = '-50%'; // Por defecto: centrado
        if (textAlign === 'left') {
          transformX = '0%'; // Izquierda: el punto está en el borde izquierdo
        } else if (textAlign === 'right') {
          transformX = '-100%'; // Derecha: el punto está en el borde derecho
        }

        // Estilos del título: usar mobile si existe, sino desktop
        const rawTitleFontSize =
          (isMobile && block.title_mobile?.fontSize) || block.title?.fontSize || '2rem';
        // En mobile: capa el fontSize contra un valor relativo al viewport
        // para que títulos largos (ej. "Galaxy S26 Ultra | Buds4 Pro") se
        // auto-reduzcan en vez de salirse por los costados. `min()` toma
        // el menor entre lo que configuró el admin y `6.5vw`, así en
        // desktop/tablets anchas queda tal cual y sólo encoge cuando el
        // viewport es demasiado angosto para el valor admin.
        const titleFontSize = isMobile
          ? `min(${rawTitleFontSize}, 6.5vw)`
          : rawTitleFontSize;
        const titleStyles = block.title && {
          fontSize: titleFontSize,
          fontWeight: (isMobile && block.title_mobile?.fontWeight) || block.title.fontWeight || '700',
          color: (isMobile && block.title_mobile?.color) || block.title.color || '#ffffff',
          lineHeight: (isMobile && block.title_mobile?.lineHeight) || block.title.lineHeight || '1.2',
          textTransform: (isMobile && block.title_mobile?.textTransform) || block.title.textTransform || 'none',
          letterSpacing: (isMobile && block.title_mobile?.letterSpacing) || block.title.letterSpacing || 'normal',
          textShadow: (isMobile && block.title_mobile?.textShadow) || block.title.textShadow || '2px 2px 4px rgba(0,0,0,0.5)',
        };

        return (
          <div
            key={block.id}
            className={visibilityClass}
            style={{
              left: `${position.x}%`,
              top: `${position.y}%`,
              transform: `translate(${transformX}, -50%)`,
              // Cap: el bloque no puede crecer más ancho que el viewport.
              // Combinado con el `min()` del fontSize del título y
              // `whiteSpace: 'pre'` del `<h2>`, garantiza que el título
              // mantenga SU estructura (una sola línea, o las líneas
              // explícitas que el admin puso con \n) pero se auto-reduzca
              // en celulares angostos en vez de salirse y ser clippeado
              // por el `overflow-hidden` del banner.
              maxWidth: isMobile ? 'calc(100vw - 32px)' : '90%',
            }}
          >
            <div
              className="flex flex-col"
              style={{ gap }}
            >
              {/* Título */}
              {block.title && (
                <h2
                  style={{
                    ...titleStyles,
                    margin: 0,
                    // `pre` (no `pre-line`) para preservar \n explícitos del
                    // admin pero SIN wrap automático — así la estructura
                    // visual del diseño se mantiene; cuando no cabe, el
                    // fontSize encoge vía `min(adminValue, 6.5vw)`.
                    whiteSpace: 'pre',
                    textAlign,
                  }}
                >
                  {block.title.text}
                </h2>
              )}

              {/* Subtítulo */}
              {block.subtitle && (() => {
                const subtitleStyles = {
                  fontSize: (isMobile && block.subtitle_mobile?.fontSize) || block.subtitle.fontSize || '1.5rem',
                  fontWeight: (isMobile && block.subtitle_mobile?.fontWeight) || block.subtitle.fontWeight || '600',
                  color: (isMobile && block.subtitle_mobile?.color) || block.subtitle.color || '#ffffff',
                  lineHeight: (isMobile && block.subtitle_mobile?.lineHeight) || block.subtitle.lineHeight || '1.3',
                  textTransform: (isMobile && block.subtitle_mobile?.textTransform) || block.subtitle.textTransform || 'none',
                };
                return (
                  <h3
                    style={{
                      ...subtitleStyles,
                      margin: 0,
                      whiteSpace: 'pre-line',
                      textAlign,
                    }}
                  >
                    {block.subtitle.text}
                  </h3>
                );
              })()}

              {/* Descripción */}
              {block.description && (() => {
                const descriptionStyles = {
                  fontSize: (isMobile && block.description_mobile?.fontSize) || block.description.fontSize || '1rem',
                  fontWeight: (isMobile && block.description_mobile?.fontWeight) || block.description.fontWeight || '400',
                  color: (isMobile && block.description_mobile?.color) || block.description.color || '#ffffff',
                  lineHeight: (isMobile && block.description_mobile?.lineHeight) || block.description.lineHeight || '1.5',
                  textTransform: (isMobile && block.description_mobile?.textTransform) || block.description.textTransform || 'none',
                };
                return (
                  <p
                    style={{
                      ...descriptionStyles,
                      margin: 0,
                      whiteSpace: 'pre-line',
                      textAlign,
                    }}
                  >
                    {block.description.text}
                  </p>
                );
              })()}

              {/* CTA */}
              {block.cta && (() => {
                const ctaStyles = {
                  fontSize: (isMobile && block.cta_mobile?.fontSize) || block.cta.fontSize || '1rem',
                  fontWeight: (isMobile && block.cta_mobile?.fontWeight) || block.cta.fontWeight || '600',
                  backgroundColor: (isMobile && block.cta_mobile?.backgroundColor) || block.cta.backgroundColor || '#ffffff',
                  color: (isMobile && block.cta_mobile?.color) || block.cta.color || '#000000',
                  padding: (isMobile && block.cta_mobile?.padding) || block.cta.padding || '12px 24px',
                  borderRadius: (isMobile && block.cta_mobile?.borderRadius) || block.cta.borderRadius || '8px',
                  border: (isMobile && block.cta_mobile?.border) || block.cta.border || 'none',
                  textTransform: (isMobile && block.cta_mobile?.textTransform) || block.cta.textTransform || 'none',
                };
                // Usar la URL específica del CTA
                const href = block.cta.link_url || '#';

                return (
                  <div style={{ textAlign }}>
                    <a
                      href={href}
                      className="stretched-link inline-block transition-all duration-300 hover:scale-105 hover:shadow-lg"
                      style={{
                        ...ctaStyles,
                        textDecoration: 'none',
                        textAlign: 'center',
                        whiteSpace: 'pre-line',
                      }}
                    >
                      {block.cta.text}
                    </a>
                  </div>
                );
              })()}
            </div>
          </div>
        );
      })}
    </>
  );
}

/**
 * Componente principal de banner dinámico con carrusel
 */
export default function DynamicBannerClean({
  placement,
  className = "",
  showOverlay = false,
  children,
  displayDuration = 5000,
  trackPlayedVideos = false,
  mockBanner,
  isMobile: forceMobileView,
}: Readonly<DynamicBannerProps>) {
  // Si hay mockBanner, usarlo en lugar del API
  const { banners: apiBanners, loading } = useDynamicBanner(placement || '');
  const banners = React.useMemo(() =>
    mockBanner ? [mockBanner] : apiBanners,
    [mockBanner, apiBanners]
  );

  const controller = useCarouselController({
    itemsCount: banners.length,
    displayDuration,
    trackPlayedVideos,
  });

  const desktopRef = useRef<HTMLDivElement | null>(null);
  const mobileRef = useRef<HTMLDivElement | null>(null);
  const [deskStyle, setDeskStyle] = useState<CSS | undefined>();
  const [mobStyle, setMobStyle] = useState<CSS | undefined>();

  /**
   * Calcula la posición exacta del contenido basado en el media actual
   */
  const compute = async (
    position: BannerPosition | null,
    wrapper?: HTMLDivElement | null,
    mediaSrc?: string
  ): Promise<CSS | undefined> => {
    if (!wrapper || !position) return undefined;
    const wrapRect = wrapper.getBoundingClientRect();
    const lPct = position.x;
    const tPct = position.y;

    // Intentar con video primero
    const video = wrapper.querySelector("video");
    if (video instanceof HTMLVideoElement) {
      const r = video.getBoundingClientRect();
      return {
        left: `${r.left - wrapRect.left + (lPct / 100) * r.width}px`,
        top: `${r.top - wrapRect.top + (tPct / 100) * r.height}px`,
      };
    }

    // Intentar con imagen existente
    const imgEl = wrapper.querySelector("img");
    if (
      imgEl instanceof HTMLImageElement &&
      imgEl.naturalWidth &&
      imgEl.naturalHeight
    ) {
      const r = imgEl.getBoundingClientRect();
      return {
        left: `${r.left - wrapRect.left + (lPct / 100) * r.width}px`,
        top: `${r.top - wrapRect.top + (tPct / 100) * r.height}px`,
      };
    }

    // Calcular basado en dimensiones de la imagen cargada
    if (mediaSrc) {
      const loaded = await loadImage(mediaSrc);
      if (loaded?.naturalWidth && loaded?.naturalHeight) {
        const cW = wrapRect.width;
        const cH = wrapRect.height;
        const iA = loaded.naturalWidth / loaded.naturalHeight;
        const cA = cW / cH;
        const displayW = iA > cA ? cW : cH * iA;
        const displayH = iA > cA ? cW / iA : cH;
        const offL = (cW - displayW) / 2;
        const offT = (cH - displayH) / 2;
        return {
          left: `${offL + (lPct / 100) * displayW}px`,
          top: `${offT + (tPct / 100) * displayH}px`,
        };
      }
    }

    // Fallback a porcentajes
    return { left: `${lPct}%`, top: `${tPct}%` };
  };

  /**
   * Efecto para calcular posiciones del banner actual
   */
  useEffect(() => {
    let mounted = true;
    const currentBanner = banners[controller.currentIndex];

    const run = async () => {
      if (!currentBanner) return;

      const desktopPosition = parsePosition(currentBanner.position_desktop);
      const mobilePosition = parsePosition(currentBanner.position_mobile);

      const d = await compute(
        desktopPosition,
        desktopRef.current,
        (currentBanner.desktop_video_url || currentBanner.desktop_image_url) ??
        undefined
      );
      const m = await compute(
        mobilePosition,
        mobileRef.current,
        (currentBanner.mobile_video_url || currentBanner.mobile_image_url) ??
        undefined
      );

      if (!mounted) return;
      setDeskStyle(d);
      setMobStyle(m);
    };

    run();
    const onRes = () => run();
    window.addEventListener("resize", onRes);
    return () => {
      mounted = false;
      window.removeEventListener("resize", onRes);
    };
  }, [banners, controller.currentIndex]);

  /**
   * Efecto para manejar timers de banners sin video
   */
  useEffect(() => {
    if (banners.length <= 1) return;

    const currentBanner = banners[controller.currentIndex];
    const hasVideo = Boolean(
      currentBanner?.desktop_video_url || currentBanner?.mobile_video_url
    );

    // Si no tiene video, avanzar automáticamente después del displayDuration
    if (!hasVideo) {
      const timer = setTimeout(() => {
        controller.goToNext();
      }, displayDuration);

      return () => clearTimeout(timer);
    }
  }, [banners, controller, displayDuration]);

  // Renderizar skeleton mientras carga
  if (loading) return <BannerSkeleton />;

  // Renderizar children si no hay banners
  if (banners.length === 0) return <>{children || null}</>;

  const currentBanner = banners[controller.currentIndex];
  if (!currentBanner) return <>{children || null}</>;

  // Parsear content_blocks para detectar CTAs
  let contentBlocks: ContentBlock[] = [];
  if (currentBanner.content_blocks) {
    try {
      contentBlocks = typeof currentBanner.content_blocks === 'string'
        ? JSON.parse(currentBanner.content_blocks)
        : currentBanner.content_blocks;
    } catch (e) {
      console.error('Error parsing content_blocks:', e);
    }
  }

  // Detectar si hay CTAs en los content blocks
  const hasCTAsInBlocks = contentBlocks.some(block => block.cta);

  const content = (
    <div className={`relative w-full max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 ${className}`}>
      <div className="relative w-full min-h-[580px] md:min-h-[500px] lg:min-h-[800px] rounded-lg overflow-hidden">
        {showOverlay && <div className="absolute inset-0 bg-black/30 z-10" />}

        {/* Todos los banners en posición absoluta con transición fade + slide */}
        {banners.map((banner, index) => {
          const isActive = index === controller.currentIndex;
          const desktopPosition = parsePosition(banner.position_desktop);
          const mobilePosition = parsePosition(banner.position_mobile);
          const bannerTextStyles = parseTextStyles(banner.text_styles);

          // Parsear content_blocks si existe
          let contentBlocks: ContentBlock[] = [];
          if (banner.content_blocks) {
            try {
              contentBlocks = typeof banner.content_blocks === 'string'
                ? JSON.parse(banner.content_blocks)
                : banner.content_blocks;
            } catch (e) {
              console.error('Error parsing content_blocks:', e);
            }
          }

          // Si hay content_blocks, usarlos en lugar del contenido legacy
          const hasContentBlocks = contentBlocks.length > 0;

          // Renderizar media desktop
          let bannerDesktopMedia: React.ReactNode = null;
          if (banner.desktop_video_url) {
            // Optimizar poster del video (si existe) pero mantener video sin transformaciones
            const optimizedPoster = banner.desktop_image_url
              ? getCloudinaryUrl(banner.desktop_image_url, 'hero-banner')
              : undefined;

            bannerDesktopMedia = (
              <video
                autoPlay={isActive}
                muted
                playsInline
                preload="metadata"
                poster={optimizedPoster}
                className="w-full h-full object-cover"
                onEnded={isActive ? controller.handleVideoEnd : undefined}
                key={`desktop-video-${banner.id}-${index}`}
              >
                <source src={banner.desktop_video_url} type="video/mp4" />
              </video>
            );
          } else if (banner.desktop_image_url) {
            // Aplicar optimizaciones de Cloudinary a imágenes
            const optimizedImageUrl = getCloudinaryUrl(banner.desktop_image_url, 'hero-banner');

            bannerDesktopMedia = (
              <img
                src={optimizedImageUrl}
                alt={banner.name || 'Banner'}
                className="w-full h-full object-cover"
                key={`desktop-image-${banner.id}-${index}`}
              />
            );
          }

          // Renderizar media mobile
          let bannerMobileMedia: React.ReactNode = null;
          if (banner.mobile_video_url) {
            // Optimizar poster del video mobile (si existe) pero mantener video sin transformaciones
            const optimizedMobilePoster = banner.mobile_image_url
              ? getCloudinaryUrl(banner.mobile_image_url, 'mobile-banner')
              : undefined;

            bannerMobileMedia = (
              <video
                autoPlay={isActive}
                muted
                playsInline
                preload="metadata"
                poster={optimizedMobilePoster}
                className="w-full h-full object-cover"
                onEnded={isActive ? controller.handleVideoEnd : undefined}
                key={`mobile-video-${banner.id}-${index}`}
              >
                <source src={banner.mobile_video_url} type="video/mp4" />
              </video>
            );
          } else if (banner.mobile_image_url) {
            // Aplicar optimizaciones de Cloudinary a imágenes mobile
            const optimizedMobileImageUrl = getCloudinaryUrl(banner.mobile_image_url, 'mobile-banner');

            bannerMobileMedia = (
              <img
                src={optimizedMobileImageUrl}
                alt={banner.name || 'Banner'}
                className="w-full h-full object-cover"
                key={`mobile-image-${banner.id}-${index}`}
              />
            );
          }

          return (
            <div
              key={index}
              className="absolute inset-0 transition-all duration-700 ease-in-out"
              style={{
                opacity: isActive ? 1 : 0,
                transform: isActive ? "translateX(0)" : "translateX(-30px)",
                pointerEvents: isActive ? "auto" : "none",
                zIndex: isActive ? 1 : 0,
                willChange: "opacity, transform",
              }}
            >
              {/* Vista Desktop - oculta si forceMobileView está activo */}
              {!forceMobileView && (
                <div
                  ref={isActive ? desktopRef : null}
                  className="banner-media-container hidden md:block absolute inset-0"
                >
                  {bannerDesktopMedia}
                </div>
              )}

              {/* Vista Mobile - siempre visible si forceMobileView está activo */}
              <div
                ref={isActive ? mobileRef : null}
                className={`banner-media-container ${forceMobileView ? "absolute inset-0" : "block md:hidden absolute inset-0"}`}
              >
                {bannerMobileMedia}
              </div>

              <div className="absolute inset-0 z-20">
                {hasContentBlocks ? (
                  <>
                    {!forceMobileView && <ContentBlocksOverlay blocks={contentBlocks} isMobile={false} bannerLinkUrl={banner.link_url} />}
                    <ContentBlocksOverlay blocks={contentBlocks} isMobile={true} forceShow={forceMobileView} bannerLinkUrl={banner.link_url} />
                  </>
                ) : (
                  <>
                    {!forceMobileView && (
                      <BannerContent
                        title={banner.title ?? null}
                        description={banner.description ?? null}
                        cta={banner.cta ?? null}
                        color={banner.color_font ?? "#ffffff"}
                        positionStyle={
                          isActive && deskStyle
                            ? deskStyle
                            : positionToPercentCSS(desktopPosition)
                        }
                        textStyles={bannerTextStyles}
                        videoEnded={true}
                        linkUrl={banner.link_url ?? null}
                        isWrappedInLink={Boolean(banner.link_url)}
                      />
                    )}
                    <BannerContent
                      title={banner.title ?? null}
                      description={banner.description ?? null}
                      cta={banner.cta ?? null}
                      color={banner.color_font ?? "#ffffff"}
                      positionStyle={
                        isActive && mobStyle
                          ? mobStyle
                          : positionToPercentCSS(mobilePosition)
                      }
                      isMobile
                      textStyles={bannerTextStyles}
                      videoEnded={true}
                      linkUrl={banner.link_url ?? null}
                      isWrappedInLink={Boolean(banner.link_url)}
                    />
                  </>
                )}
              </div>
            </div>
          );
        })}

        {/* Indicadores de carrusel (solo si hay múltiples banners) */}
        {banners.length > 1 && (
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-30 flex gap-2">
            {banners.map((_: Banner, index: number) => (
              <button
                key={index}
                onClick={() => controller.goToIndex(index)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${index === controller.currentIndex
                  ? "bg-white w-8"
                  : "bg-white/50 hover:bg-white/75"
                  }`}
                aria-label={`Ir al banner ${index + 1}`}
              />
            ))}
          </div>
        )}

        <div className="pointer-events-none px-4 md:px-6 lg:px-8 xl:px-12 py-6 md:py-8" />
      </div>
    </div>
  );

  // Solo envolver en Link si:
  // 1. El banner tiene link_url
  // 2. Y NO hay CTAs en los content blocks (evitar enlaces anidados)
  const shouldWrapInLink = currentBanner.link_url && !hasCTAsInBlocks;

  return shouldWrapInLink ? (
    <Link href={currentBanner.link_url!} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}
