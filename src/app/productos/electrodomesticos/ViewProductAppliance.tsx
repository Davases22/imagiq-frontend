"use client";
/**
 * 🛒 VIEW PRODUCT COMPONENT - IMAGIQ ECOMMERCE
 *
 * Vista detallada de producto con:
 * - Imagen principal
 * - Nombre, precio, colores, descripción
 * - Botones de acción (Añadir al carrito, Favorito, Volver)
 * - Layout responsivo y escalable
 * - Código limpio y documentado
 * - Datos quemados (mock) para desarrollo
 */

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useCartContext } from "@/features/cart/CartContext";
import Image, { StaticImageData } from "next/image";
import { motion } from "framer-motion";
import addiLogo from "@/img/iconos/addi_negro.png";
import setingLogo from "@/img/iconos/Setting_line_negro.png";
import packageCar from "@/img/iconos/package_car_negro.png";
import EspecificacionesProduct from "./EspecificacionesProduct";
import medidas from "../../../img/electrodomesticos/medidas.png";
import VideosSection from "./VideosSection";
import { usePathname, useRouter } from "next/navigation";
import ARExperienceHandler from "./components/ARExperienceHandler";
import SizeProduct from "./components/SizeProduct";
import { productsMock } from "../components/productsMock";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import CaracteristicasProduct from "./CaracteristicasProduct";
import ExploreProducts from "./ExploreProducts";
import SkeletonCard from "@/components/SkeletonCard";
// Tipos para producto
interface ProductColor {
  name: string;
  hex: string;
}
interface ProductData {
  id: string;
  name: string;
  image: string | StaticImageData;
  price: string;
  originalPrice?: string;
  discount?: string;
  colors: ProductColor[];
  description?: string;
  specs?: { label: string; value: string }[];
  model?: string;
}

