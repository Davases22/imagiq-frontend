"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Step4OrderSummary from "./components/Step4OrderSummary";
import TradeInCompletedSummary from "@/app/productos/dispositivos-moviles/detalles-producto/estreno-y-entrego/TradeInCompletedSummary";
import { useCart } from "@/hooks/useCart";
import { validateTradeInProducts, getTradeInValidationMessage } from "./utils/validateTradeIn";
import { toast } from "sonner";
import { CheckZeroInterestResponse } from "./types";
import { DBCard } from "@/features/profile/types";
import CardBrandLogo from "@/components/ui/CardBrandLogo";

interface Step5Props {
  onBack?: () => void;
  onContinue?: () => void;
}

interface InstallmentOption {
  installments: number;
  installmentAmount: number;
  totalAmount: number;
  interestRate: number;
  hasInterest: boolean;
}

export default function Step5({ onBack, onContinue }: Step5Props) {
  const router = useRouter();
  const { calculations, products } = useCart();
  const [selectedInstallments, setSelectedInstallments] = useState<number | null>(null);
  const [zeroInterestData, setZeroInterestData] = useState<CheckZeroInterestResponse | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [savedCards, setSavedCards] = useState<DBCard[]>([]);

  // Trade-In state management - soporta múltiples productos
  const [tradeInDataMap, setTradeInDataMap] = useState<Record<string, {
    completed: boolean;
    deviceName: string; // Nombre del dispositivo que se entrega
    value: number;
    sku?: string; // SKU del producto que se compra
    name?: string; // Nombre del producto que se compra
    skuPostback?: string; // SKU Postback del producto que se compra
  }>>({});

  // Estado para tarjeta temporal
  const [tempCard, setTempCard] = useState<{
    cardNumber: string;
    cardHolder: string;
    cardType?: string;
    franchise?: string;
    bankName?: string;
  } | null>(null);

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

  // Cargar cuotas guardadas de localStorage
  useEffect(() => {
    // console.log("🚀 [Step5] Mounting Step5 component");

    const savedInstallments = localStorage.getItem("checkout-installments");
    if (savedInstallments) {
      setSelectedInstallments(parseInt(savedInstallments));
    }

    // Cargar datos de cuotas sin interés
    try {
      const stored = localStorage.getItem("checkout-zero-interest");
      if (stored) {
        const parsed = JSON.parse(stored) as CheckZeroInterestResponse;
        setZeroInterestData(parsed);
      }
    } catch (error) {
      console.error("Error loading zero interest data:", error);
    }

    // Cargar ID de tarjeta seleccionada
    const cardId = localStorage.getItem("checkout-saved-card-id");
    // console.log("💳 [Step5] Saved Card ID:", cardId);
    setSelectedCardId(cardId);

    // Cargar tarjeta temporal si no hay tarjeta guardada
    if (!cardId) {
      const tempCardData = sessionStorage.getItem("checkout-card-data");
      // console.log("💳 [Step5] Temp Card Data exists:", !!tempCardData);
      if (tempCardData) {
        try {
          const parsed = JSON.parse(tempCardData);
          setTempCard(parsed);
        } catch (e) {
          console.error("Error parsing temp card data:", e);
        }
      }
    }

    // Cargar tarjetas guardadas desde el cache
    try {
      const cardsData = localStorage.getItem("checkout-cards-cache");
      if (cardsData) {
        const parsed = JSON.parse(cardsData) as DBCard[];
        setSavedCards(parsed);
      }
    } catch (error) {
      console.error("Error loading saved cards:", error);
    }

    // Load Trade-In data (nuevo formato de mapa)
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
          setTradeInDataMap({ "legacy_tradein": parsed });
        }
      } catch (error) {
        console.error("Error parsing Trade-In data:", error);
      }
    }
  }, []);

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
  const [tradeInValidation, setTradeInValidation] = useState<{
    isValid: boolean;
    productsWithoutRetoma: typeof products;
    hasMultipleProducts: boolean;
    errorMessage?: string;
  }>({ isValid: true, productsWithoutRetoma: [], hasMultipleProducts: false });

  // Validar Trade-In cuando cambian los productos
  useEffect(() => {
    const validation = validateTradeInProducts(products);
    setTradeInValidation(validation);

    // Si el producto ya no aplica (indRetoma === 0), quitar banner inmediatamente y mostrar notificación
    if (!validation.isValid && validation.errorMessage && validation.errorMessage.includes("Te removimos")) {
      // Limpiar localStorage inmediatamente
      localStorage.removeItem("imagiq_trade_in");

      // Quitar el banner inmediatamente
      setTradeInDataMap({});

      // Mostrar notificación toast
      toast.error("Cupón removido", {
        description: "El producto seleccionado ya no aplica para el beneficio Estreno y Entrego",
        duration: 5000,
      });
    }
  }, [products]);

  // Redirigir a Step3 si la dirección cambia desde el header
  useEffect(() => {
    const handleAddressChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      const fromHeader = customEvent.detail?.fromHeader;

      if (fromHeader) {
        // console.log('🔄 Dirección cambiada desde header en Step5, redirigiendo a Step3...');
        router.push('/carrito/step3');
      }
    };

    window.addEventListener('address-changed', handleAddressChange as EventListener);

    return () => {
      window.removeEventListener('address-changed', handleAddressChange as EventListener);
    };
  }, [router]);

  // Calcular opciones de cuotas basadas en el total del carrito
  const calculateInstallments = (): InstallmentOption[] => {
    const total = calculations.total;

    return [
      {
        installments: 1,
        installmentAmount: total,
        totalAmount: total,
        interestRate: 0,
        hasInterest: false,
      },
      {
        installments: 2,
        installmentAmount: total / 2,
        totalAmount: total,
        interestRate: 0,
        hasInterest: false,
      },
      {
        installments: 3,
        installmentAmount: total / 3,
        totalAmount: total,
        interestRate: 0,
        hasInterest: false,
      },
      {
        installments: 6,
        installmentAmount: total / 6,
        totalAmount: total,
        interestRate: 0,
        hasInterest: false,
      },
      {
        installments: 9,
        installmentAmount: total / 9,
        totalAmount: total,
        interestRate: 0,
        hasInterest: false,
      },
      {
        installments: 12,
        installmentAmount: total / 12,
        totalAmount: total,
        interestRate: 0,
        hasInterest: false,
      },
      {
        installments: 15,
        installmentAmount: total / 15,
        totalAmount: total,
        interestRate: 0,
        hasInterest: false,
      },
      {
        installments: 24,
        installmentAmount: total / 24,
        totalAmount: total,
        interestRate: 0,
        hasInterest: false,
      },
    ];
  };

  const installmentOptions = calculateInstallments();

  const handleInstallmentSelect = (installments: number) => {
    setSelectedInstallments(installments);
  };

  const handleContinue = () => {
    // Validar Trade-In antes de continuar
    const validation = validateTradeInProducts(products);
    if (!validation.isValid) {
      alert(getTradeInValidationMessage(validation));
      return;
    }

    if (selectedInstallments === null) {
      return;
    }

    // Guardar cuotas seleccionadas en localStorage
    localStorage.setItem("checkout-installments", selectedInstallments.toString());

    if (onContinue) {
      onContinue();
    }
  };

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Verificar si una cuota es elegible para cero interés
  const isInstallmentEligibleForZeroInterest = (installments: number): boolean => {
    if (!zeroInterestData?.cards || !selectedCardId) return false;

    const cardInfo = zeroInterestData.cards.find(c => c.id === selectedCardId);
    if (!cardInfo?.eligibleForZeroInterest) return false;

    return cardInfo.availableInstallments.includes(installments);
  };

  return (
    <div className="min-h-screen w-full pb-40 md:pb-0">
      <div className="w-full max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulario de selección de cuotas */}
          <div className="lg:col-span-2 space-y-4 lg:min-h-[70vh]">
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              {/* Título y tarjeta seleccionada */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[22px] font-bold">Elige las cuotas</h2>
                {/* Lógica para mostrar tarjeta seleccionada o temporal */}
                {(() => {
                  if (selectedCardId) {
                    const selectedCard = savedCards.find(card => String(card.id) === selectedCardId);

                    if (!selectedCard) {
                      return (
                        <p className="text-sm text-gray-600">
                          Tarjeta terminada en •••• {selectedCardId.slice(-4)}
                        </p>
                      );
                    }

                    return (
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0">
                          <CardBrandLogo brand={selectedCard.marca} size="lg" />
                        </div>
                        <div className="flex flex-col items-end">
                          <p className="font-bold text-gray-900 tracking-wider text-sm">
                            •••• {selectedCard.ultimos_dijitos}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            {selectedCard.banco && <span>{selectedCard.banco}</span>}
                            {selectedCard.nombre_titular && (
                              <>
                                {selectedCard.banco && <span>•</span>}
                                <span className="uppercase truncate max-w-[120px]">
                                  {selectedCard.nombre_titular}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Si no hay tarjeta guardada, verificar temporal
                  if (tempCard) {
                    return (
                      <div className="flex items-center gap-3">
                        {/* Intentar mostrar logo si tenemos info de franquicia, sino genérico */}
                        <div className="flex-shrink-0">
                          {/* CardBrandLogo maneja 'unknown' o strings genéricos */}
                          <CardBrandLogo brand={tempCard.franchise || "unknown"} size="lg" />
                        </div>
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            {tempCard.bankName ? (
                              <span className="font-medium">{tempCard.bankName}</span>
                            ) : (
                              <span className="bg-gray-100 px-2 py-0.5 rounded text-[10px] font-medium uppercase">
                                Tarjeta Nueva
                              </span>
                            )}
                            {tempCard.cardHolder && (
                              <>
                                <span>•</span>
                                <span className="uppercase truncate max-w-[120px]">
                                  {tempCard.cardHolder}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return null;
                })()}
              </div>

              {/* Nota sobre intereses */}
              <p className="text-sm text-gray-600 mb-6">
                * Los intereses serán manejados por tu entidad bancaria.
              </p>

              {/* Opciones de cuotas */}
              <div className="space-y-3">
                {installmentOptions.map((option) => {
                  const isZeroInterest = isInstallmentEligibleForZeroInterest(option.installments);

                  return (
                    <label
                      key={option.installments}
                      className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedInstallments === option.installments
                        ? "border-black bg-gray-50"
                        : "border-gray-200 hover:border-gray-300"
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="installments"
                          value={option.installments}
                          checked={selectedInstallments === option.installments}
                          onChange={() => handleInstallmentSelect(option.installments)}
                          className="w-4 h-4 accent-black"
                        />
                        <div>
                          <p className="font-semibold text-gray-900">
                            {option.installments}x {formatPrice(option.installmentAmount)}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        {isZeroInterest ? (
                          <p className="text-sm font-semibold text-green-600">
                            0% de interés
                          </p>
                        ) : (
                          <p className="text-sm text-gray-600">
                            {formatPrice(option.totalAmount)} *
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Resumen de compra y Trade-In - Hidden en mobile */}
          <aside className="hidden md:block lg:col-span-1 space-y-4 self-start sticky top-40">
            <Step4OrderSummary
              onFinishPayment={handleContinue}
              onBack={onBack}
              buttonText="Continuar"
              buttonVariant="green"
              disabled={selectedInstallments === null || !tradeInValidation.isValid}
              isSticky={true}
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
                  validationError={!tradeInValidation.isValid ? getTradeInValidationMessage(tradeInValidation) : undefined}
                />
              );
            })}
          </aside>
        </div>
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
              $ {Number(calculations.total).toLocaleString()}
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
              selectedInstallments === null || !tradeInValidation.isValid
                ? "bg-gray-400 border-gray-300 cursor-not-allowed"
                : "bg-green-600 border-green-500 hover:bg-green-700 hover:border-green-600 cursor-pointer shadow-lg shadow-green-500/40 hover:shadow-xl hover:shadow-green-500/50"
            }`}
            onClick={handleContinue}
            disabled={selectedInstallments === null || !tradeInValidation.isValid}
          >
            Continuar
          </button>
        </div>
      </div>
    </div >
  );
}
