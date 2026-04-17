"use client";
import LogoReloadAnimation from "@/app/carrito/LogoReloadAnimation";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const API_BASE_URL = "";
const MAX_RETRIES = 6; // 6 × 5 seg = 30 seg max polling
const POLL_INTERVAL_MS = 5000;

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

  // Poll order status from DB (lightweight, no ePayco API call)
  const pollOrderStatus = useCallback(async () => {
    if (!orderId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/orders/status/${orderId}`);

      if (!response.ok) {
        // If status endpoint fails, fall back to error
        router.push("/error-checkout");
        return;
      }

      const data: OrderStatusResponse = await response.json();

      // Store payment method for timeout decision
      if (!paymentMethodRef.current && data.paymentMethod) {
        paymentMethodRef.current = data.paymentMethod;
      }

      if (data.orderStatus === "APPROVED") {
        router.push(`/success-checkout/${orderId}`);
        return;
      }

      if (data.orderStatus === "REJECTED") {
        router.push(`/error-checkout?message=${encodeURIComponent("Tu pago fue rechazado por el banco.")}`);
        return;
      }

      // Still pending — retry or timeout
      if (data.orderStatus === "PENDING" || data.orderStatus === "PENDING_PAYMENT" || data.orderStatus === "Pendiente") {
        retryCountRef.current += 1;

        if (retryCountRef.current >= MAX_RETRIES) {
          const method = paymentMethodRef.current || data.paymentMethod;

          if (method === "pse") {
            // PSE: informational page, NOT an error — the webhook/cron will handle it
            router.push("/error-checkout?code=PSE_TIMEOUT");
          } else {
            // Credit card / 3DS timeout
            router.push("/error-checkout?message=" + encodeURIComponent("La validación del pago tardó demasiado. Intenta de nuevo.") + "&code=185");
          }
          return;
        }

        setTimeout(() => pollOrderStatus(), POLL_INTERVAL_MS);
        return;
      }

      // Unknown state — show generic error
      router.push("/error-checkout");
    } catch {
      router.push("/error-checkout");
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
