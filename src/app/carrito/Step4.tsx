"use client";
import React from "react";
import { useRouter } from "next/navigation";
import PaymentForm from "./components/PaymentForm";
import Step4OrderSummary from "./components/Step4OrderSummary";
import TradeInCompletedSummary from "@/app/productos/dispositivos-moviles/detalles-producto/estreno-y-entrego/TradeInCompletedSummary";
import Modal from "@/components/ui/Modal";
import AddCardForm, { AddCardFormHandle } from "@/components/forms/AddCardForm";
import { useCheckoutLogic } from "./hooks/useCheckoutLogic";
import { useAuthContext } from "@/features/auth/context";
import { useCart } from "@/hooks/useCart";
import {
  validateTradeInProducts,
  getTradeInValidationMessage,
} from "./utils/validateTradeIn";
import { toast } from "sonner";
import useSecureStorage from "@/hooks/useSecureStorage";
import { User } from "@/types/user";

export default function Step4({
  onBack,
  onContinue,
}: {
  onBack?: () => void;
  onContinue?: () => void;
}) {
  const router = useRouter();
  const authContext = useAuthContext();
  const { products } = useCart();
  const {
    isProcessing,
    paymentMethod,
    selectedBank,
    card,
    cardErrors,
    saveInfo,
    selectedCardId,
    useNewCard,
    isAddCardModalOpen,
    savedCardsReloadCounter,
    zeroInterestData,
    isLoadingZeroInterest,
    handleCardChange,
    handleCardErrorChange,
    handlePaymentMethodChange,
    handleBankChange,
    handleSavePaymentData,
    handleCardSelect,
    handleOpenAddCardModal,
    handleCloseAddCardModal,
    handleAddCardSuccess,
    handleUseNewCardChange,
    fetchZeroInterestInfo,
    setSaveInfo,
  } = useCheckoutLogic();
  const [loggedUser, setLoggedUser] = useSecureStorage<User | null>(
    "imagiq_user",
    null
  );
  const [isValidatingCard, setIsValidatingCard] = React.useState(false);
  const [isCardFormValid, setIsCardFormValid] = React.useState(false);
  const formRef = React.useRef<AddCardFormHandle>(null);

  // Debug: Log cuando cambia isCardFormValid
  React.useEffect(() => {
    // console.log('💳 [Step4] isCardFormValid changed to:', isCardFormValid);
  }, [isCardFormValid]);

  // Wrapper para setIsCardFormValid con logging
  const handleCardFormValidityChange = React.useCallback((isValid: boolean) => {
    // console.log('💳 [Step4] handleCardFormValidityChange called with:', isValid);
    setIsCardFormValid(isValid);
  }, []);

  // Trade-In state management - soporta múltiples productos
  const [tradeInDataMap, setTradeInDataMap] = React.useState<Record<string, {
    completed: boolean;
    deviceName: string; // Nombre del dispositivo que se entrega
    value: number;
    sku?: string; // SKU del producto que se compra
    name?: string; // Nombre del producto que se compra
    skuPostback?: string; // SKU Postback del producto que se compra
  }>>({});

  // Load Trade-In data from localStorage (nuevo formato de mapa)
  React.useEffect(() => {
    const storedTradeIn = localStorage.getItem("imagiq_trade_in");
    if (storedTradeIn) {
      try {
        const parsed = JSON.parse(storedTradeIn);
        // Verificar si es formato nuevo (mapa con SKUs como keys) o antiguo (objeto único)
        if (typeof parsed === 'object' && !parsed.deviceName) {
          // Formato nuevo: { "SKU1": { completed, deviceName, value }, ... }
          setTradeInDataMap(parsed);
        } else if (parsed.completed) {
          // Formato antiguo: { completed, deviceName, value } - convertir a mapa
          // Usar el primer producto del carrito como key si está disponible
          const firstProductSku = products.length > 0 ? products[0].sku : "legacy_tradein";
          setTradeInDataMap({ [firstProductSku]: parsed });
        }
      } catch (error) {
        console.error("Error parsing Trade-In data:", error);
      }
    }
  }, [products]);

  // Calcular ahorro total por descuentos de productos
  const productSavings = React.useMemo(() => {
    return products.reduce((total, product) => {
      if (product.originalPrice && product.originalPrice > product.price) {
        const saving = (product.originalPrice - product.price) * product.quantity;
        return total + saving;
      }
      return total;
    }, 0);
  }, [products]);

  // Helper para verificar si hay trade-in activo
  const hasActiveTradeIn = React.useMemo(() => {
    return Object.values(tradeInDataMap).some(t => t.completed);
  }, [tradeInDataMap]);

  // Helper para obtener los productos con trade-in activo
  const productsWithTradeIn = React.useMemo(() => {
    const tradeInSkus = new Set(Object.keys(tradeInDataMap).filter(sku => tradeInDataMap[sku]?.completed));
    return products.filter(p => {
      // Verificar sku, id y skuPostback para matching
      return tradeInSkus.has(p.sku) ||
             (p.id && tradeInSkus.has(p.id)) ||
             (p.skuPostback && tradeInSkus.has(p.skuPostback));
    });
  }, [products, tradeInDataMap]);

  // Handle Trade-In removal (ahora soporta eliminar por SKU)
  const handleRemoveTradeIn = (skuToRemove?: string) => {
    if (skuToRemove) {
      // Eliminar solo el SKU específico
      const updatedMap = { ...tradeInDataMap };
      delete updatedMap[skuToRemove];
      setTradeInDataMap(updatedMap);

      // Actualizar localStorage
      if (Object.keys(updatedMap).length > 0) {
        localStorage.setItem("imagiq_trade_in", JSON.stringify(updatedMap));
      } else {
        localStorage.removeItem("imagiq_trade_in");
      }
    } else {
      // Eliminar todos los trade-ins
      localStorage.removeItem("imagiq_trade_in");
      setTradeInDataMap({});
    }

    // Si se elimina el trade-in y el método está en "tienda", cambiar a "domicilio"
    if (typeof globalThis.window !== "undefined") {
      const currentMethod = globalThis.window.localStorage.getItem("checkout-delivery-method");
      if (currentMethod === "tienda") {
        globalThis.window.localStorage.setItem("checkout-delivery-method", "domicilio");
        globalThis.window.dispatchEvent(
          new CustomEvent("delivery-method-changed", { detail: { method: "domicilio" } })
        );
        globalThis.window.dispatchEvent(new Event("storage"));
      }
    }
  };

  // Estado para validación de Trade-In
  const [tradeInValidation, setTradeInValidation] = React.useState<{
    isValid: boolean;
    productsWithoutRetoma: typeof products;
    hasMultipleProducts: boolean;
    errorMessage?: string;
  }>({ isValid: true, productsWithoutRetoma: [], hasMultipleProducts: false });

  // Validar Trade-In cuando cambian los productos
  React.useEffect(() => {
    const validation = validateTradeInProducts(products);
    setTradeInValidation(validation);

    // Si el producto ya no aplica (indRetoma === 0), quitar banner inmediatamente y mostrar notificación
    if (
      !validation.isValid &&
      validation.errorMessage &&
      validation.errorMessage.includes("Te removimos")
    ) {
      // Limpiar localStorage inmediatamente
      localStorage.removeItem("imagiq_trade_in");

      // Quitar el banner inmediatamente
      setTradeInDataMap({});

      // Mostrar notificación toast
      toast.error("Cupón removido", {
        description:
          "El producto seleccionado ya no aplica para el beneficio Estreno y Entrego",
        duration: 5000,
      });
    }
  }, [products]);

  // Redirigir a Step3 si la dirección cambia desde el header
  React.useEffect(() => {
    const handleAddressChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      const fromHeader = customEvent.detail?.fromHeader;

      if (fromHeader) {
        // console.log(
//           "🔄 Dirección cambiada desde header en Step4, redirigiendo a Step3..."
//         );
        router.push("/carrito/step3");
      }
    };

    window.addEventListener(
      "address-changed",
      handleAddressChange as EventListener
    );

    return () => {
      window.removeEventListener(
        "address-changed",
        handleAddressChange as EventListener
      );
    };
  }, [router]);

  // Obtener el rol del usuario
  const userRole = React.useMemo(() => {
    return authContext.user?.rol || loggedUser?.rol || null;
  }, [authContext.user?.rol, loggedUser?.rol]);

  // Roles 2 y 4 pueden guardar tarjetas (no ven formulario de tarjeta nueva)
  const canSaveCards = userRole === 2 || userRole === 4;

  // Validar si el método de pago está seleccionado correctamente
  const isPaymentMethodValid = React.useMemo(() => {
    // Si no hay método de pago seleccionado
    if (!paymentMethod) {
      // console.log('🔴 [Step4] isPaymentMethodValid: false - no paymentMethod');
      return false;
    }

    // Si es tarjeta, debe tener una tarjeta seleccionada O estar usando una nueva Y que el formulario sea válido
    if (paymentMethod === "tarjeta") {
      // Para roles 2 y 4: deben tener tarjeta guardada seleccionada O datos de tarjeta nueva
      if (canSaveCards) {
        if (selectedCardId) return true;
        if (useNewCard && typeof window !== "undefined" && !!sessionStorage.getItem("checkout-card-data")) return true;
        return false;
      }

      // Para otros roles (ej: rol 3): pueden usar tarjeta nueva si el formulario es válido
      const isUsingNewCard = !selectedCardId;

      // console.log('🔍 [Step4] isPaymentMethodValid check:', {
//         paymentMethod,
//         selectedCardId,
//         useNewCard,
//         isUsingNewCard,
//         isCardFormValid
//       });

      if (isUsingNewCard && !isCardFormValid) {
        // console.log('🔴 [Step4] isPaymentMethodValid: false - new card but form not valid');
        return false;
      }
    }

    // Si es PSE, debe tener un banco seleccionado
    if (paymentMethod === "pse" && !selectedBank) {
      // console.log('🔴 [Step4] isPaymentMethodValid: false - PSE but no bank');
      return false;
    }

    // Si es Addi, siempre está válido (no requiere más datos)
    // console.log('🟢 [Step4] isPaymentMethodValid: true');
    return true;
  }, [paymentMethod, selectedCardId, selectedBank, useNewCard, isCardFormValid, canSaveCards]);

  const handleContinueToNextStep = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevenir recarga inmediatamente

    // Validar Trade-In antes de continuar
    const validation = validateTradeInProducts(products);
    if (!validation.isValid) {
      e.preventDefault();
      alert(getTradeInValidationMessage(validation));
      return;
    }

    // Validar y procesar formulario de tarjeta inline si corresponde
    // IMPORTANTE: Si no hay selectedCardId, significa que estamos usando tarjeta nueva
    // No depender de useNewCard porque puede no estar sincronizado
    const isUsingNewCard = paymentMethod === "tarjeta" && !selectedCardId;
    // console.log("💳 [Step4] handleContinueToNextStep:", { paymentMethod, selectedCardId, useNewCard, isUsingNewCard, hasFormRef: !!formRef.current });

    if (isUsingNewCard && formRef.current) {
      // Formulario inline (rol 3): validar y enviar
      setIsValidatingCard(true);
      try {
        const success = await formRef.current.submitForm(saveInfo);
        if (!success) {
          e.preventDefault();
          setIsValidatingCard(false);
          return;
        }
      } catch (err) {
        console.error("Error processing inline card:", err);
        setIsValidatingCard(false);
        e.preventDefault();
        return;
      }
    }

    // Sincronizar datos de tarjeta nueva (desde modal o inline) al estado card
    if (isUsingNewCard) {
      const tempCardData = sessionStorage.getItem("checkout-card-data");
      if (tempCardData) {
        const parsed = JSON.parse(tempCardData);
        handleCardChange({
          number: parsed.cardNumber || "",
          name: parsed.cardHolder || "",
          expiryMonth: parsed.cardExpMonth || "",
          expiryYear: parsed.cardExpYear || "",
          cvc: parsed.cardCvc || "",
          docType: "C.C.",
          docNumber: authContext.user?.numero_documento || loggedUser?.numero_documento || "",
          installments: "1"
        });
      }
    }

    const isValid = await handleSavePaymentData(e);
    // console.log("💳 [Step4] handleSavePaymentData result:", isValid);
    setIsValidatingCard(false); // Reset here in case validation failed or we are just moving on
    if (isValid && onContinue) {
      // console.log("💳 [Step4] isValid is true, calling onContinue()");
      onContinue();
    } else {
      console.warn("💳 [Step4] Validation failed or onContinue missing", { isValid, hasOnContinue: !!onContinue });
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center py-8 px-2 md:px-0 pb-40 md:pb-8">
      {/* Modal para agregar nueva tarjeta */}
      <Modal
        isOpen={isAddCardModalOpen}
        onClose={handleCloseAddCardModal}
        size="xl"
        showCloseButton={false}
      >
        <AddCardForm
          userId={authContext.user?.id || String(loggedUser?.id)}
          onSuccess={handleAddCardSuccess}
          onCancel={handleCloseAddCardModal}
          showAsModal={true}
        />
      </Modal>

      <div className="w-full max-w-7xl grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Formulario de pago */}
        <form
          id="checkout-form"
          className="col-span-2 flex flex-col gap-8 rounded-2xl p-8 md:min-h-[70vh]"
          onSubmit={handleContinueToNextStep}
          autoComplete="off"
        >
          {/* Payment Form */}
          <PaymentForm
            paymentMethod={paymentMethod}
            onPaymentMethodChange={handlePaymentMethodChange}
            card={card}
            cardErrors={cardErrors}
            onCardChange={handleCardChange}
            onCardErrorChange={handleCardErrorChange}
            saveInfo={saveInfo}
            onSaveInfoChange={setSaveInfo}
            selectedBank={selectedBank}
            onBankChange={handleBankChange}
            selectedCardId={selectedCardId}
            onCardSelect={handleCardSelect}
            onOpenAddCardModal={handleOpenAddCardModal}
            savedCardsReloadCounter={savedCardsReloadCounter}
            useNewCard={useNewCard}
            onUseNewCardChange={handleUseNewCardChange}
            zeroInterestData={zeroInterestData}
            isLoadingZeroInterest={isLoadingZeroInterest}
            onFetchZeroInterest={fetchZeroInterestInfo}
            formRef={formRef}
            onValidityChange={handleCardFormValidityChange}
          />
        </form>

        {/* Resumen de compra y Trade-In - Hidden en mobile */}
        <aside className="hidden md:block space-y-4 self-start sticky top-40">
          <Step4OrderSummary
            isProcessing={isProcessing || isValidatingCard}
            onFinishPayment={() => {
              const form = document.getElementById(
                "checkout-form"
              ) as HTMLFormElement;
              if (form) form.requestSubmit();
            }}
            onBack={onBack}
            buttonText="Continuar"
            buttonVariant="green"
            disabled={isProcessing || isValidatingCard || !tradeInValidation.isValid || !isPaymentMethodValid}
            isSticky={true}
            shouldCalculateCanPickUp={false}
            deliveryMethod={
              typeof window !== "undefined"
                ? (() => {
                  const method = localStorage.getItem("checkout-delivery-method");
                  if (method === "tienda") return "pickup";
                  if (method === "domicilio") return "delivery";
                  if (method === "delivery" || method === "pickup") return method;
                  return undefined;
                })()
                : undefined
            }
          />

          {/* Banner de Trade-In - Mostrar para cada producto con trade-in */}
          {Object.entries(tradeInDataMap).map(([sku, tradeIn]) => {
            if (!tradeIn?.completed) return null;
            return (
              <TradeInCompletedSummary
                key={sku}
                deviceName={tradeIn.deviceName}
                tradeInValue={tradeIn.value}
                onEdit={() => handleRemoveTradeIn(sku)}
                validationError={
                  !tradeInValidation.isValid
                    ? getTradeInValidationMessage(tradeInValidation)
                    : undefined
                }
              />
            );
          })}
        </aside>
      </div>

      {/* Sticky Bottom Bar - Solo Mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="p-4 pb-8 flex items-center justify-between gap-4">
          {/* Izquierda: Total y descuentos */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-500">
              Total ({products.reduce((acc, p) => acc + p.quantity, 0)}{" "}
              productos)
            </p>
            <p className="text-2xl font-bold text-gray-900">
              $ {Number(products.reduce((acc, p) => acc + p.price * p.quantity, 0)).toLocaleString()}
            </p>
            {/* Mostrar descuento si existe */}
            {productSavings > 0 && (
              <p className="text-sm text-green-600 font-medium">
                -$ {Number(productSavings).toLocaleString()} desc.
              </p>
            )}
          </div>

          {/* Derecha: Botón continuar - destacado con sombra y glow */}
          <button
            className={`flex-shrink-0 font-bold py-4 px-6 rounded-xl text-lg transition-all duration-200 text-white border-2 ${
              isProcessing || isValidatingCard || !tradeInValidation.isValid || !isPaymentMethodValid
                ? "bg-gray-400 border-gray-300 cursor-not-allowed"
                : "bg-green-600 border-green-500 hover:bg-green-700 hover:border-green-600 cursor-pointer shadow-lg shadow-green-500/40 hover:shadow-xl hover:shadow-green-500/50"
            }`}
            onClick={() => {
              const form = document.getElementById("checkout-form") as HTMLFormElement;
              if (form) form.requestSubmit();
            }}
            disabled={isProcessing || isValidatingCard || !tradeInValidation.isValid || !isPaymentMethodValid}
          >
            {isProcessing || isValidatingCard ? "Procesando..." : "Continuar"}
          </button>
        </div>
      </div>
    </div>
  );
}
