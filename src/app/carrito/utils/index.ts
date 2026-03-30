"use client";
import { AddiPaymentData, CardPaymentData, PsePaymentData, CheckZeroInterestRequest, CheckZeroInterestResponse } from "../types";
import { apiPost, apiGet } from "@/lib/api-client";
import posthog from "posthog-js";

/** Get PostHog session tracking IDs (safe - returns empty strings if unavailable) */
function getPostHogIds() {
  try {
    if (typeof window !== "undefined" && posthog.__loaded) {
      return {
        posthogSessionId: posthog.get_session_id?.() || "",
        posthogDistinctId: posthog.get_distinct_id?.() || "",
      };
    }
  } catch { /* PostHog not available */ }
  return { posthogSessionId: "", posthogDistinctId: "" };
}

export async function payWithAddi(
  props: AddiPaymentData
): Promise<{ redirectUrl: string } | { error: string; message: string }> {
  try {
    const data = await apiPost<{ redirectUrl: string }>('/api/payments/addi/apply', props);
    return data;
  } catch (error) {
    console.error("Error initiating Addi payment:", error);
    if (error instanceof Error) {
      return { error: "payment_failed", message: error.message || "Failed to initiate Addi payment" };
    }
    return { error: "network_error", message: "Error de conexión al procesar el pago" };
  }
}

export async function payWithCard(
  props: CardPaymentData
): Promise<{ redirectionUrl: string; requires3DS?: boolean; data3DS?: unknown; orderId?: string } | { error: string; message: string }> {
  try {
    const data = await apiPost<{ redirectionUrl: string; requires3DS?: boolean; data3DS?: unknown; orderId?: string }>('/api/payments/epayco/credit-card', {
      ...props,
      dues: props.dues.trim() === "" ? "1" : props.dues,
      ...getPostHogIds(),
    });
    return data;
  } catch (error) {
    console.error("Error processing card payment:", error);
    if (error instanceof Error) {
      return { error: "payment_failed", message: error.message || "Failed to process card payment" };
    }
    return { error: "network_error", message: "Error de conexión al procesar el pago" };
  }
}

// Pagar con tarjeta guardada (token)
export async function payWithSavedCard(
  props: Omit<CardPaymentData, "cardNumber" | "cardExpMonth" | "cardExpYear" | "cardCvc"> & { cardTokenId: string }
): Promise<{ redirectionUrl: string; requires3DS?: boolean; data3DS?: unknown; orderId?: string } | { error: string; message: string }> {
  try {
    const data = await apiPost<{ redirectionUrl: string; requires3DS?: boolean; data3DS?: unknown; orderId?: string }>('/api/payments/epayco/saved-card', {
      ...props,
      dues: props.dues.trim() === "" ? "1" : props.dues,
      ...getPostHogIds(),
    });
    return data;
  } catch (error) {
    console.error("Error processing saved card payment:", error);
    if (error instanceof Error) {
      return { error: "payment_failed", message: error.message || "Failed to process saved card payment" };
    }
    return { error: "network_error", message: "Error de conexión al procesar el pago" };
  }
}

export async function payWithPse(props: PsePaymentData): Promise<{ redirectUrl: string } | { error: string; message: string }> {
  try {
    const data = await apiPost<{ redirectUrl: string }>('/api/payments/epayco/pse', {
      ...props,
      ...getPostHogIds(),
    });
    return data;
  } catch (error) {
    console.error("Error processing PSE payment:", error);
    if (error instanceof Error) {
      return { error: "payment_failed", message: error.message || "Failed to process PSE payment" };
    }
    return { error: "network_error", message: "Error de conexión al procesar el pago" };
  }
}

export async function fetchBanks(): Promise<{ bankCode: string; bankName: string }[]> {
  try {
    const data = await apiGet<{ bankCode: string; bankName: string }[]>('/api/payments/epayco/banks');
    return data;
  } catch (error) {
    // Provide detailed error information for debugging
    if (error instanceof Error) {
      console.error('API error fetching banks:', {
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    } else {
      console.error('Unknown error fetching banks:', {
        error,
        timestamp: new Date().toISOString(),
      });
    }
    throw error;
  }
}

/**
 * Check which cards are eligible for zero interest installments
 * Returns null on error to fail silently and not block the checkout flow
 */
export async function checkZeroInterest(
  request: CheckZeroInterestRequest
): Promise<CheckZeroInterestResponse | null> {
  try {
    const data = await apiPost<CheckZeroInterestResponse>('/api/payments/check-zero-interest', request);
    return data;
  } catch (error) {
    // Fail silently - don't block the checkout flow
    return null;
  }
}
