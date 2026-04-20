"use client";

import { useState } from "react";
import Button from "@/components/Button";
import { Loader } from "lucide-react";
import Link from "next/link";
import { identifyEmailEarly } from "@/lib/posthogClient";

interface EmailStepProps {
  onEmailSubmit: (email: string) => Promise<void>;
  isLoading?: boolean;
  error?: string;
}

export default function EmailStep({
  onEmailSubmit,
  isLoading = false,
  error,
}: Readonly<EmailStepProps>) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  const validateEmail = (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");

    if (!email.trim()) {
      setEmailError("Por favor ingresa tu correo electrónico");
      return;
    }

    if (!validateEmail(email)) {
      setEmailError("Por favor ingresa un correo válido");
      return;
    }

    try {
      await onEmailSubmit(email);
    } catch (err) {
      setEmailError(
        (err as Error).message || "Error al enviar el correo de recuperación"
      );
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm p-10 space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <h2 className="text-3xl font-bold text-black">
            Recuperar contraseña
          </h2>
          <p className="text-base text-gray-600">
            Ingresa tu correo electrónico y te enviaremos un código para
            restablecer tu contraseña
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="block text-base font-medium text-black mb-2"
            >
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError("");
              }}
              onBlur={(e) => identifyEmailEarly(e.target.value)}
              placeholder="ejemplo@correo.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-black placeholder-gray-400 text-base"
              disabled={isLoading}
            />
          </div>

          {/* Error Messages */}
          {(emailError || error) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{emailError || error}</p>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isLoading || !email.trim()}
            className="w-full bg-black text-white py-3 px-4 rounded-lg font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-base"
          >
            {isLoading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar código"
            )}
          </Button>
        </form>

        {/* Footer Link */}
        <div className="text-center pt-2">
          <p className="text-base text-gray-600">
            ¿Recordaste tu contraseña?{" "}
            <Link
              href="/login"
              className="text-black font-semibold hover:underline"
            >
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
