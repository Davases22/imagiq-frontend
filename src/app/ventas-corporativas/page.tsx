"use client";

import React, { useState } from "react";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { IndustrySelector } from "@/components/sections/ventas-corporativas";
import SecondaryNavbar from "@/components/sections/ventas-corporativas/SecondaryNavbar";
import SpecializedConsultationModal from "@/components/sections/ventas-corporativas/SpecializedConsultationModal";
import {
  Industry,
  SpecializedConsultationFormData,
} from "@/types/corporate-sales";

export default function VentasCorporativasPage() {
  const [selectedIndustry, setSelectedIndustry] = useState<Industry | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleIndustrySelect = (industry: Industry) => {
    setSelectedIndustry(industry);
  };

  const handleContactClick = () => {
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    if (!isSubmitting) {
      setIsModalOpen(false);
    }
  };

  const handleFormSubmit = async (data: SpecializedConsultationFormData) => {
    setIsSubmitting(true);
    try {
      await apiClient.post("/api/messaging/corporate-lead", {
        fullName: data.fullName.trim(),
        company: data.company.trim(),
        email: data.email.trim(),
        phone: data.phone.trim(),
        industry: selectedIndustry?.name || "General",
        solutionInterest: data.solutionInterest,
        message: data.message?.trim() || undefined,
        recaptchaToken: data.recaptchaToken ?? undefined,
        attachments: data.attachments,
        sourceUrl: typeof window !== "undefined" ? window.location.href : undefined,
      });
      setIsModalOpen(false);
      toast.success("¡Gracias por tu interés!", {
        description: "Nos pondremos en contacto contigo pronto.",
        duration: 6000,
      });
    } catch (error) {
      console.error("Error al enviar formulario:", error);
      toast.error("No pudimos enviar tu solicitud", {
        description: "Por favor intenta de nuevo en unos minutos.",
        duration: 6000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen">
      {/* Topbar secundario sticky */}
      <SecondaryNavbar
        items={[]}
        onContactClick={handleContactClick}
        brandLabel="Ventas Corporativas"
      />

      {/* Industry Selection Section */}
      <IndustrySelector
        onIndustrySelect={handleIndustrySelect}
        selectedIndustry={selectedIndustry?.id}
      />

      {/* ProductShowcase queda fuera: solo pinta el titulo "Las soluciones que
          tu empresa necesita" y un texto que promete una seleccion de
          productos, pero no muestra ninguno. Debajo quedaba una franja en
          blanco enorme hasta el pie de pagina. Volver a montarlo cuando haya
          productos que listar. */}

      {/* Modal de contacto */}
      <SpecializedConsultationModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSubmit={handleFormSubmit}
        isLoading={isSubmitting}
      />
    </main>
  );
}
