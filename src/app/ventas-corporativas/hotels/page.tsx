/**
 * 🏨 PÁGINA HOTELES - VENTAS CORPORATIVAS
 * Página completa para sector hotelero con topbar secundario y modal de contacto
 */

"use client";

import React from "react";
import SecondaryNavbar, {
  NavItem,
} from "@/components/sections/ventas-corporativas/SecondaryNavbar";
import HeroSection from "@/components/sections/ventas-corporativas/shared/HeroSection";
import ContactSection from "@/components/sections/ventas-corporativas/shared/ContactSection";
import { ValuesSection } from "@/components/sections/ventas-corporativas/hotels";
import SpecializedConsultationModal from "@/components/sections/ventas-corporativas/SpecializedConsultationModal";
import { SECTION_IMAGES } from "@/constants/hero-images";
import { useIndustryModal } from "@/hooks/useIndustryModal";

const NAV_ITEMS: NavItem[] = [
  { id: "caracteristicas", label: "Características", href: "#hero" },
  { id: "valores", label: "Nuestros valores", href: "#valores" },
];

export default function HotelsPage() {
  const {
    isModalOpen,
    isSubmitting,
    handleContactClick,
    handleModalClose,
    handleFormSubmit,
  } = useIndustryModal("Hoteles");

  return (
    <main className="min-h-screen">
      <SecondaryNavbar
        items={NAV_ITEMS}
        onContactClick={handleContactClick}
        brandLabel="Hoteles"
      />

      <HeroSection
        publicId={SECTION_IMAGES.hotels.hero}
        alt="Samsung para Hoteles"
        subtitle="Soluciones tecnológicas para la industria hotelera y turismo"
      />

      <ValuesSection />

      <ContactSection
        onContactClick={handleContactClick}
        title="¿Listo para transformar tu hotel?"
        description="Descubre cómo Samsung puede mejorar la experiencia de tus huéspedes con tecnología innovadora."
      />

      <SpecializedConsultationModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSubmit={handleFormSubmit}
        isLoading={isSubmitting}
      />
    </main>
  );
}
