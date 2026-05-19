"use client";
import LogoReloadAnimation from "@/app/carrito/LogoReloadAnimation";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const API_BASE_URL = "";
const POLL_INTERVAL_MS = 5000;
// Synchronous card/3DS flows resolve quickly. ADDI and PSE confirm
// asynchronously (server-to-server callback / webhook / cron) and can take
// noticeably longer, so they get a larger polling budget before we fall back
// to an informational (NOT error) page.
const MAX_RETRIES_CARD = 6; // ~30 s
const MAX_RETRIES_ASYNC = 18; // ~90 s (ADDI / PSE / unknown)

interface OrderStatusResponse {
  orderStatus: string;
  paymentMethod: string;
  createdAt: string;
}

export default function VerifyPurchase(props: Readonly<{ params: Readonly<Promise<{ id: string }>>; }>) {
  const { params } = props;
  const [orderId, setOrderId] = useState<string | null>(null);
  const router = useRouter();
  const [isLoading] = useState(true);
  const retryCountRef = useRef(0);
  const fireAndForgetSent = useRef(false);
  const paymentMethodRef = useRef<string | null>(null);

  useEffect(() => {
    params.then(({ id }) => {
      // PSE bank redirects may append query params without '?' (e.g. &transferState=rejected)
      const cleanId = id.split("&")[0];
      setOrderId(cleanId);
    });
  }, [params]);

  // Fire-and-forget: trigger backend verification ONCE so the webhook/ePayco
  // flow runs even if the user closes the tab. This is the ONLY call to
  // /verify/ — all subsequent polling uses the lightweight /status/ endpoint.
  useEffect(() => {
    if (!orderId || fireAndForgetSent.current) return;
    fireAndForgetSent.current = true;
    fetch(`${API_BASE_URL}/api/orders/verify/${orderId}`, { keepalive: true }).catch(() => {});
  }, [orderId]);

  // Poll order status from DB (lightweight, no ePayco API call).
  //
  // Robustness contract: a SINGLE non-200 / network failure must NEVER declare
  // the payment failed. ADDI/PSE confirm asynchronously (server-to-server
  // callback / webhook / cron), so the order may legitimately still be PENDING
  // when the shopper returns. We keep polling within a method-aware budget and,
  // only when that budget is exhausted, fall back to an INFORMATIONAL page for
  // async methods (the payment is most likely already captured) instead of a
  // scary "payment failed" error.
  const pollOrderStatus = useCallback(async () => {
    if (!orderId) return;

    const scheduleRetryOrFallback = () => {
      retryCountRef.current += 1;
      const method = paymentMethodRef.current;
      const maxRetries =
        method === "credit_card" ? MAX_RETRIES_CARD : MAX_RETRIES_ASYNC;

      if (retryCountRef.current < maxRetries) {
        setTimeout(() => pollOrderStatus(), POLL_INTERVAL_MS);
        return;
      }

      // Budget exhausted while still unresolved.
      if (method === "pse") {
        router.push("/error-checkout?code=PSE_TIMEOUT");
      } else if (method === "credit_card") {
        router.push(
          "/error-checkout?message=" +
            encodeURIComponent(
              "La validación del pago tardó demasiado. Intenta de nuevo.",
            ) +
            "&code=185",
        );
      } else {
        // ADDI (or method still unknown): asynchronous approval — inform the
        // user it's being confirmed rather than falsely declaring a failure.
        router.push("/error-checkout?code=ADDI_PENDING");
      }
    };

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/orders/status/${orderId}`,
      );

      if (!response.ok) {
        // Transient: 404 during a deploy, 5xx, gateway hiccup. Do NOT declare
        // the payment failed — retry within the polling budget.
        scheduleRetryOrFallback();
        return;
      }

      const data: OrderStatusResponse = await response.json();

      // Store payment method for the timeout / budget decision
      if (!paymentMethodRef.current && data.paymentMethod) {
        paymentMethodRef.current = data.paymentMethod;
      }

      const status = (data.orderStatus || "").toUpperCase();

      if (status === "APPROVED") {
        router.push(`/success-checkout/${orderId}`);
        return;
      }

      if (status === "REJECTED" || status === "DECLINED") {
        router.push(
          `/error-checkout?message=${encodeURIComponent(
            "Tu pago fue rechazado por el banco.",
          )}`,
        );
        return;
      }

      if (status === "ABANDONED" || status === "CANCELLED") {
        router.push(
          `/error-checkout?message=${encodeURIComponent(
            "El pago no se completó. Puedes intentarlo de nuevo.",
          )}`,
        );
        return;
      }

      if (status === "INTERNAL_ERROR" || status === "REVERSED") {
        router.push("/error-checkout?code=96");
        return;
      }

      // PENDING / PENDING_PAYMENT / PENDIENTE / any other non-terminal state:
      // keep polling — the ADDI callback / PSE webhook / cron will resolve it.
      scheduleRetryOrFallback();
    } catch {
      // Network error — transient. Retry within budget instead of erroring out.
      scheduleRetryOrFallback();
    }
  }, [orderId, router]);

  return (
    <div className="fixed inset-0 z-50 bg-[#0057B7]">
      <LogoReloadAnimation
        open={isLoading}
        onFinish={orderId ? pollOrderStatus : undefined}
      />
    </div>
  );
}
