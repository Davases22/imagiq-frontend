"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ProgressBar from "./ProgressBar";
import ModalFooter from "./ModalFooter";
import ModalStepContent from "./ModalStepContent";
import { useTradeInForm } from "./hooks/useTradeInForm";
import { useTradeInFlow } from "./hooks/useTradeInFlow";
import { useTradeInData } from "./hooks/useTradeInData";
import { useTradeInDataFromCache } from "@/hooks/useTradeInPrefetch";
import { useTradeInValue } from "./hooks/useTradeInValue";
import { useTradeInHandlers } from "./hooks/useTradeInHandlers";
import { isStepValid } from "./utils/stepValidation";
import { fbqTrackCustom } from "@/lib/meta-pixel";
import { posthogUtils } from "@/lib/posthogClient";

interface TradeInModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onContinue?: () => void;
  readonly onCancelWithoutCompletion?: () => void;
  readonly onCompleteTradeIn?: (deviceName: string, value: number) => void;
  readonly productSku?: string | null; // SKU del producto para el cual se está completando el trade-in
  readonly productName?: string | null; // Nombre del producto que se está comprando
  readonly skuPostback?: string | null; // SKU Postback del producto
}

export default function TradeInModal({
  isOpen,
  onClose,
  onContinue,
  onCancelWithoutCompletion,
  onCompleteTradeIn,
  productSku,
  productName,
  skuPostback,
}: TradeInModalProps) {
  const [mounted, setMounted] = useState(false);

  // Intentar obtener datos del cache primero, si no están usar el hook normal
  const { tradeInData: cachedData, loading: cacheLoading } = useTradeInDataFromCache();
  const { tradeInData: fallbackData, loading: fallbackLoading } = useTradeInData();

  // Usar datos del cache si están disponibles, sino usar los del fallback
  const tradeInData = cachedData || fallbackData;
  // Si ya tenemos datos en cache, no mostramos loading, aunque el fallback esté inicializándose
  const loadingData = cachedData ? false : (cacheLoading || fallbackLoading);

  // Datos por defecto mientras se carga la API
  const safeTradeInData = tradeInData || {
    categories: [],
    brands: [],
    models: [],
    capacities: [],
  };

  const {
    formState,
    dropdownState,
    imeiInput,
    isStep1Valid,
    availableBrands,
    availableModels,
    availableCapacities,
    setSelectedCategory,
    setSelectedBrand,
    setSelectedModel,
    setSelectedCapacity,
    setIsBrandDropdownOpen,
    setIsModelDropdownOpen,
    setIsCapacityDropdownOpen,
    setImeiInput,
    termsAccepted,
    setTermsAccepted,
    resetForm,
  } = useTradeInForm({ tradeInData: safeTradeInData, isOpen });

  const {
    flowState,
    setCurrentStep,
    handleInitialAnswer,
    handleDamageFreeAnswer,
    handleGoodConditionAnswer,
    canContinueFromStep2,
    resetFlow,
  } = useTradeInFlow();

  const { tradeInValue, calculatingValue } = useTradeInValue({
    currentStep: flowState.currentStep,
    selectedBrand: formState.selectedBrand,
    selectedCapacity: formState.selectedCapacity,
    deviceState: flowState.deviceState,
    productSku,
  });

  // Analytics: rastrear Trade-In completado justo antes de notificar al padre
  const handleCompleteTradeIn = (deviceName: string, value: number) => {
    fbqTrackCustom("TradeInCompleted", {
      device_name: deviceName,
      trade_in_value: value,
      currency: "COP",
    });
    posthogUtils.capture("trade_in_completed", {
      device_name: deviceName,
      trade_in_value: value,
      currency: "COP",
      $set: {
        has_used_trade_in: true,
        last_trade_in_value: value,
        last_trade_in_device: deviceName,
      },
    });
    onCompleteTradeIn?.(deviceName, value);
  };

  const { handleClose, getStepTitle, getContinueHandler, getBackHandler } =
    useTradeInHandlers({
      setCurrentStep,
      canContinueFromStep2,
      resetForm,
      resetFlow,
      onClose,
      onContinue,
      onCancelWithoutCompletion,
      onCompleteTradeIn: handleCompleteTradeIn,
      tradeInValue,
      imeiInput,
      selectedBrand: formState.selectedBrand,
      selectedModel: formState.selectedModel,
      selectedCapacity: formState.selectedCapacity,
      categories: safeTradeInData.categories,
      selectedCategory: formState.selectedCategory,
      deviceState: flowState.deviceState,
      flowState: {
        initialAnswers: flowState.initialAnswers,
        damageFreeAnswer: flowState.damageFreeAnswer,
        goodConditionAnswer: flowState.goodConditionAnswer,
      },
      productSku,
      productName,
      skuPostback,
    });

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Analytics: Trade-In iniciado al abrir el modal
  useEffect(() => {
    if (!isOpen) return;
    fbqTrackCustom("TradeInStarted", { currency: "COP" });
    posthogUtils.capture("trade_in_started", { source: "product_detail_page" });
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const stepTitle = getStepTitle(flowState.currentStep);
  const isCurrentStepValid = isStepValid(
    flowState.currentStep,
    isStep1Valid,
    flowState.initialAnswers,
    flowState.damageFreeAnswer,
    flowState.goodConditionAnswer,
    imeiInput,
    termsAccepted
  );

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="trade-in-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative bg-white rounded-t-3xl rounded-b-3xl w-full max-w-4xl mx-4 h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{ fontFamily: "SamsungSharpSans" }}
          >
            <button
              onClick={handleClose}
              className="absolute top-6 right-6 md:top-8 md:right-10 p-1 hover:bg-gray-100 rounded-full transition-colors z-20 bg-white"
              aria-label="Cerrar"
            >
              <X className="w-6 h-6 md:w-7 md:h-7 text-[#222]" />
            </button>

            <div className="flex-1 overflow-y-auto">
              <div className="bg-white px-6 md:px-10 pt-6 md:pt-8 pb-4">
                <div className="flex items-start justify-between gap-4 mb-4 pr-8">
                  <div className="flex-1">
                    <h2 className="text-2xl md:text-3xl font-bold text-[#222] leading-tight">
                      {stepTitle.title}
                    </h2>
                    {stepTitle.subtitle && (
                      <p className="text-xl md:text-2xl text-[#222] mt-1">
                        {stepTitle.subtitle}
                      </p>
                    )}
                  </div>
                </div>

                <ProgressBar currentStep={flowState.currentStep} />
              </div>

              <ModalStepContent
                currentStep={flowState.currentStep}
                isDisqualified={flowState.isDisqualified}
                loadingData={loadingData}
                selectedCategory={formState.selectedCategory}
                selectedBrand={formState.selectedBrand}
                selectedModel={formState.selectedModel}
                selectedCapacity={formState.selectedCapacity}
                categories={safeTradeInData.categories}
                availableBrands={availableBrands}
                availableModels={availableModels}
                availableCapacities={availableCapacities}
                isBrandDropdownOpen={dropdownState.isBrandDropdownOpen}
                isModelDropdownOpen={dropdownState.isModelDropdownOpen}
                isCapacityDropdownOpen={dropdownState.isCapacityDropdownOpen}
                screenTurnsOn={flowState.initialAnswers.screenTurnsOn}
                deviceFreeInColombia={flowState.initialAnswers.deviceFreeInColombia}
                damageFreeAnswer={flowState.damageFreeAnswer}
                goodConditionAnswer={flowState.goodConditionAnswer}
                imeiInput={imeiInput}
                tradeInValue={tradeInValue}
                calculatingValue={calculatingValue}
                termsAccepted={termsAccepted}
                onTermsAcceptedChange={setTermsAccepted}
                onSelectCategory={setSelectedCategory}
                onSelectBrand={(brand) => {
                  setSelectedBrand(brand);
                  setIsBrandDropdownOpen(false);
                }}
                onSelectModel={(model) => {
                  setSelectedModel(model);
                  setIsModelDropdownOpen(false);
                }}
                onSelectCapacity={(capacity) => {
                  setSelectedCapacity(capacity);
                  setIsCapacityDropdownOpen(false);
                }}
                onToggleBrandDropdown={() =>
                  setIsBrandDropdownOpen(!dropdownState.isBrandDropdownOpen)
                }
                onToggleModelDropdown={() =>
                  setIsModelDropdownOpen(!dropdownState.isModelDropdownOpen)
                }
                onToggleCapacityDropdown={() =>
                  setIsCapacityDropdownOpen(!dropdownState.isCapacityDropdownOpen)
                }
                onScreenTurnsOnAnswer={(answer) =>
                  handleInitialAnswer("screenTurnsOn", answer)
                }
                onDeviceFreeAnswer={(answer) =>
                  handleInitialAnswer("deviceFreeInColombia", answer)
                }
                onDamageFreeAnswer={handleDamageFreeAnswer}
                onGoodConditionAnswer={handleGoodConditionAnswer}
                onImeiChange={setImeiInput}
                onClose={handleClose}
              />
            </div>

            {!flowState.isDisqualified && (
              <ModalFooter
                currentStep={flowState.currentStep}
                isStepValid={isCurrentStepValid}
                onClose={handleClose}
                onBack={getBackHandler(flowState.currentStep)}
                onContinue={getContinueHandler(flowState.currentStep)}
              />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
