"use client";

import React, { useState } from "react";
import { apiClient } from "@/lib/api";
import {
  IndustrySelector,
  ProductShowcase,
} from "@/components/sections/ventas-corporativas";
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
      alert(
        "¡Gracias por tu interés! Nos pondremos en contacto contigo pronto."
      );
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error al enviar formulario:", error);
      alert(
        "Hubo un error al enviar el formulario. Por favor intenta de nuevo."
      );
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

      {/* Product Showcase Section */}
      <ProductShowcase />

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
