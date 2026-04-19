"use client";

import React, { useState, useRef } from "react";
import ReCAPTCHA from "react-google-recaptcha";
import Modal from "@/components/Modal";
import FormField from "./FormField";
import LoadingButton from "./LoadingButton";
import {
  SpecializedConsultationFormData,
  SolutionInterestOption,
} from "@/types/corporate-sales";
import { identifyEmailEarly } from "@/lib/posthogClient";

interface SpecializedConsultationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: SpecializedConsultationFormData) => void;
  isLoading?: boolean;
}

const SOLUTION_OPTIONS: Array<{ id: SolutionInterestOption; label: string }> = [
  { id: "mobile", label: "Mobile" },
  { id: "electrodomesticos", label: "Electrodomésticos" },
  { id: "pantallas", label: "Pantallas" },
  { id: "climatizacion", label: "Climatización" },
];

const INPUT_CLASS = "w-full px-0 py-3 border-0 border-b border-gray-300 bg-transparent focus:outline-none focus:border-blue-500 transition-colors text-gray-900";

export default function SpecializedConsultationModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: SpecializedConsultationModalProps) {
  const [formData, setFormData] = useState<SpecializedConsultationFormData>({
    fullName: "",
    phone: "",
    company: "",
    email: "",
    solutionInterest: [],
    message: "",
    acceptPrivacy: false,
    recaptchaToken: null,
  });

  const recaptchaRef = useRef<ReCAPTCHA>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = "Nombres y apellidos son obligatorios";
    }
    if (!formData.phone.trim()) {
      newErrors.phone = "El teléfono es obligatorio";
    }
    if (!formData.company.trim()) {
      newErrors.company = "La empresa es obligatoria";
    }
    if (!formData.email.trim()) {
      newErrors.email = "El email es obligatorio";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Ingresa un email válido";
    }
    if (!formData.acceptPrivacy) {
      newErrors.acceptPrivacy = "Debes aceptar la política de privacidad";
    }
    if (!formData.recaptchaToken) {
      newErrors.recaptchaToken = "Debes completar la verificación reCAPTCHA";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const clearError = (field: string): void => {
    setErrors(prev => ({ ...prev, [field]: "" }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit?.(formData);
    }
  };

  const handleInputChange = (
    field: keyof SpecializedConsultationFormData,
    value: string | boolean | string[] | null
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) clearError(field);
  };

  const handleSolutionToggle = (solutionId: SolutionInterestOption) => {
    const newSolutions = formData.solutionInterest.includes(solutionId)
      ? formData.solutionInterest.filter((id) => id !== solutionId)
      : [...formData.solutionInterest, solutionId];
    handleInputChange("solutionInterest", newSolutions);
  };

  const footerContent = (
    <div className="flex flex-col gap-3">
      <div className="flex items-start space-x-3">
        <input
          type="checkbox"
          id="consultationPrivacy"
          checked={formData.acceptPrivacy}
          onChange={(e) => handleInputChange("acceptPrivacy", e.target.checked)}
          className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
          disabled={isLoading}
        />
        <label htmlFor="consultationPrivacy" className="text-sm text-gray-700 leading-relaxed">
          Acepto la <a href="#" className="text-blue-600 underline hover:text-blue-800 transition-colors">política de privacidad de Samsung Electronics S.A.</a>
          <div className="text-gray-500 text-xs mt-1">* Obligatorio</div>
        </label>
      </div>
      {errors.acceptPrivacy && <p className="text-red-500 text-xs">{errors.acceptPrivacy}</p>}
      <LoadingButton type="submit" form="consultation-form" isLoading={isLoading}>Enviar</LoadingButton>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Solicita una asesoría especializada"
      size="lg"
      isLoading={isLoading}
      preventCloseOnOverlay={isLoading}
      preventCloseOnEsc={isLoading}
      footer={footerContent}
    >
      <form
        id="consultation-form"
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <div className="grid md:grid-cols-2 gap-4">
          <FormField label="Nombres y Apellidos" required error={errors.fullName}>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => handleInputChange("fullName", e.target.value)}
              className={`${INPUT_CLASS} ${errors.fullName ? "border-red-500" : ""}`}
              disabled={isLoading}
            />
          </FormField>
          <FormField label="Teléfono" required error={errors.phone}>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleInputChange("phone", e.target.value)}
              className={`${INPUT_CLASS} ${errors.phone ? "border-red-500" : ""}`}
              disabled={isLoading}
            />
          </FormField>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <FormField label="Empresa" required error={errors.company}>
            <input
              type="text"
              value={formData.company}
              onChange={(e) => handleInputChange("company", e.target.value)}
              className={`${INPUT_CLASS} ${errors.company ? "border-red-500" : ""}`}
              disabled={isLoading}
            />
          </FormField>
          <FormField label="Email" required error={errors.email}>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              onBlur={(e) => identifyEmailEarly(e.target.value)}
              className={`${INPUT_CLASS} ${errors.email ? "border-red-500" : ""}`}
              disabled={isLoading}
            />
          </FormField>
        </div>

        {/* Solution Interest */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Solución de interés{" "}
            <span className="text-gray-500">* Obligatorio</span>
          </label>
          <div className="grid grid-cols-2 gap-4">
            {SOLUTION_OPTIONS.map((option) => (
              <label
                key={option.id}
                className="flex items-center space-x-3 cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={formData.solutionInterest.includes(option.id)}
                  onChange={() => handleSolutionToggle(option.id)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                  disabled={isLoading}
                />
                <span className="text-gray-700 group-hover:text-gray-900 transition-colors select-none">
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Message */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Mensaje
          </label>
          <textarea
            value={formData.message}
            onChange={(e) => handleInputChange("message", e.target.value)}
            rows={3}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-gray-900"
            placeholder="Cuéntanos más sobre tus necesidades..."
            disabled={isLoading}
          />
        </div>

        <div className="flex flex-col items-center gap-2">
          <ReCAPTCHA
            ref={recaptchaRef}
            sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"}
            onChange={(token) => handleInputChange("recaptchaToken", token)}
            onExpired={() => handleInputChange("recaptchaToken", null)}
            onError={() => handleInputChange("recaptchaToken", null)}
          />
          {errors.recaptchaToken && <p className="text-red-500 text-xs">{errors.recaptchaToken}</p>}
        </div>
      </form>
    </Modal>
  );
}
