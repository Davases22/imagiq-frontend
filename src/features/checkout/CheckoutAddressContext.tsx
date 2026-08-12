"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { Address } from "@/types/address";
import { AddressesService } from "@/services/addresses.service";
import { useAuthContext } from "@/features/auth/context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CheckoutAddressContextType {
  /** All addresses for the current user */
  addresses: Address[];
  /** The address selected for this checkout session */
  selectedAddress: Address | null;
  /** True while the initial fetch is in progress */
  isLoading: boolean;
  /** Select an address for checkout (also persists as default in DB) */
  selectAddress: (address: Address) => void;
  /** Re-fetch addresses from the database */
  refreshAddresses: () => Promise<void>;
}

const CheckoutAddressContext = createContext<
  CheckoutAddressContextType | undefined
>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

// Rol del usuario (2 = registrado, 3 = invitado). Solo los REGISTRADOS pueden
// ver direcciones guardadas de la cuenta; un invitado (rol 3, identificado solo
// con el email) no debe ver los datos de un tercero (parte del account takeover).
function roleFromObj(u: unknown): number | null {
  if (u && typeof u === "object") {
    const o = u as { rol?: unknown; role?: unknown };
    if (typeof o.rol === "number") return o.rol;
    if (typeof o.role === "number") return o.role;
  }
  return null;
}
function readUserRole(u: unknown): number | null {
  const fromObj = roleFromObj(u);
  if (fromObj !== null) return fromObj;
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("imagiq_user");
      if (stored) return roleFromObj(JSON.parse(stored));
    } catch {
      /* noop */
    }
  }
  return null;
}

export function CheckoutAddressProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const userId = user?.id ?? null;

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fetchedForUser = useRef<string | null>(null);

  // ---- Fetch addresses from DB ----
  const fetchAddresses = useCallback(async () => {
    // Un invitado (rol 3) NO debe ver las direcciones GUARDADAS de la cuenta: con
    // solo el email se accedería a datos de un tercero (dónde vive). Solo se usa
    // la dirección transitoria que el invitado agregó en esta sesión.
    if (!userId || readUserRole(user) !== 2) {
      try {
        const raw = localStorage.getItem("checkout-address");
        if (raw) {
          setSelectedAddress(JSON.parse(raw) as Address);
        }
      } catch { /* ignore */ }
      setAddresses([]);
      setIsLoading(false);
      return;
    }

    // Avoid re-fetching for the same user
    if (fetchedForUser.current === userId) return;

    setIsLoading(true);
    try {
      const svc = AddressesService.getInstance();
      const [all, defaultAddr] = await Promise.all([
        svc.getUserAddresses(),
        svc.getDefaultAddress("AMBOS"),
      ]);

      setAddresses(all);
      fetchedForUser.current = userId;

      // Determine which address to select:
      // 1. Address already selected in this session (user changed it in Step3)
      // 2. Default address from DB
      // 3. First address with esPredeterminada=true
      // 4. First address in the list
      setSelectedAddress((prev) => {
        if (prev && all.some((a) => a.id === prev.id)) return prev;
        if (defaultAddr) return defaultAddr;
        // Excluir direcciones de FACTURACION: nunca deben elegirse como envío
        // (si no, la última factura agregada —primera del listado— se cuela).
        const enviables = all.filter((a) => a.tipo !== "FACTURACION");
        const predeterminada = enviables.find((a) => a.esPredeterminada);
        if (predeterminada) return predeterminada;
        return enviables.length > 0 ? enviables[0] : null;
      });
    } catch (error) {
      console.error("[CheckoutAddress] Error fetching addresses:", error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, user]);

  // Fetch on mount and when user changes
  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  // ---- Write to localStorage for backward compatibility ----
  useEffect(() => {
    if (!selectedAddress) return;
    try {
      localStorage.setItem(
        "checkout-address",
        JSON.stringify(selectedAddress),
      );
    } catch { /* ignore */ }
  }, [selectedAddress]);

  // ---- Select address ----
  const selectAddress = useCallback(
    (address: Address) => {
      setSelectedAddress(address);

      // Persist as default in DB (fire-and-forget)
      if (userId) {
        AddressesService.getInstance()
          .setDefaultAddress(address.id)
          .catch((err) =>
            console.error("[CheckoutAddress] Error setting default:", err),
          );
      }
    },
    [userId],
  );

  // ---- Listen for address changes from navbar / other components ----
  useEffect(() => {
    const handleAddressChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.address) {
        setSelectedAddress(detail.address as Address);
      }
    };

    window.addEventListener("checkout-address-changed", handleAddressChange);
    return () =>
      window.removeEventListener(
        "checkout-address-changed",
        handleAddressChange,
      );
  }, []);

  return (
    <CheckoutAddressContext.Provider
      value={{
        addresses,
        selectedAddress,
        isLoading,
        selectAddress,
        refreshAddresses: fetchAddresses,
      }}
    >
      {children}
    </CheckoutAddressContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCheckoutAddress() {
  const context = useContext(CheckoutAddressContext);
  if (context === undefined) {
    throw new Error(
      "useCheckoutAddress must be used within a CheckoutAddressProvider",
    );
  }
  return context;
}
