"use client";

import React, { useState, useRef } from "react";
import ReCAPTCHA from "react-google-recaptcha";
import { ContactFormData } from "@/types/corporate-sales";
import { identifyEmailEarly } from "@/lib/posthogClient";

interface ContactFormSectionProps {
  onSubmit?: (data: ContactFormData) => void;
  isLoading?: boolean;
}

export default function ContactFormSection({
  onSubmit,
  isLoading = false,
}: ContactFormSectionProps) {
  const [formData, setFormData] = useState<ContactFormData>({
    companyName: "",
    email: "",
    firstName: "",
    lastName: "",
    industry: "",
    acceptPrivacy: false,
    acceptMarketing: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.companyName.trim()) {
      newErrors.companyName = "El nombre de la empresa es obligatorio";
    }

    if (!formData.email.trim()) {
      newErrors.email = "El correo electrónico es obligatorio";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Ingresa un correo electrónico válido";
    }

    if (!formData.firstName.trim()) {
      newErrors.firstName = "El nombre es obligatorio";
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "El apellido es obligatorio";
    }

    if (!formData.acceptPrivacy) {
      newErrors.acceptPrivacy = "Debes aceptar la política de privacidad";
    }

    if (!recaptchaToken) {
      newErrors.recaptcha = "Debes completar la verificación reCAPTCHA";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit?.(formData);
    }
  };

  const handleInputChange = (
    field: keyof ContactFormData,
    value: string | boolean
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleRecaptchaChange = (token: string | null) => {
    setRecaptchaToken(token);
    if (token && errors.recaptcha) {
      setErrors((prev) => ({ ...prev, recaptcha: "" }));
    }
  };

  return (
    <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Suscribirse</h2>
        <p className="text-gray-600 text-sm">
          Regístrate para recibir información especializada para tu empresa
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre de empresa *
          </label>
          <input
            type="text"
            value={formData.companyName}
            onChange={(e) => handleInputChange("companyName", e.target.value)}
            className={`w-full px-4 py-3 border-b-2 bg-transparent focus:outline-none transition-colors ${
              errors.companyName
                ? "border-red-500"
                : "border-gray-300 focus:border-blue-500"
            }`}
            placeholder="Tu empresa"
          />
          {errors.companyName && (
            <p className="text-red-500 text-xs mt-1">{errors.companyName}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dirección de correo electrónico *
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange("email", e.target.value)}
            onBlur={(e) => identifyEmailEarly(e.target.value)}
            className={`w-full px-4 py-3 border-b-2 bg-transparent focus:outline-none transition-colors ${
              errors.email
                ? "border-red-500"
                : "border-gray-300 focus:border-blue-500"
            }`}
            placeholder="correo@empresa.com"
          />
          {errors.email && (
            <p className="text-red-500 text-xs mt-1">{errors.email}</p>
          )}
        </div>

        {/* Name and Last Name */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre *
            </label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => handleInputChange("firstName", e.target.value)}
              className={`w-full px-4 py-3 border-b-2 bg-transparent focus:outline-none transition-colors ${
                errors.firstName
                  ? "border-red-500"
                  : "border-gray-300 focus:border-blue-500"
              }`}
              placeholder="Tu nombre"
            />
            {errors.firstName && (
              <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Apellido *
            </label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => handleInputChange("lastName", e.target.value)}
              className={`w-full px-4 py-3 border-b-2 bg-transparent focus:outline-none transition-colors ${
                errors.lastName
                  ? "border-red-500"
                  : "border-gray-300 focus:border-blue-500"
              }`}
              placeholder="Tu apellido"
            />
            {errors.lastName && (
              <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>
            )}
          </div>
        </div>

        {/* Checkboxes */}
        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <input
              type="checkbox"
              id="privacy"
              checked={formData.acceptPrivacy}
              onChange={(e) =>
                handleInputChange("acceptPrivacy", e.target.checked)
              }
              className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="privacy" className="text-sm text-gray-700">
              He leído y acepto la Política de privacidad de Samsung.
              <span className="text-red-500"> *</span>
              <div className="text-gray-500 text-xs mt-1">* Obligatorio</div>
            </label>
          </div>

          <div className="flex items-start space-x-3">
            <input
              type="checkbox"
              id="marketing"
              checked={formData.acceptMarketing}
              onChange={(e) =>
                handleInputChange("acceptMarketing", e.target.checked)
              }
              className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="marketing" className="text-sm text-gray-700">
              Me gustaría recibir información sobre productos, servicios,
              promociones y comunicaciones de marketing de Samsung o sus socios.
              <div className="text-gray-500 text-xs mt-1">* Obligatorio</div>
            </label>
          </div>
        </div>

        {errors.acceptPrivacy && (
          <p className="text-red-500 text-xs">{errors.acceptPrivacy}</p>
        )}

        {/* reCAPTCHA Real */}
        <div className="flex justify-center">
          <ReCAPTCHA
            ref={recaptchaRef}
            sitekey={
              process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ||
              "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"
            }
            onChange={handleRecaptchaChange}
            onExpired={() => handleRecaptchaChange(null)}
            onError={() => handleRecaptchaChange(null)}
          />
        </div>
        {errors.recaptcha && (
          <p className="text-red-500 text-xs text-center">{errors.recaptcha}</p>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading || !recaptchaToken}
          className="w-full bg-black hover:bg-gray-800 text-white font-semibold py-3 px-6 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Enviando..." : "Enviar"}
        </button>
      </form>
    </div>
  );
}
