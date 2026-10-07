import React from "react";
import { MapPin, CreditCard, ChevronRight } from "lucide-react";

interface AccountSectionProps {
  addressesCount: number;
  paymentMethodsCount: number;
  onAddressesClick: () => void;
  onPaymentMethodsClick: () => void;
}

const AccountSection: React.FC<AccountSectionProps> = ({
  addressesCount,
  paymentMethodsCount,
  onAddressesClick,
  onPaymentMethodsClick,
}) => {
  return (
    <div className="py-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Mi cuenta</h2>
      <div className="space-y-2">
        {/* Direcciones */}
        <button
          onClick={onAddressesClick}
          className="w-full flex items-center justify-between p-4 bg-white rounded-3xl border-2 border-gray-200 hover:border-black transition-all"
        >
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5" />
            <span className="font-semibold">Direcciones</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-black text-white text-xs font-bold px-2 py-1 rounded-full">
              {addressesCount}
            </span>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
        </button>

        {/* Métodos de Pago */}
        <button
          onClick={onPaymentMethodsClick}
          className="w-full flex items-center justify-between p-4 bg-white rounded-3xl border-2 border-gray-200 hover:border-black transition-all"
        >
          <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5" />
            <span className="font-semibold">Métodos de Pago</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-black text-white text-xs font-bold px-2 py-1 rounded-full">
              {paymentMethodsCount}
            </span>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
        </button>
      </div>
    </div>
  );
};

export default AccountSection;
