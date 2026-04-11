"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Plus, Check, Trash2, X } from "lucide-react";
import { CardData, CardErrors } from "./CreditCardForm";
import { PaymentMethod, CheckZeroInterestResponse } from "../types";
import { useAuthContext } from "@/features/auth/context";
import CardBrandLogo from "@/components/ui/CardBrandLogo";
import AddCardForm, { AddCardFormHandle } from "@/components/forms/AddCardForm";
import pseLogo from "@/img/iconos/logo-pse.png";
import addiLogo from "@/img/iconos/addi_negro.png";
import { fetchBanks } from "../utils";
import { useCardsCache } from "../hooks/useCardsCache";
import useSecureStorage from "@/hooks/useSecureStorage";
import { User } from "@/types/user";
import { profileService } from "@/services/profile.service";
import { toast } from "sonner";

interface PaymentFormProps {
  paymentMethod: string;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  card: CardData;
  cardErrors: CardErrors;
  onCardChange: (card: CardData) => void;
  onCardErrorChange: (errors: Partial<CardErrors>) => void;
  saveInfo: boolean;
  onSaveInfoChange: (save: boolean) => void;
  selectedBank?: string;
  onBankChange?: (bankCode: string, bankName?: string) => void;
  selectedCardId: string | null;
  onCardSelect: (cardId: string | null) => void;
  onOpenAddCardModal: () => void;
  useNewCard: boolean;
  onUseNewCardChange: (useNew: boolean) => void;
  savedCardsReloadCounter?: number;
  zeroInterestData?: CheckZeroInterestResponse | null;
  isLoadingZeroInterest?: boolean;
  onFetchZeroInterest?: (cardIds: string[]) => void;
  formRef?: React.RefObject<AddCardFormHandle | null>;
  onValidityChange?: (isValid: boolean) => void;
}

