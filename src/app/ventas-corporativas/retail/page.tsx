"use client";

import React from "react";
import SecondaryNavbar, {
  NavItem,
} from "@/components/sections/ventas-corporativas/SecondaryNavbar";
import HeroSection from "@/components/sections/ventas-corporativas/shared/HeroSection";
import ContactSection from "@/components/sections/ventas-corporativas/shared/ContactSection";
import { ValuesSection } from "@/components/sections/ventas-corporativas/retail";
import SpecializedConsultationModal from "@/components/sections/ventas-corporativas/SpecializedConsultationModal";
import { SECTION_IMAGES } from "@/constants/hero-images";
import { useIndustryModal } from "@/hooks/useIndustryModal";

const NAV_ITEMS: NavItem[] = [
  { id: "caracteristicas", label: "Características", href: "#hero" },
  { id: "valores", label: "Nuestros valores", href: "#valores" },
];

export default function RetailPage() {
  const {
    isModalOpen,
    isSubmitting,
    handleContactClick,
    handleModalClose,
    handleFormSubmit,
  } = useIndustryModal("Retail");

  return (
    <main className="min-h-screen">
      <SecondaryNavbar
        items={NAV_ITEMS}
        onContactClick={handleContactClick}
        brandLabel="Retail"
      />

      <HeroSection
        publicId={SECTION_IMAGES.retail.hero}
        alt="Samsung para Retail - Soluciones tecnológicas para negocios"
        subtitle="Potencia tus ventas con beneficios para tu negocio"
      />

      <ValuesSection />

      <ContactSection
        onContactClick={handleContactClick}
        title="¿Listo para transformar tu negocio retail?"
        description="Descubre cómo las soluciones Samsung pueden elevar tu tienda y mejorar la experiencia de tus clientes"
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
