"use client";
import React, { useState } from "react";
import { apiPost } from "@/lib/api-client";
import type { CartProduct, CouponRequirements } from "@/hooks/useCart";
import { fbqTrackCustom } from "@/lib/meta-pixel";
import { posthogUtils } from "@/lib/posthogClient";

interface CouponValidationResponse {
  couponCode: string;
  discountAmount: number;
  eligibleIdentifiers?: string[];
  requiredCompanionIdentifiers?: string[];
}

interface CouponInputProps {
  readonly onApply: (code: string, discount: number, requirements?: CouponRequirements) => void;
  readonly cartProducts: CartProduct[];
}

export default function CouponInput({
  onApply,
  cartProducts,
}: CouponInputProps) {
  const [code, setCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleApply = async () => {
    const trimmedCode = code.trim();
    if (!trimmedCode) return;

    setIsValidating(true);
    setError(null);

    try {
      const items = cartProducts.map((p) => ({
        sku: p.sku,
        skupostback: p.skuPostback || p.sku,
        id: p.id,
      }));

      const result = await apiPost<CouponValidationResponse>(
        "/api/payments/validate-coupon",
        { couponCode: trimmedCode, items }
      );

      onApply(result.couponCode, result.discountAmount, {
        eligibleIdentifiers: result.eligibleIdentifiers || [],
        requiredCompanionIdentifiers: result.requiredCompanionIdentifiers || [],
      });

      fbqTrackCustom("CouponApplied", {
        coupon_code: result.couponCode,
        discount_amount: result.discountAmount || 0,
        currency: "COP",
      });
      posthogUtils.capture("coupon_applied", {
        coupon_code: result.couponCode,
        discount_amount: result.discountAmount || 0,
        currency: "COP",
      });

      setCode("");
      setError(null);
      setIsOpen(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Error al validar el bono. Intenta de nuevo.";
      setError(message);
    } finally {
      setIsValidating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleApply();
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="text-sm text-gray-500 hover:text-gray-700 font-medium cursor-pointer transition-colors text-left"
      >
        ¿Tienes un código de bono?
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Código de bono"
          disabled={isValidating}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 uppercase"
        />
        <button
          type="button"
          onClick={handleApply}
          disabled={isValidating || !code.trim()}
          className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          {isValidating ? "..." : "Aplicar"}
        </button>
      </div>
      {error && <p className="text-red-500 text-xs">{error}</p>}
    </div>
  );
}
