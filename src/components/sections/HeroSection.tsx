/**
 * 🦸 HERO SECTION - IMAGIQ ECOMMERCE
 * Refactored to use configuration system
 */

"use client";

import { useRef, useState, useEffect } from "react";
import { useHeroBanner } from "@/hooks/useHeroBanner";
import { useHeroContext } from "@/contexts/HeroContext";
import { positionToCSS, parseTextStyles } from "@/utils/bannerCoordinates";
import Link from "next/link";
import type { HeroBannerConfig, ContentBlock } from "@/types/banner";
import { getCloudinaryUrl } from "@/lib/cloudinary";

/**
 * Componente de contenido del Hero (reutilizable para desktop y mobile)
 */
interface HeroContentProps {
  config: HeroBannerConfig;
  videoEnded: boolean;
  positionStyle: React.CSSProperties;
  isMobile?: boolean;
}

function HeroContent({ config, videoEnded, positionStyle, isMobile }: Readonly<HeroContentProps>) {
  const textSize = isMobile
    ? "text-3xl"
    : "text-5xl xl:text-6xl";
  const subSize = isMobile
    ? "text-base mb-4 font-medium"
    : "text-xl xl:text-2xl mb-6 font-normal";
  const buttonSize = isMobile
    ? "px-6 py-2 text-sm"
    : "px-7 py-2.5 text-sm";

  return (
    <div
      className={`${isMobile ? 'md:hidden flex flex-col items-center text-center' : 'hidden md:flex flex-col items-start'} z-10`}
      style={{
        ...positionStyle,
        position: 'absolute',
        opacity: videoEnded ? 1 : 0,
        transition: "all 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.3s",
        pointerEvents: videoEnded ? "auto" : "none",
        ...(isMobile && { maxWidth: '90%' }),
      }}
    >
      {config.heading && (
        <h1
          className={`${textSize} font-bold mb-3 tracking-tight`}
          style={{
            color: "#ffffff",
            ...(config.textStyles?.title || {}),
          }}
        >
          {config.heading}
        </h1>
      )}
      {config.subheading && (
        <p
          className={subSize}
          style={{
            color: "#ffffff",
            ...(config.textStyles?.description || {}),
          }}
        >
          {config.subheading}
        </p>
      )}
      {config.ctaText && (
        <Link
          href={config.ctaLink || "#"}
          className={`bg-transparent hover:opacity-80 ${buttonSize} rounded-full font-semibold transition-all duration-300 transform hover:scale-105`}
          style={{
            color: "#ffffff",
            borderWidth: '2px',
            borderColor: "#ffffff",
            ...(config.textStyles?.cta || {}),
          }}
        >
          {config.ctaText}
        </Link>
      )}
    </div>
  );
}

/**
 * Componente para renderizar bloques de contenido con configuración desktop/mobile
 */
