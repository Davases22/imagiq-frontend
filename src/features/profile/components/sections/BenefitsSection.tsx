import React from "react";
import { Gift, Star, ChevronRight } from "lucide-react";

import { LoyaltyProgram } from "../../types";

interface BenefitsSectionProps {
  couponsCount: number;
  loyaltyProgram?: LoyaltyProgram | null;
  onCouponsClick: () => void;
  onLoyaltyClick: () => void;
}

const BenefitsSection: React.FC<BenefitsSectionProps> = ({
  couponsCount,
  loyaltyProgram,
  onCouponsClick,
  onLoyaltyClick,
}) => {
  return (
    <div className="py-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Beneficios</h2>
      <div className="space-y-2">
        {/* Cupones */}
        <button
          onClick={onCouponsClick}
          className="w-full flex items-center justify-between p-4 bg-white rounded-3xl border-2 border-gray-200 hover:border-black transition-all"
        >
          <div className="flex items-center gap-3">
            <Gift className="w-5 h-5" />
            <span className="font-semibold">Cupones</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-black text-white text-xs font-bold px-2 py-1 rounded-full">
              {couponsCount}
            </span>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
        </button>

        {/* Programa de Lealtad */}
        <button
          onClick={onLoyaltyClick}
          className="w-full flex items-center justify-between p-4 bg-white rounded-3xl border-2 border-gray-200 hover:border-black transition-all"
        >
          <div className="flex items-center gap-3">
            <Star className="w-5 h-5" />
            <span className="font-semibold">Programa de Lealtad</span>
          </div>
          <div className="flex items-center gap-2">
            {loyaltyProgram && (
              <span className="bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-full">
                {loyaltyProgram.level || "Free"}
              </span>
            )}
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
        </button>
      </div>
    </div>
  );
};

export default BenefitsSection;