export default function PaymentForm({
  paymentMethod,
  onPaymentMethodChange,
  card,
  cardErrors,
  onCardChange,
  onCardErrorChange,
  saveInfo,
  onSaveInfoChange,
  selectedBank,
  onBankChange,
  selectedCardId,
  onCardSelect,
  onOpenAddCardModal,
  useNewCard,
  onUseNewCardChange,
  savedCardsReloadCounter,
  zeroInterestData,
  isLoadingZeroInterest,
  onFetchZeroInterest,
  formRef,
  onValidityChange,
}: PaymentFormProps) {
  const authContext = useAuthContext();
  const { savedCards, isLoadingCards, loadSavedCards } = useCardsCache();
  const [banks, setBanks] = useState<{ bankCode: string; bankName: string }[]>(
    []
  );
  const [isLoadingBanks, setIsLoadingBanks] = useState(true);
  // Hook para obtener usuario del localStorage (para usuarios sin sesión activa pero con cuenta creada en Step2)
  const [loggedUser] = useSecureStorage<User | null>("imagiq_user", null);

  // Helper para obtener el userId (autenticado o invitado)
  const getUserId = (): string | null => {
    if (authContext.user?.id) {
      return authContext.user.id;
    }
    if (loggedUser?.id) {
      return loggedUser.id;
    }

    try {
      const storedUser = localStorage.getItem("imagiq_user");
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        return parsedUser.id || null;
      }
    } catch (error) {

    }

    return null;
  };

  // Helper para obtener el rol del usuario
  const getUserRole = (): number | null => {
    if (authContext.user?.role) {
      return authContext.user.role;
    }
    if ((authContext.user as any)?.rol) {
      return (authContext.user as any).rol;
    }
    if (loggedUser?.rol) {
      return loggedUser.rol;
    }

    try {
      const storedUser = localStorage.getItem("imagiq_user");
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        return parsedUser.rol || parsedUser.role || null;
      }
    } catch (error) {
      // Ignore
    }

    return null;
  };

  const userRole = getUserRole();
  const canSaveCards = userRole === 2 || userRole === 4; // Roles 2 y 4 pueden guardar tarjetas

  // Estados para eliminar tarjeta
  const [cardToDelete, setCardToDelete] = useState<{ id: string; lastDigits: string } | null>(null);
  const [isDeletingCard, setIsDeletingCard] = useState(false);

  // Handler para eliminar tarjeta
  const handleDeleteCard = async () => {
    if (!cardToDelete) return;

    const userId = getUserId();
    if (!userId) {
      toast.error("No se pudo identificar el usuario");
      return;
    }

    setIsDeletingCard(true);
    try {
      await profileService.deleteCard(userId, cardToDelete.id);
      toast.success(`Tarjeta ****${cardToDelete.lastDigits} eliminada`);

      // Si la tarjeta eliminada era la seleccionada, limpiar selección
      if (selectedCardId === cardToDelete.id) {
        onCardSelect(null);
      }

      // Recargar tarjetas
      loadSavedCards(true);
    } catch (error) {
      console.error("Error eliminando tarjeta:", error);
      toast.error("Error al eliminar la tarjeta");
    } finally {
      setIsDeletingCard(false);
      setCardToDelete(null);
    }
  };

  // Helper para obtener el máximo de cuotas sin interés de una tarjeta
  const getMaxInstallments = (cardId: string): number | null => {
    if (!zeroInterestData?.cards) return null;

    const cardInfo = zeroInterestData.cards.find((c) => c.id === cardId);
    if (!cardInfo?.eligibleForZeroInterest) return null;

    return Math.max(...cardInfo.availableInstallments);
  };

  // Cargar bancos para PSE
  useEffect(() => {
    setIsLoadingBanks(true);
    fetchBanks()
      .then((res) => {
        setBanks(res);
      })
      .finally(() => {
        setIsLoadingBanks(false);
      });
  }, []);

  // Cargar tarjetas guardadas al montar o cuando cambia el usuario
  useEffect(() => {
    const userId = getUserId();

    if (userId) {
      loadSavedCards();
    }
  }, [authContext.user?.id, loggedUser?.id, loadSavedCards]);

  // Volver a cargar tarjetas si el contador cambia (se incrementa cuando se agrega una nueva tarjeta)
  useEffect(() => {
    const userId = getUserId();
    if (userId && savedCardsReloadCounter !== undefined && savedCardsReloadCounter > 0) {
      loadSavedCards(true); // true = forzar recarga
    }
  }, [authContext.user?.id, loggedUser?.id, savedCardsReloadCounter, loadSavedCards]);

  // Ref para trackear el último valor de savedCardsReloadCounter que se procesó
  const lastProcessedReloadCounter = React.useRef<number>(0);

  // Auto-seleccionar la tarjeta predeterminada cuando se cargan las tarjetas o después de agregar una nueva
  useEffect(() => {
    if (
      savedCards.length > 0 &&
      !isLoadingCards
    ) {
      // Verificar el método de pago guardado en localStorage
      const savedPaymentMethod = localStorage.getItem("checkout-payment-method");

      // Solo procesar si el método de pago actual o guardado es "tarjeta"
      if (paymentMethod === "tarjeta" || savedPaymentMethod === "tarjeta") {
        console.log("💳 [PaymentForm] Auto-selection check triggered", { paymentMethod, savedPaymentMethod, selectedCardId, useNewCard, savedCardsReloadCounter, lastProcessed: lastProcessedReloadCounter.current });

        // Solo auto-seleccionar si:
        // 1. No hay tarjeta seleccionada actualmente Y no hay una guardada en localStorage Y el método actual es tarjeta
        // 2. Se agregó una nueva tarjeta (savedCardsReloadCounter cambió desde la última vez que procesamos)
        const savedCardId = localStorage.getItem("checkout-saved-card-id");
        const isNewReload = savedCardsReloadCounter !== undefined && savedCardsReloadCounter > lastProcessedReloadCounter.current;
        const shouldSelectCard = (!selectedCardId && !savedCardId && paymentMethod === "tarjeta" && !useNewCard) || (isNewReload && !useNewCard);

        console.log("💳 [PaymentForm] Should select card?", shouldSelectCard, { savedCardId, savedCardsReloadCounter, isNewReload });

        if (shouldSelectCard) {
          const defaultCard =
            savedCards.find((card) => card.es_predeterminada) || savedCards[0];
          if (defaultCard) {
            console.log("💳 [PaymentForm] Auto-selecting default card", defaultCard.id);
            onCardSelect(String(defaultCard.id));
            onUseNewCardChange(false);
            // Cambiar método de pago a tarjeta si no está seleccionado
            if (paymentMethod !== "tarjeta") {
              onPaymentMethodChange("tarjeta");
            }
          }
          // Marcar este reload como procesado
          if (savedCardsReloadCounter !== undefined) {
            lastProcessedReloadCounter.current = savedCardsReloadCounter;
          }
        } else if (savedCardId && !selectedCardId && paymentMethod === "tarjeta" && !useNewCard) {
          console.log("💳 [PaymentForm] Restoring saved card from LS", savedCardId);
          // Si hay una tarjeta guardada en localStorage pero no está seleccionada en el estado, seleccionarla
          // SOLO si el método de pago actual es tarjeta
          onCardSelect(savedCardId);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedCards.length, savedCardsReloadCounter, isLoadingCards, useNewCard, paymentMethod, selectedCardId]);

  // Llamar a fetchZeroInterestInfo cuando se cargan las tarjetas
  useEffect(() => {
    if (savedCards.length > 0 && onFetchZeroInterest) {
      const cardIds = savedCards.map((card) => String(card.id));
      onFetchZeroInterest(cardIds);

      // Guardar tarjetas en localStorage para que step4/page.tsx pueda leer el tipo_tarjeta
      localStorage.setItem("checkout-cards-cache", JSON.stringify(savedCards));
    }
  }, [savedCards, onFetchZeroInterest]);


  // Filtrar tarjetas activas y no expiradas - MOSTRAR TODAS (incluyendo predeterminada)
  const activeCards = savedCards.filter((card) => {

    if (!card.activa) return false;
    if (card.fecha_vencimiento) {
      const [month, year] = card.fecha_vencimiento.split("/");
      const expDate = new Date(
        2000 + Number.parseInt(year),
        Number.parseInt(month) - 1
      );
      if (expDate < new Date()) return false;
    }
    // Incluir TODAS las tarjetas activas (sin excluir la predeterminada)
    return true;
  });


  // Mostrar skeleton completo cuando:
  // 1. Se están cargando las tarjetas inicialmente
  // 2. Se están cargando los bancos para PSE
  // 3. Se está cargando zero interest (sin importar si hay tarjetas o no)
  const shouldShowFullSkeleton =
    isLoadingCards ||
    isLoadingBanks ||
    isLoadingZeroInterest;

  if (shouldShowFullSkeleton) {
    return (
      <div>
        <div className="flex items-center gap-5 mb-4">
          <h2 className="text-[22px] font-bold">Elije como pagar</h2>
          <Image
            src="https://ics-networking.com/wp-content/uploads/2024/09/pci-dss-1.webp"
            alt="Certificación PCI DSS"
            width={45}
            height={30}
            className="object-contain"
          />
        </div>

        <div className="animate-pulse space-y-6">
          {/* Skeleton de Recomendados */}
          <div>
            <div className="h-5 w-32 bg-gray-200 rounded mb-3"></div>
            <div className="rounded-xl overflow-hidden p-6 bg-gray-100 border border-gray-200">
              <div className="space-y-4">
                <div className="h-16 bg-gray-200 rounded-lg"></div>
                <div className="h-16 bg-gray-200 rounded-lg"></div>
                <div className="h-16 bg-gray-200 rounded-lg"></div>
              </div>
            </div>
          </div>

          {/* Skeleton de Tarjetas guardadas */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="h-5 w-40 bg-gray-200 rounded"></div>
              <div className="h-9 w-24 bg-gray-200 rounded-lg"></div>
            </div>
            <div className="space-y-3">
              <div className="h-20 bg-gray-200 rounded-lg"></div>
              <div className="h-20 bg-gray-200 rounded-lg"></div>
              <div className="h-20 bg-gray-200 rounded-lg"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-5 mb-4">
        <h2 className="text-[22px] font-bold">Elije como pagar</h2>
        <Image
          src="https://ics-networking.com/wp-content/uploads/2024/09/pci-dss-1.webp"
          alt="Certificación PCI DSS"
          width={45}
          height={30}
          className="object-contain"
        />
      </div>

      {/* Sección de Recomendados */}
      <div className="mb-6">
        {/* Solo mostrar "Recomendados" para usuarios con tarjetas guardadas (rol 2 o 4) */}
        {canSaveCards && (
          <h3 className="text-base font-semibold text-gray-700 mb-3">
            Recomendados
          </h3>
        )}
        <div
          className="rounded-xl overflow-hidden"
          style={{
            boxShadow: "0 2px 8px #0001",
            background: "#F3F3F3",
            border: "1px solid #E5E5E5",
          }}
        >
          <div
            className="px-6 py-2 flex flex-col gap-2"
            style={{ background: "#fff" }}
          >
            {/* Opción: Tarjeta de crédito o débito (Nueva tarjeta) */}
            {(() => {
              const tempCardData = sessionStorage.getItem("checkout-card-data");
              const hasTempCard = !!tempCardData;
              // Para rol 2 o 4: mantener seleccionado cuando paymentMethod es tarjeta (incluso con tarjeta guardada seleccionada)
              // Para rol 3: solo seleccionado cuando no hay tarjeta guardada seleccionada
              const isCardMethodSelected = paymentMethod === "tarjeta";
              const isNewCardSelected = isCardMethodSelected && !selectedCardId;
              const shouldShowChecked = canSaveCards ? isCardMethodSelected : isNewCardSelected;

              console.log('🎯 [PaymentForm] Rendering card option:', {
                paymentMethod,
                selectedCardId,
                isNewCardSelected,
                shouldShowChecked,
                canSaveCards,
                hasOnValidityChange: !!onValidityChange,
                hasFormRef: !!formRef
              });

              return (
                <div>
                  <label className="flex items-center gap-3 justify-between py-3 cursor-pointer hover:bg-gray-50 rounded-lg transition-colors px-3 -mx-3">
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="payment"
                        checked={shouldShowChecked}
                        onChange={() => {
                          onPaymentMethodChange("tarjeta");
                          // Para rol 2/4: auto-seleccionar la primera tarjeta guardada si hay tarjetas
                          if (canSaveCards && activeCards.length > 0 && !selectedCardId) {
                            onCardSelect(String(activeCards[0].id));
                            onUseNewCardChange(false);
                          } else if (!canSaveCards) {
                            // Solo limpiar la tarjeta seleccionada para rol 3
                            onCardSelect(null);
                            onUseNewCardChange(true);
                            // Limpiar caché de datos de tarjeta por seguridad (no cachear datos de tarjetas nuevas)
                            sessionStorage.removeItem("checkout-card-data");
                          }
                        }}
                        className="accent-black w-5 h-5 flex-shrink-0"
                      />
                      <div className="flex items-center gap-2">
                        <svg className="w-8 h-8 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <rect x="2" y="5" width="20" height="14" rx="2" strokeWidth="2" />
                          <line x1="2" y1="10" x2="22" y2="10" strokeWidth="2" />
                        </svg>
                        <span className="font-medium text-black">
                          Tarjeta de crédito o débito
                        </span>
                      </div>
                    </span>
                    {hasTempCard && isNewCardSelected && (() => {
                      try {
                        const parsed = JSON.parse(tempCardData!);
                        const last4 = parsed.cardNumber?.slice(-4);
                        const brand = parsed.franchise || "";
                        const wasSaved = parsed.saved === true;
                        return (
                          <span className="flex items-center gap-2">
                            {brand && <CardBrandLogo brand={brand} size="lg" />}
                            <span className="text-xs text-gray-600 font-medium">
                              •••• {last4}
                            </span>
                            {!wasSaved && (
                              <span className="text-xs text-amber-600 font-medium">
                                No se guardará esta tarjeta
                              </span>
                            )}
                          </span>
                        );
                      } catch {
                        return (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold">
                            Ingresada
                          </span>
                        );
                      }
                    })()}
                  </label>

                  {/* Formulario inline solo para rol 3 (invitados) */}
                  {isNewCardSelected && userRole === 3 && (
                    <div className="ml-8 mb-3 mt-1">
                      <div className="p-4">
                        <AddCardForm
                          userId={getUserId() || ""}
                          embedded={true}
                          ref={formRef}
                          onValidityChange={onValidityChange}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* PSE */}
            <label className="flex items-center gap-3 justify-between py-3 cursor-pointer hover:bg-gray-50 rounded-lg transition-colors px-3 -mx-3">
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === "pse"}
                  onChange={() => {
                    onPaymentMethodChange("pse");
                    // Limpiar selección de tarjeta guardada al cambiar a PSE
                    onCardSelect(null);
                  }}
                  className="accent-black w-5 h-5 flex-shrink-0"
                />
                <span className="font-medium text-black">
                  PSE - Débito bancario
                </span>
              </span>
              <Image
                src={pseLogo}
                alt="PSE"
                width={35}
                height={35}
                className="object-contain"
              />
            </label>

            {/* Bank selector for PSE */}
            {paymentMethod === "pse" && (
              <div className="ml-8 mb-3 mt-1">
                <label
                  htmlFor="bank-select"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Selecciona tu banco
                </label>
                <select
                  id="bank-select"
                  value={selectedBank || ""}
                  onChange={(e) => {
                    const code = e.target.value;
                    const bank = banks.find((b) => b.bankCode === code);
                    onBankChange?.(code, bank?.bankName);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black bg-white"
                  required={paymentMethod === "pse"}
                >
                  <option value="">Elige tu banco...</option>
                  {banks.map((bank) => (
                    <option key={bank.bankCode} value={bank.bankCode}>
                      {bank.bankName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Addi */}
            <div className="-mx-3">
              <label className="flex items-center gap-3 justify-between cursor-pointer hover:bg-gray-50 rounded-lg transition-colors px-3">
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === "addi"}
                    onChange={() => {
                      onPaymentMethodChange("addi");
                      // Limpiar selección de tarjeta guardada al cambiar a Addi
                      onCardSelect(null);
                    }}
                    className="accent-black w-5 h-5 flex-shrink-0"
                  />
                  <span className="font-medium text-black">
                    Addi - Paga después
                  </span>
                </span>
                <Image
                  src="https://purrfecthire.com/carrousel-img/addi.png"
                  alt="Addi"
                  width={35}
                  height={35}
                  className="object-fit"
                />
              </label>
              <div className="ml-8">
                <a
                  href="https://imagiq.com.co/terminos-condiciones"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] text-blue-600 font-bold"
                >
                  3 cuotas sin interés. Aplican T&C
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sección de Tarjetas guardadas - Solo para rol 2/4 cuando método es tarjeta */}
      {paymentMethod === "tarjeta" && canSaveCards && activeCards.length > 0 ? (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-700">
              Tarjetas guardadas
            </h3>
            <button
              type="button"
              onClick={onOpenAddCardModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-black text-white hover:bg-gray-800 font-medium transition-colors rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Agregar
            </button>
          </div>

          {/* Términos y condiciones con logos de bancos */}
          <div className="mb-4 flex justify-end">
            <div className="text-center max-w-fit">
              <a
                href="/soporte/tyc-bancolombia"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-[10px] text-gray-900 hover:underline leading-tight mb-1"
              >
                Hasta 24 cuotas con <span className="font-bold">0% de interés</span>.
              </a>
              <p className="text-[6px] text-gray-900 leading-tight mb-2">
                Aplican T&C
              </p>
              <div className="flex items-center justify-center gap-2">
                <Image
                  src="https://www.bancolombia.com/wcm/connect/b8e4c3f2-36a9-497d-a125-ac04f83b0bf8/LogoBancolombia.png?MOD=AJPERES"
                  alt="Bancolombia"
                  width={28}
                  height={10}
                  className="object-contain"
                />
                <Image
                  src="https://ribgo.davivienda.com/assets/images/logo/logo-davivienda.png"
                  alt="Davivienda"
                  width={40}
                  height={14}
                  className="object-contain"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {activeCards.map((card) => {
              const isSelected =
                paymentMethod === "tarjeta" &&
                selectedCardId === String(card.id);

              return (
                <div
                  key={card.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onPaymentMethodChange("tarjeta");
                    onCardSelect(String(card.id));
                    onUseNewCardChange(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      onPaymentMethodChange("tarjeta");
                      onCardSelect(String(card.id));
                      onUseNewCardChange(false);
                    }
                  }}
                  className={`flex items-center gap-3 justify-between py-3 px-4 cursor-pointer rounded-lg border-2 transition-all ${isSelected
                    ? "border-black bg-gray-50"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                >
                  <span className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected
                        ? "border-black bg-white"
                        : "border-gray-300 bg-white"
                        }`}
                    >
                      {isSelected && (
                        <div className="w-3 h-3 rounded-full bg-black"></div>
                      )}
                    </div>
                    <CardBrandLogo brand={card.marca} size="md" />
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 tracking-wider">
                          •••• {card.ultimos_dijitos}
                        </span>
                        {card.tipo_tarjeta && (
                          <span className="text-xs text-gray-500 uppercase">
                            {card.tipo_tarjeta
                              .toUpperCase()
                              .includes("CREDIT")
                              ? "Crédito"
                              : "Débito"}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        {card.nombre_titular && (
                          <span className="uppercase">
                            {card.nombre_titular}
                          </span>
                        )}
                        {card.banco && (
                          <>
                            {card.nombre_titular && <span>•</span>}
                            <span>{card.banco}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </span>
                  <div className="flex items-center gap-2">
                    {card.es_predeterminada && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold whitespace-nowrap">
                        Predeterminada
                      </span>
                    )}
                    {(() => {
                      const maxInstallments = getMaxInstallments(
                        String(card.id)
                      );
                      return maxInstallments && maxInstallments > 1 ? (
                        <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full font-semibold whitespace-nowrap flex-shrink-0">
                          Hasta {maxInstallments} cuotas sin interés
                        </span>
                      ) : null;
                    })()}
                    {/* Botón eliminar tarjeta */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCardToDelete({
                          id: String(card.id),
                          lastDigits: card.ultimos_dijitos,
                        });
                      }}
                      className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                      title="Eliminar tarjeta"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : paymentMethod === "tarjeta" && canSaveCards ? (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-700">
              No tienes tarjetas guardadas
            </h3>
            <button
              type="button"
              onClick={onOpenAddCardModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-black text-white hover:bg-gray-800 font-medium transition-colors rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Agregar desde perfil
            </button>
          </div>

          {/* Términos y condiciones con logos de bancos */}
          <div className="mb-4 flex justify-end">
            <div className="text-center max-w-fit">
              <a
                href="/soporte/tyc-bancolombia"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-[10px] text-gray-900 hover:underline leading-tight mb-1"
              >
                Hasta 24 cuotas con <span className="font-bold">0% de interés</span>.
              </a>
              <p className="text-[6px] text-gray-900 leading-tight mb-2">
                Aplican T&C
              </p>
              <div className="flex items-center justify-center gap-2">
                <Image
                  src="https://www.bancolombia.com/wcm/connect/b8e4c3f2-36a9-497d-a125-ac04f83b0bf8/LogoBancolombia.png?MOD=AJPERES"
                  alt="Bancolombia"
                  width={28}
                  height={10}
                  className="object-contain"
                />
                <Image
                  src="https://ribgo.davivienda.com/assets/images/logo/logo-davivienda.png"
                  alt="Davivienda"
                  width={40}
                  height={14}
                  className="object-contain"
                />
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Agrega una tarjeta desde tu perfil para continuar con el pago
          </p>
        </div>
      ) : null}

      {/* Modal de confirmación para eliminar tarjeta */}
      {cardToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                Eliminar método de pago
              </h3>
              <button
                type="button"
                onClick={() => setCardToDelete(null)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <p className="text-gray-600 mb-6">
              ¿Estás seguro de que deseas eliminar la tarjeta terminada en{" "}
              <span className="font-semibold">****{cardToDelete.lastDigits}</span>?
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCardToDelete(null)}
                disabled={isDeletingCard}
                className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteCard}
                disabled={isDeletingCard}
                className="flex-1 px-4 py-2.5 bg-black text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeletingCard ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  "Eliminar"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
