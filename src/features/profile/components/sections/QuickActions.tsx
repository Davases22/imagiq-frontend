import React from "react";
import { ShoppingBag, CreditCard } from "lucide-react";

interface QuickActionsProps {
  onOrdersClick: () => void;
  onPaymentMethodsClick: () => void;
}

const QuickActions: React.FC<QuickActionsProps> = ({
  onOrdersClick,
  onPaymentMethodsClick,
}) => {
  return (
    <div className="py-6">
      <div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pedidos */}
          <button
            onClick={onOrdersClick}
            className="flex flex-col items-center justify-center gap-3 p-6 bg-white rounded-3xl border-2 border-gray-200 hover:border-black transition-all hover:shadow-lg"
          >
            <ShoppingBag className="w-8 h-8" />
            <span className="font-bold text-lg">Pedidos</span>
          </button>

          {/* Métodos de Pago */}
          <button
            onClick={onPaymentMethodsClick}
            className="flex flex-col items-center justify-center gap-3 p-6 bg-white rounded-3xl border-2 border-gray-200 hover:border-black transition-all hover:shadow-lg"
          >
            <CreditCard className="w-8 h-8" />
            <span className="font-bold text-lg">Métodos de Pago</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickActions;
