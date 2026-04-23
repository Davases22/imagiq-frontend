"use client";

import React from "react";
import { ProductCardProps } from "@/app/productos/components/ProductCard";

export const useProductLogic = (product: ProductCardProps | null) => {
  // Estados para selección de variantes
  const [selectedColor, setSelectedColor] = React.useState<string | null>(null);
  const [selectedStorage, setSelectedStorage] = React.useState<string | null>(null);
  const [selectedRam, setSelectedRam] = React.useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = React.useState(0);
  const [showStickyCarousel, setShowStickyCarousel] = React.useState(true);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [modalImageIndex, setModalImageIndex] = React.useState(0);
  const [slideDirection, setSlideDirection] = React.useState<'left' | 'right'>('right');
  const carouselRef = React.useRef<HTMLDivElement>(null);
  const specsRef = React.useRef<HTMLDivElement>(null);

  // Inicializar selecciones cuando el producto se carga
  React.useEffect(() => {
    if (product) {
      // Seleccionar el primer color disponible
      if (product.colors && product.colors.length > 0) {
        setSelectedColor(product.colors[0].name);
      }
      // Seleccionar la primera capacidad disponible
      if (product.capacities && product.capacities.length > 0) {
        setSelectedStorage(product.capacities[0].value);
      }
      // Seleccionar la RAM mínima si hay opciones disponibles
      if (product.apiProduct?.memoriaram) {
        const ramOptions = Array.from(new Set(product.apiProduct.memoriaram))
          .filter(ram => ram && ram.trim() !== '');

        if (ramOptions.length > 0) {
          // Si solo hay una opción, preseleccionarla
          if (ramOptions.length === 1) {
            setSelectedRam(ramOptions[0]);
          } else {
            // Si hay múltiples opciones, seleccionar la mínima
            const sortedRams = ramOptions.sort((a, b) => {
              const numA = parseInt(a.match(/\d+/)?.[0] || '0');
              const numB = parseInt(b.match(/\d+/)?.[0] || '0');
              return numA - numB;
            });
            setSelectedRam(sortedRams[0]);
          }
        }
      }
    }
  }, [product]);

  // Obtener imágenes premium y videos premium (carrusel inicial)
  // IMPORTANTE: Este carrusel NO depende del color seleccionado
  // Muestra contenido premium general del producto
  // Si no hay contenido premium, devuelve array vacío (NO usa imágenes mockeadas)
  const getPremiumImages = () => {
    if (!product) {
      return [];
    }

    const premiumImages: string[] = [];

    // Recolectar TODOS los videos e imágenes premium de TODOS los colores
    // y eliminar duplicados para tener contenido premium general
    const allVideos = new Set<string>();
    const allImages = new Set<string>();

    product.colors?.forEach((color) => {
      // Videos premium
      if (color.video_premium && Array.isArray(color.video_premium)) {
        color.video_premium.forEach(url => {
          if (url && typeof url === 'string' && url.trim() !== '') {
            allVideos.add(url);
          }
        });
      }

      // Imágenes premium
      if (color.imagen_premium && Array.isArray(color.imagen_premium)) {
        color.imagen_premium.forEach(url => {
          if (url && typeof url === 'string' && url.trim() !== '') {
            allImages.add(url);
          }
        });
      }
    });

    // Agregar primero los videos, luego las imágenes
    if (allVideos.size > 0) {
      premiumImages.push(...Array.from(allVideos));
    }

    if (allImages.size > 0) {
      premiumImages.push(...Array.from(allImages));
    }

    return premiumImages;
  };

  // Obtener imágenes del producto del color seleccionado (carrusel secundario)
  // Usa la imagen preview en lugar de las imágenes detail
  const getProductImages = () => {
    if (!product || !selectedColor) return [];

    // Usar la imagen preview del color seleccionado
    const selectedColorData = product.colors?.find(c => c.name === selectedColor);
    if (selectedColorData?.imagePreviewUrl) {
      return [selectedColorData.imagePreviewUrl];
    }

    return [];
  };

  // Obtener imágenes detail para el modal "Ver más"
  const getDetailImages = () => {
    if (!product || !selectedColor) return [];

    // Buscar la variante correspondiente al color seleccionado en el apiProduct
    if (product.apiProduct) {
      const variantIndex = product.apiProduct.color.findIndex(
        (color: string) => color.toLowerCase().trim() === selectedColor.toLowerCase().trim()
      );

      if (variantIndex !== -1 && product.apiProduct.imageDetailsUrls) {
        // Obtener las imágenes específicas de esta variante
        const variantImages = product.apiProduct.imageDetailsUrls[variantIndex];

        if (Array.isArray(variantImages) && variantImages.length > 0) {
          const validImages = variantImages.filter(
            (url: string) => url && typeof url === 'string' && url.trim() !== ''
          );

          return validImages;
        }
      }
    }

    // Fallback: buscar en imageDetailsUrls plano (formato antiguo)
    if (product.apiProduct?.imageDetailsUrls && Array.isArray(product.apiProduct.imageDetailsUrls) && product.apiProduct.imageDetailsUrls.length > 0) {
      const selectedColorData = product.colors?.find(c => c.name === selectedColor);
      const validImages = product.apiProduct.imageDetailsUrls.flat().filter((url: string) => url && typeof url === 'string' && url.trim() !== '');

      // Intentar filtrar por color en la URL
      const colorName = selectedColor.toLowerCase().trim();
      const colorLabel = selectedColorData?.label?.toLowerCase().trim() || '';

      const colorSpecificImages = validImages.filter(url => {
        const urlLower = url.toLowerCase();
        // Buscar el nombre del color o su label en la URL
        return urlLower.includes(colorName) ||
               urlLower.includes(colorLabel) ||
               // Buscar palabras individuales del label (ej: "azul fantasma" -> buscar "azul" y "fantasma")
               colorLabel.split(' ').some(word => word.length > 3 && urlLower.includes(word));
      });

      if (colorSpecificImages.length > 0) {
        return colorSpecificImages;
      }
    }

    // Último fallback: usar la imagen preview del color
    const selectedColorData = product.colors?.find(c => c.name === selectedColor);
    if (selectedColorData?.imagePreviewUrl) {
      return [selectedColorData.imagePreviewUrl];
    }

    return [];
  };

  const premiumImages = getPremiumImages();
  const productImages = getProductImages();
  const detailImages = getDetailImages();

  // Swap entre carrusel premium (sticky) y carrusel de producto (por color).
  // Antes se usaba un umbral fijo de 19% del scroll total, lo que era frágil:
  // en páginas largas caía en medio del bloque de specs; en páginas cortas
  // disparaba demasiado pronto. Ahora observamos si el bloque ProductInfo
  // (specsRef) entra en viewport — más robusto y alineado con lo que el
  // usuario realmente ve.
  React.useEffect(() => {
    const target = specsRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Mientras ProductInfo esté visible, mostrar el carrusel de producto
        // (showStickyCarousel = false). Cuando no esté visible (usuario está
        // arriba, en la zona premium), volver al premium (= true).
        setShowStickyCarousel(!entry.isIntersecting);
      },
      {
        // rootMargin negativo en top: dispara ANTES de que specs toque el
        // borde superior, para que el swap ocurra con algo de anticipación.
        rootMargin: '-20% 0px -30% 0px',
        threshold: 0,
      },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  // Resetear índice de imagen cuando cambie el color seleccionado
  // SOLO si estamos en el carrusel de producto (no en el premium)
  React.useEffect(() => {
    if (!showStickyCarousel) {
      setCurrentImageIndex(0);
    }
  }, [selectedColor, showStickyCarousel]);

  // Funciones para el modal
  const openModal = () => {
    setIsModalOpen(true);
    setModalImageIndex(0);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const goToNextImage = () => {
    if (detailImages.length > 0) {
      setSlideDirection('right');
      setModalImageIndex((prev) => (prev + 1) % detailImages.length);
    }
  };

  const goToPrevImage = () => {
    if (detailImages.length > 0) {
      setSlideDirection('left');
      setModalImageIndex((prev) => prev === 0 ? detailImages.length - 1 : prev - 1);
    }
  };

  const goToImage = (index: number) => {
    if (index > modalImageIndex) {
      setSlideDirection('right');
    } else {
      setSlideDirection('left');
    }
    setModalImageIndex(index);
  };

  return {
    selectedColor,
    selectedStorage,
    selectedRam,
    currentImageIndex,
    showStickyCarousel,
    isModalOpen,
    modalImageIndex,
    slideDirection,
    carouselRef,
    specsRef,
    premiumImages,
    productImages,
    detailImages,
    setSelectedColor,
    setSelectedStorage,
    setSelectedRam,
    setCurrentImageIndex,
    openModal,
    closeModal,
    goToNextImage,
    goToPrevImage,
    goToImage,
  };
};