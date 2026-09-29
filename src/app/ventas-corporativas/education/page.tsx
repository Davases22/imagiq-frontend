/**
 * 🎓 PÁGINA EDUCACIÓN - VENTAS CORPORATIVAS
 * Página completa con topbar secundario y modal de contacto
 */

"use client";

import React from "react";
import SecondaryNavbar, {
  NavItem,
} from "@/components/sections/ventas-corporativas/SecondaryNavbar";
import HeroSection from "@/components/sections/ventas-corporativas/shared/HeroSection";
import ContactSection from "@/components/sections/ventas-corporativas/shared/ContactSection";
import { ValuesSection } from "@/components/sections/ventas-corporativas/education";
import SpecializedConsultationModal from "@/components/sections/ventas-corporativas/SpecializedConsultationModal";
import { SECTION_IMAGES } from "@/constants/hero-images";
import { useIndustryModal } from "@/hooks/useIndustryModal";

const NAV_ITEMS: NavItem[] = [
  { id: "caracteristicas", label: "Características", href: "#hero" },
  { id: "valores", label: "Nuestros valores", href: "#valores" },
];

export default function EducationPage() {
  const {
    isModalOpen,
    isSubmitting,
    handleContactClick,
    handleModalClose,
    handleFormSubmit,
  } = useIndustryModal("Educación");

  return (
    <main className="min-h-screen">
      <SecondaryNavbar
        items={NAV_ITEMS}
        onContactClick={handleContactClick}
        brandLabel="Educativo"
      />

      <HeroSection
        publicId={SECTION_IMAGES.education.hero}
        alt="Samsung Education Solutions"
        subtitle="Impulsa el aprendizaje con beneficios en tecnología"
      />

      <ValuesSection />

      <ContactSection
        onContactClick={handleContactClick}
        title="¿Listo para transformar la educación?"
        description="Descubre cómo Samsung puede ayudar a tu institución educativa a preparar a los estudiantes para el futuro con tecnología de punta."
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