export default function ViewProductAppliance({
  product,
}: {
  product: Readonly<ProductData>;
}) {
  // Animación scroll reveal para hero principal
  const heroReveal = useScrollReveal<HTMLDivElement>({
    offset: 80,
    duration: 600,
    direction: "up",
  });
  // Animación scroll reveal para especificaciones
  const specsReveal = useScrollReveal<HTMLDivElement>({
    offset: 60,
    duration: 500,
    direction: "up",
  });
  // Animación scroll reveal para videos
  const videosReveal = useScrollReveal<HTMLDivElement>({
    offset: 60,
    duration: 500,
    direction: "up",
  });
  // Animación scroll reveal para comparación
  const exploreReveal = useScrollReveal<HTMLDivElement>({
    offset: 60,
    duration: 500,
    direction: "up",
  });

  // Si no hay producto, busca el primero del mock para desarrollo
  const safeProduct = product || productsMock[0];
  const [selectedColor] = useState(safeProduct?.colors?.[0]);
  const router = useRouter();
  const pathname = usePathname();
  const [showBar, setShowBar] = useState(false);
  const { addProduct } = useCartContext();
  const [cartFeedback, setCartFeedback] = useState<string | null>(null);
  const isProductDetailView = pathname.startsWith("/productos/view/");
  useEffect(() => {
    /* Navbar que se bugea al hacer scroll */
    const handleScroll = () => {
      // Solo muestra la barra si el scroll es mayor a 100px y la ruta es de detalles
      setShowBar(window.scrollY > 100 && isProductDetailView);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    // Inicializa correctamente al montar y tras navegación
    setTimeout(handleScroll, 0);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isProductDetailView]);

  // useEffect para ocultar el navbar principal (solo con showBar)
  useEffect(() => {
    if (showBar) {
      document.body.classList.add("hide-main-navbar");
    } else {
      document.body.classList.remove("hide-main-navbar");
    }
    return () => {
      document.body.classList.remove("hide-main-navbar");
    };
  }, [showBar]);

  // Si no hay producto o colores, no renderizar nada
  if (!safeProduct || !safeProduct.colors || safeProduct.colors.length === 0) {
    return null;
  }

  // Handlers
  // Mejorado: Añadir al carrito igual que ProductCard
  const handleAddToCart = () => {
    addProduct({
      id: safeProduct.id,
      name: safeProduct.name,
      image:
        typeof safeProduct.image === "string"
          ? safeProduct.image
          : safeProduct.image.src || "",
      price:
        typeof safeProduct.price === "string"
          ? parseInt(safeProduct.price.replace(/[^\d]/g, ""))
          : safeProduct.price || 0,
      quantity: 1,
      sku: safeProduct.id, // Add required sku property
      ean: safeProduct.id,
      modelo: safeProduct.model || "", // Modelo para sugerencias relacionadas
      categoria: "HA", // Categoría de electrodomésticos
    });
    setCartFeedback("Producto añadido al carrito");
    setTimeout(() => setCartFeedback(null), 1200);
  };
  // Mejorado: Comprar, navega a DetailsProduct
  const handleBuy = () => {
    router.push("/productos/electrodomesticos/details");
  };

  const ExploreProducts = dynamic(() => import("./ExploreProducts"), {
    loading: () => (
      <div className="bg-white">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 max-w-7xl mx-auto px-4 py-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    ),
    ssr: false, // opcional, si quieres que solo se renderice en el cliente
  });

  return (
    <div
      className="min-h-screen w-full flex flex-col mt-[-10%] pt-[15%]"
      style={{
        background: "#D9D9D9",
        fontFamily: "SamsungSharpSans",
      }}
    >
      {/* Feedback UX al añadir al carrito */}
      {cartFeedback && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-xl shadow-lg z-50 animate-fadeInContent font-bold text-lg">
          {cartFeedback}
        </div>
      )}
      {/* Hero section */}
      <motion.section
        ref={heroReveal.ref}
        {...heroReveal.motionProps}
        className="flex flex-1 items-center justify-center px-4 py-8 md:py-0"
      >
        <div className="max-w-6xl w-full flex flex-col md:flex-row items-center justify-between gap-0">
          {/* Columna izquierda: info y acciones */}
          <div
            className="flex-1 flex flex-col items-start justify-center gap-6"
            style={{ fontFamily: "SamsungSharpSans" }}
          >
            {/* Nombre producto dinámico */}
            <h1
              className="text-gray text-3xl md:text-5xl font-bold mb-2 hover:text-gray-900 transition-all"
              style={{ fontFamily: "SamsungSharpSans", letterSpacing: "-1px" }}
            >
              {safeProduct.name}
            </h1>
            {/* Logos y badges debajo del nombre */}
            <div className="flex flex-col gap-3 mb-2">
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center border border-black bg-white/10"
                  style={{
                    minWidth: 80,
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                  }}
                >
                  <Image
                    src={addiLogo}
                    alt="Addi Logo"
                    width={148}
                    height={58}
                  />
                </div>
                <span
                  className="text-gray text-lg"
                  style={{ fontFamily: "SamsungSharpSans" }}
                >
                  Paga hasta en 24 cuotas
                  <br />
                  con Addi
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center border border-black bg-white/10"
                  style={{
                    minWidth: 80,
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                  }}
                >
                  <Image src={packageCar} alt="Envío" width={58} height={58} />
                </div>
                <span
                  className="text-gray text-lg"
                  style={{ fontFamily: "SamsungSharpSans" }}
                >
                  Envío gratis a todo
                  <br />
                  Colombia. *Aplican TYC*
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center border border-black bg-white/10"
                  style={{
                    minWidth: 80,
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                  }}
                >
                  <Image
                    src={setingLogo}
                    alt="Setting Logo"
                    width={58}
                    height={58}
                  />
                </div>
                <span
                  className="text-gray text-lg"
                  style={{ fontFamily: "SamsungSharpSans" }}
                >
                  Instalación gratis
                </span>
              </div>
            </div>
            {/* Botones de acción */}
            <div className="flex gap-4 mt-4">
              <button
                className="bg-black text-white px-8 py-3 rounded-full font-bold text-lg shadow hover:bg-gray-900 transition-all border border-black"
                style={{ fontFamily: "SamsungSharpSans" }}
                onClick={handleBuy}
              >
                ¡Compra aquí!
              </button>
              <button
                className="bg-transparent text-black border border-black rounded-full px-4 py-2 font-semibold text-base shadow hover:bg-white/30  transition-all"
                style={{ fontFamily: "SamsungSharpSans" }}
                onClick={handleAddToCart}
              >
                Añadir al carrito
              </button>
            </div>
          </div>

          {/* Columna derecha: imagen producto dinámica */}
          <div className="flex-1 flex items-center justify-center p-8">
            <Image
              src={safeProduct.image}
              alt={safeProduct.name}
              width={420}
              height={420}
              className="object-contain drop-shadow-2xl"
              priority
              style={{ background: "none" }}
            />
          </div>
        </div>
      </motion.section>
      <ARExperienceHandler
        glbUrl="https://modelado3d.s3.us-east-2.amazonaws.com/Nevera1_5.glb"
        usdzUrl="https://modelado3d.s3.us-east-2.amazonaws.com/Nevera_(1).usdz"
      ></ARExperienceHandler>

      {/* Barra superior solo si está en detalles y ha hecho scroll */}
      {isProductDetailView && showBar && (
        <div
          className="w-full bg-white shadow-sm h-[72px] flex items-center px-4 fixed top-0 pt-2 left-0 z-40 animate-fadeInContent"
          style={{ fontFamily: "SamsungSharpSans" }}
        >
          {/* MOBILE: solo nombre y botón comprar */}
          <div className="flex w-full items-center justify-between md:hidden">
            {/* Nombre a la izquierda */}
            <span
              className="font-bold text-base text-black text-left truncate"
              style={{ fontFamily: "SamsungSharpSans", maxWidth: "60vw" }}
            >
              {safeProduct.name}
            </span>
            {/* Botón comprar a la derecha */}
            <button
              className="bg-black text-white rounded-full px-4 py-2 h-10 font-semibold text-sm shadow hover:bg-gray-900 transition-all min-w-[90px]"
              style={{ fontFamily: "SamsungSharpSans" }}
              onClick={handleBuy}
            >
              Comprar
            </button>
          </div>
          {/* DESKTOP/TABLET: diseño original */}
          <div className="hidden md:flex w-full items-center justify-between">
            {/* Parte izquierda: imagen frame_311_black + logo Samsung + imagen store_black */}
            <div className="flex items-center gap-2" style={{ minWidth: 110 }}>
              <Image
                src="/frame_311_black.png"
                alt="Frame"
                width={32}
                height={32}
                className="object-contain"
                priority
              />
              {/* Logo Samsung clickable */}
              <button
                className="p-0 m-0 bg-transparent border-none cursor-pointer flex items-center"
                title="Ir al inicio"
                aria-label="Ir al inicio"
                onClick={() => (window.location.href = "/")}
              >
                <Image
                  src="https://res.cloudinary.com/dnglv0zqg/image/upload/v1760575601/Samsung_black_ec1b9h.svg"
                  alt="Samsung Logo"
                  width={110}
                  height={32}
                  style={{ objectFit: "contain" }}
                  priority
                />
              </button>
              {/* Imagen store_black */}
              <Image
                src="/store_black.png"
                alt="Store"
                width={32}
                height={32}
                className="object-contain"
                priority
              />
            </div>
            {/* Nombre centrado */}
            <div className="flex-1 flex justify-center">
              <span
                className="font-bold text-base md:text-lg text-center"
                style={{ fontFamily: "SamsungSharpSans" }}
              >
                {safeProduct.name}
              </span>
            </div>
            {/* Parte derecha: botón añadir al carrito + botón comprar */}
            <div className="flex items-center gap-2" style={{ minWidth: 110 }}>
              {/* Botón añadir al carrito */}
              <button
                className="bg-transparent text-black border border-black rounded-full px-8 py-2 h-12 font-semibold text-base shadow hover:bg-black hover:text-white transition-all mb-3 mt-3 min-w-[130px]"
                style={{ fontFamily: "SamsungSharpSans" }}
                onClick={handleAddToCart}
              >
                Añadir al carrito
              </button>
              {/* Botón comprar */}
              <button
                className="bg-black text-white rounded-full px-6 py-2 h-12 font-semibold text-base shadow hover:bg-gray-900 transition-all mb-3 mt-3 min-w-[110px]"
                style={{ fontFamily: "SamsungSharpSans" }}
                onClick={handleBuy}
              >
                Comprar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Oculta el navbar principal con una clase global */}
      <style>{`
              body.hide-main-navbar header[data-navbar="true"] { display: none !important; }
            `}</style>
      <div className="h-[56px] w-full" />
      {/* Parte 2: Imagen y especificaciones con scroll y animaciones */}
      <motion.div ref={specsReveal.ref} {...specsReveal.motionProps}>
        <EspecificacionesProduct specs={safeProduct.specs} />
        <SizeProduct img={medidas}></SizeProduct>
      </motion.div>
      <motion.div ref={videosReveal.ref} {...videosReveal.motionProps}>
        <CaracteristicasProduct></CaracteristicasProduct>
        <VideosSection />
      </motion.div>
      <motion.div ref={exploreReveal.ref} {...exploreReveal.motionProps}>
        <ExploreProducts
          title="Explora la linea BeSpoke"
          filters={{ descriptionKeyword: "Bespoke" }}
          limit={4}
        ></ExploreProducts>
      </motion.div>
    </div>
  );
}