function ContentBlocksOverlay({
  blocks,
  isMobile,
  videoEnded,
}: Readonly<{
  blocks: ContentBlock[];
  isMobile?: boolean;
  videoEnded: boolean;
}>) {
  const visibilityClass = isMobile ? 'md:hidden' : 'hidden md:block';

  return (
    <>
      {blocks.map((block) => {
        const position = isMobile ? block.position_mobile : block.position_desktop;

        // Configuración del contenedor
        const textAlign = isMobile && block.textAlign_mobile
          ? block.textAlign_mobile
          : block.textAlign || 'left';
        const gap = isMobile && block.gap_mobile
          ? block.gap_mobile
          : block.gap || '12px';

        return (
          <div
            key={block.id}
            className={`absolute z-10 ${visibilityClass}`}
            style={{
              left: `${position.x}%`,
              top: `${position.y}%`,
              transform: 'translate(-50%, -50%)',
              opacity: videoEnded ? 1 : 0,
              transition: "all 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.3s",
              pointerEvents: videoEnded ? "auto" : "none",
            }}
          >
            <div
              className="flex flex-col"
              style={{ gap }}
            >
              {/* Título */}
              {block.title && (() => {
                const titleStyles = {
                  fontSize: (isMobile && block.title_mobile?.fontSize) || block.title.fontSize || '2rem',
                  fontWeight: (isMobile && block.title_mobile?.fontWeight) || block.title.fontWeight || '700',
                  color: (isMobile && block.title_mobile?.color) || block.title.color || '#ffffff',
                  lineHeight: (isMobile && block.title_mobile?.lineHeight) || block.title.lineHeight || '1.2',
                  textTransform: (isMobile && block.title_mobile?.textTransform) || block.title.textTransform || 'none',
                  letterSpacing: (isMobile && block.title_mobile?.letterSpacing) || block.title.letterSpacing || 'normal',
                  textShadow: (isMobile && block.title_mobile?.textShadow) || block.title.textShadow || '2px 2px 4px rgba(0,0,0,0.5)',
                };
                return (
                  <h2
                    style={{
                      ...titleStyles,
                      margin: 0,
                      whiteSpace: 'pre-line',
                      textAlign,
                    }}
                  >
                    {block.title.text}
                  </h2>
                );
              })()}

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
                  // Efecto glassmorphism
                  backdropFilter: (isMobile && block.cta_mobile?.backdropFilter) || block.cta.backdropFilter,
                  boxShadow: (isMobile && block.cta_mobile?.boxShadow) || block.cta.boxShadow,
                };
                return (
                  <div style={{ textAlign }}>
                    <a
                      href={block.cta.link_url || '#'}
                      className="inline-block transition-all duration-300 hover:scale-105 hover:shadow-lg"
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

export default function HeroSection() {
  const { configs, config, loading } = useHeroBanner();
  const { setTextColor } = useHeroContext();
  const [videoEnded, setVideoEnded] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  // NUEVO: Estados para el carrusel
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const BANNER_DISPLAY_DURATION = 5000; // 5 segundos

  // NUEVO: Trackear qué videos ya se reprodujeron (para no reproducirlos de nuevo en el loop)
  const playedVideosRef = useRef<Set<number>>(new Set());

  // Estado para controlar si el banner activo debe hacer "snap" a pantalla completa (Zoom inteligente)
  const [snapToFullScreen, setSnapToFullScreen] = useState(false);

  // Efecto para "Smart Snap": Calcular si la imagen debe llenar la pantalla
  useEffect(() => {
    const checkSmartSnap = () => {
      // Buscar el elemento media activo (video o img)
      // Usamos los IDs generados o buscamos dentro del slide activo
      const activeSlide = document.querySelector(`[data-banner-index="${currentBannerIndex}"]`);
      if (!activeSlide) return;

      // Buscar media visible (desktop o mobile según window width es difícil saber exacto en JS simple,
      // pero podemos buscar el que tenga display block o simplemente el que exista)
      // Una estrategia más segura: buscar ambos y usar el que tenga dimensiones > 0
      const mediaElements = activeSlide.querySelectorAll('video, img');
      let activeMedia: HTMLVideoElement | HTMLImageElement | null = null;

      for (const media of mediaElements) {
        if (media.getBoundingClientRect().width > 0) {
          activeMedia = media as HTMLVideoElement | HTMLImageElement;
          break;
        }
      }

      if (!activeMedia) return;

      // Obtener dimensiones naturales
      let naturalWidth = 0;
      let naturalHeight = 0;

      if (activeMedia instanceof HTMLVideoElement) {
        naturalWidth = activeMedia.videoWidth;
        naturalHeight = activeMedia.videoHeight;
      } else {
        naturalWidth = activeMedia.naturalWidth;
        naturalHeight = activeMedia.naturalHeight;
      }

      if (naturalWidth === 0 || naturalHeight === 0) return;

      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;

      // Altura que tendría la imagen al ocupar el 100% del ancho (comportamiento h-auto)
      const renderedHeight = (naturalHeight / naturalWidth) * screenWidth;

      // Calcular cuánto tendríamos que escalar para llenar la altura (si renderedHeight < screenHeight)
      // Si renderedHeight >= screenHeight, ya llena la pantalla (scaleNeeded <= 1)
      const scaleNeeded = screenHeight / renderedHeight;

      // Lógica de Smart Snap:
      // Si la imagen es un poco más baja que la pantalla (necesita crecer <= 5% para llenar), hacemos snap.
      // O si la imagen ya es más alta que la pantalla, no forzamos h-screen a menos que queramos recortar.
      // El usuario pidió: "zoom para que ocupe toda la pantalla... un máximo de 5%".
      // Interpretación: Si hay un gap pequeño (< 5%), haz zoom (crop laterales) para llenar height.
      if (scaleNeeded > 1 && scaleNeeded <= 1.05) {
        setSnapToFullScreen(true);
      } else {
        setSnapToFullScreen(false);
      }
    };

    checkSmartSnap();
    window.addEventListener('resize', checkSmartSnap);

    // También verificar cuando cambie el slide activo o se cargue la media
    const interval = setInterval(checkSmartSnap, 500); // Polling suave para cambios de media/carga

    return () => {
      window.removeEventListener('resize', checkSmartSnap);
      clearInterval(interval);
    };
  }, [currentBannerIndex]);


  // NUEVO: Config actualmente visible
  const currentConfig = configs[currentBannerIndex] || config;

  // NUEVO: Función para avanzar al siguiente banner (con loop)
  const goToNextBanner = () => {
    setCurrentBannerIndex((prevIndex) => {
      const nextIndex = prevIndex + 1;
      return nextIndex >= configs.length ? 0 : nextIndex;
    });
  };

  // NUEVO: Handler cuando termina un video
  const handleVideoEndCarousel = () => {
    if (configs.length > 1) {
      // Marcar este video como reproducido
      playedVideosRef.current.add(currentBannerIndex);

      timerRef.current = setTimeout(() => {
        goToNextBanner();
      }, BANNER_DISPLAY_DURATION);
    }
  };

  // NUEVO: Reiniciar videoEnded cuando cambia el banner
  useEffect(() => {
    setVideoEnded(false);
  }, [currentBannerIndex]);

  // Sincronizar color del header con el banner actual
  useEffect(() => {
    if (currentConfig?.colorFont) {
      setTextColor(currentConfig.colorFont);
    }
  }, [currentConfig?.colorFont, setTextColor]);

  // NUEVO: Efecto para gestionar el carrusel automático
  useEffect(() => {
    if (configs.length <= 1) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const currentBannerData = configs[currentBannerIndex];
    const hasVideo = Boolean(currentBannerData?.videoSrc || currentBannerData?.mobileVideoSrc);
    const videoAlreadyPlayed = playedVideosRef.current.has(currentBannerIndex);

    // Si no tiene video O si el video ya se reprodujo antes, solo mostrar por 5 segundos
    if (!hasVideo || videoAlreadyPlayed) {
      timerRef.current = setTimeout(() => {
        goToNextBanner();
      }, BANNER_DISPLAY_DURATION);
    }
    // Si tiene video y no se ha reproducido, el timer se establecerá en handleVideoEnd

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBannerIndex, configs.length]);

  // Efecto de scroll para reducir el video
  useEffect(() => {
    const handleScroll = () => {
      const viewportWidth = window.innerWidth;
      const maxContentWidth = 1440;

      if (viewportWidth <= maxContentWidth) {
        setScrollProgress(0);
        return;
      }

      const targetWidth = (maxContentWidth / viewportWidth) * 100;
      const maxReduction = 100 - targetWidth;
      const scrollProgress = Math.min(window.scrollY / window.innerHeight, 1);
      const actualProgress = scrollProgress * (maxReduction / 8);

      setScrollProgress(Math.min(actualProgress, maxReduction / 8));
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  const handleVideoEnd = () => {
    if (currentConfig.showContentOnEnd) {
      setVideoEnded(true);
    }

    // NUEVO: Si hay múltiples banners, avanzar al siguiente después del video
    handleVideoEndCarousel();
  };

  if (loading) {
    return (
      <section
        className="relative w-full h-screen flex items-center justify-center overflow-hidden -mt-[64px] xl:-mt-[100px] pt-[64px] xl:pt-[100px]"
        style={{ backgroundColor: "#000000" }}
      >
        <div className="animate-pulse w-full h-full bg-gray-900" />
      </section>
    );
  }

  // Estilos de posicionamiento con el nuevo sistema
  const desktopPositionStyle = positionToCSS(currentConfig.positionDesktop ?? null);
  const mobilePositionStyle = positionToCSS(currentConfig.positionMobile ?? null);

  // Variables para decidir si mostrar el contenido del Hero
  const hasAnyVideo = Boolean(currentConfig.videoSrc || currentConfig.mobileVideoSrc);
  const showImmediately = !hasAnyVideo; // no hay video -> mostrar siempre
  const canShow = showImmediately || Boolean(currentConfig.showContentOnEnd);
  // Cuando mostramos inmediatamente forzamos videoEnded=true para que el contenido sea visible
  const effectiveVideoEnded = showImmediately ? true : videoEnded;


  return (
    <section
      className={`relative w-full -mt-[64px] xl:-mt-[100px] transition-[height] duration-500 ease-in-out ${snapToFullScreen ? 'h-screen' : ''}`}
      style={{
        zIndex: 1,
        backgroundColor: '#ffffff',
      }}
      data-hero="true"
    >
      <div className={`grid grid-cols-1 grid-rows-1 ${snapToFullScreen ? 'h-full' : ''}`}>
        {/* Todos los banners en la misma celda de grid para superponerse */}
        {configs.map((config, index) => {
          const isActive = index === currentBannerIndex;
          const videoAlreadyPlayed = playedVideosRef.current.has(index);
          const bannerVideoEnded = isActive ? videoEnded : false;
          const hasAnyVideoBanner = Boolean(config.videoSrc || config.mobileVideoSrc);
          const showImmediatelyBanner = !hasAnyVideoBanner;
          const canShowBanner = showImmediatelyBanner || Boolean(config.showContentOnEnd);
          // Si el video ya se reprodujo antes, mostrar contenido inmediatamente
          const effectiveVideoEndedBanner = showImmediatelyBanner || videoAlreadyPlayed ? true : bannerVideoEnded;
          const desktopPositionStyleBanner = positionToCSS(config.positionDesktop ?? null);
          const mobilePositionStyleBanner = positionToCSS(config.positionMobile ?? null);

          // Si el video ya se reprodujo, mostrar solo la imagen
          const shouldShowVideoDesktop = config.videoSrc && !videoAlreadyPlayed && isActive;
          const shouldShowVideoMobile = config.mobileVideoSrc && !videoAlreadyPlayed && isActive;

          // Parsear content_blocks si existe
          let contentBlocks: ContentBlock[] = [];
          if (config.content_blocks) {
            try {
              contentBlocks = typeof config.content_blocks === 'string'
                ? JSON.parse(config.content_blocks)
                : config.content_blocks;
            } catch (e) {
              console.error('Error parsing content_blocks:', e);
            }
          }
          const hasContentBlocks = contentBlocks.length > 0;

          return (
            <div
              key={index}
              data-banner-index={index}
              className={`col-start-1 row-start-1 w-full relative transition-all duration-700 ease-in-out ${snapToFullScreen ? 'h-full' : ''}`}
              style={{
                opacity: isActive ? 1 : 0,
                transform: isActive ? 'translateX(0)' : 'translateX(-30px)',
                pointerEvents: isActive ? 'auto' : 'none',
                zIndex: isActive ? 1 : 0
              }}
            >
              {/* Desktop media */}
              <div className={`hidden md:block w-full relative ${snapToFullScreen ? 'h-full' : 'h-auto'}`}>
                {shouldShowVideoDesktop ? (
                  <>
                    {/* Desktop video */}
                    <video
                      key={`hero-desktop-video-${index}`}
                      className={`block ${snapToFullScreen ? 'h-full object-cover' : 'w-full h-auto'}`}
                      autoPlay={isActive}
                      muted
                      loop={config.loop}
                      playsInline
                      preload="metadata"
                      onEnded={isActive ? handleVideoEnd : undefined}
                      poster={config.imageSrc ? getCloudinaryUrl(config.imageSrc, 'hero-banner') : undefined}
                      style={{
                        opacity: bannerVideoEnded ? 0 : 1,
                        transition: "opacity 0.5s ease-in-out, width 0.3s ease-out, margin 0.3s ease-out",
                        width: `${100 - scrollProgress * 8}%`,
                        marginLeft: `${scrollProgress * 4}%`,
                        marginRight: `${scrollProgress * 4}%`,
                      }}
                    >
                      <source src={config.videoSrc} type="video/mp4" />
                    </video>
                    {/* Desktop poster image - shown when video ends */}
                    {config.imageSrc && (
                      <img
                        src={getCloudinaryUrl(config.imageSrc, 'hero-banner')}
                        alt={config.heading || "Banner"}
                        className={`block absolute top-0 left-0 ${snapToFullScreen ? 'h-full object-cover' : 'w-full h-auto'}`}
                        style={{
                          opacity: bannerVideoEnded ? 1 : 0,
                          transition: "opacity 0.5s ease-in-out, width 0.3s ease-out, margin 0.3s ease-out",
                          width: `${100 - scrollProgress * 8}%`,
                          marginLeft: `${scrollProgress * 4}%`,
                          marginRight: `${scrollProgress * 4}%`,
                        }}
                      />
                    )}
                  </>
                ) : (
                  /* Desktop image only */
                  config.imageSrc && (
                    <img
                      key={`hero-desktop-image-${index}`}
                      src={getCloudinaryUrl(config.imageSrc, 'hero-banner')}
                      alt={config.heading || "Banner"}
                      className={`block ${snapToFullScreen ? 'h-full object-cover' : 'w-full h-auto'}`}
                      style={{
                        transition: "width 0.3s ease-out, margin 0.3s ease-out",
                        width: `${100 - scrollProgress * 8}%`,
                        marginLeft: `${scrollProgress * 4}%`,
                        marginRight: `${scrollProgress * 4}%`,
                      }}
                    />
                  )
                )}
              </div>

              {/* Mobile media — alto automático según aspect del archivo (no se recorta) */}
              <div className="block md:hidden w-full relative">
                {shouldShowVideoMobile ? (
                  <>
                    {/* Mobile video */}
                    <video
                      key={`hero-mobile-video-${index}`}
                      className="block w-full h-auto"
                      autoPlay={isActive}
                      muted
                      loop={config.loop}
                      playsInline
                      preload="metadata"
                      onEnded={isActive ? handleVideoEnd : undefined}
                      poster={config.mobileImageSrc ? getCloudinaryUrl(config.mobileImageSrc, 'mobile-banner') : undefined}
                      style={{
                        opacity: bannerVideoEnded ? 0 : 1,
                        transition: "opacity 0.5s ease-in-out",
                      }}
                    >
                      <source src={config.mobileVideoSrc} type="video/mp4" />
                    </video>
                    {/* Mobile poster image */}
                    {config.mobileImageSrc && (
                      <img
                        src={getCloudinaryUrl(config.mobileImageSrc, 'mobile-banner')}
                        alt={config.heading || "Banner"}
                        className="block absolute inset-0 w-full h-full object-contain"
                        style={{
                          opacity: bannerVideoEnded ? 1 : 0,
                          transition: "opacity 0.5s ease-in-out",
                        }}
                      />
                    )}
                  </>
                ) : (
                  /* Mobile image only */
                  config.mobileImageSrc && (
                    <img
                      key={`hero-mobile-image-${index}`}
                      src={getCloudinaryUrl(config.mobileImageSrc, 'mobile-banner')}
                      alt={config.heading || "Banner"}
                      className="block w-full h-auto"
                    />
                  )
                )}
              </div>

              {/* Contenido específico de este banner - overlay absoluto */}
              {(canShowBanner || videoAlreadyPlayed) && (
                <div className="absolute inset-x-0 top-0 h-full flex items-center justify-center">
                  {hasContentBlocks ? (
                    <>
                      <ContentBlocksOverlay
                        blocks={contentBlocks}
                        isMobile={false}
                        videoEnded={effectiveVideoEndedBanner}
                      />
                      <ContentBlocksOverlay
                        blocks={contentBlocks}
                        isMobile={true}
                        videoEnded={effectiveVideoEndedBanner}
                      />
                    </>
                  ) : (
                    <>
                      <HeroContent
                        config={config}
                        videoEnded={effectiveVideoEndedBanner}
                        positionStyle={desktopPositionStyleBanner}
                      />
                      <HeroContent
                        config={config}
                        videoEnded={effectiveVideoEndedBanner}
                        positionStyle={mobilePositionStyleBanner}
                        isMobile
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Indicadores de carrusel */}
      {configs.length > 1 && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-40 flex gap-2">
          {configs.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentBannerIndex(index)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${index === currentBannerIndex
                ? 'bg-white w-8'
                : 'bg-white/50 hover:bg-white/75'
                }`}
              aria-label={`Ir al banner ${index + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}