/**
 * 🏛️ PÁGINA GOBIERNO - VENTAS CORPORATIVAS
 * Página completa para sector gubernamental con topbar secundario y modal de contacto
 */

"use client";

import React from "react";
import SecondaryNavbar, {
  NavItem,
} from "@/components/sections/ventas-corporativas/SecondaryNavbar";
import HeroSection from "@/components/sections/ventas-corporativas/shared/HeroSection";
import ContactSection from "@/components/sections/ventas-corporativas/shared/ContactSection";
import { ValuesSection } from "@/components/sections/ventas-corporativas/government";
import SpecializedConsultationModal from "@/components/sections/ventas-corporativas/SpecializedConsultationModal";
import { SECTION_IMAGES } from "@/constants/hero-images";
import { useIndustryModal } from "@/hooks/useIndustryModal";

const NAV_ITEMS: NavItem[] = [
  { id: "caracteristicas", label: "Características", href: "#hero" },
  { id: "valores", label: "Nuestros valores", href: "#valores" },
];

export default function GovernmentPage() {
  const {
    isModalOpen,
    isSubmitting,
    handleContactClick,
    handleModalClose,
    handleFormSubmit,
  } = useIndustryModal("Gobierno");

  return (
    <main className="min-h-screen">
      <SecondaryNavbar
        items={NAV_ITEMS}
        onContactClick={handleContactClick}
        brandLabel="Gobierno"
      />

      <HeroSection
        publicId={SECTION_IMAGES.government.hero}
        alt="Samsung para Gobierno"
        subtitle="Soluciones tecnológicas para entidades gubernamentales"
      />

      <ValuesSection />

      <ContactSection
        onContactClick={handleContactClick}
        title="¿Listo para modernizar tu institución?"
        description="Descubre cómo Samsung puede ayudar a tu entidad gubernamental con tecnología confiable y eficiente."
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
