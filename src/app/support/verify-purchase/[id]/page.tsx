"use client";
import LogoReloadAnimation from "@/app/carrito/LogoReloadAnimation";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet } from "@/lib/api-client";

const API_BASE_URL = "";

interface SupportVerifyResult {
  status?: number | string;
  requiresAction?: boolean;
  message?: string;
  [key: string]: unknown;
}

export default function VerifySupportPurchase(
  props: Readonly<{ params: Readonly<Promise<{ id: string }>> }>
) {
  const { params } = props;
  const [orderId, setOrderId] = useState<string | null>(null);
  const router = useRouter();
  const [isLoading] = useState(true);
  const fireAndForgetSent = useRef(false);

  useEffect(() => {
    params.then(({ id }) => {
      // PSE bank redirects may append query params without '?' (e.g. &transferState=rejected)
      // which Next.js captures as part of the [id] param. Strip anything after the UUID.
      const cleanId = id.split("&")[0];
      setOrderId(cleanId);
    });
  }, [params]);

  // Fire-and-forget: trigger backend verification immediately so it runs
  // even if the user closes the tab before the animation finishes.
  useEffect(() => {
    if (!orderId || fireAndForgetSent.current) return;
    fireAndForgetSent.current = true;
    fetch(`${API_BASE_URL}/api/orders/support/verify/${orderId}`, { keepalive: true }).catch(() => {});
  }, [orderId]);

  const verifySupportOrder = useCallback(async () => {
    if (!orderId) return;

    console.log(
      "🔍 [VERIFY-SUPPORT] Iniciando verificación para orden de soporte:",
      orderId
    );

    try {
      const data = await apiGet<SupportVerifyResult>(
        `/api/orders/support/verify/${orderId}`
      );
      console.log(
        "📦 [VERIFY-SUPPORT] Response data completo:",
        JSON.stringify(data, null, 2)
      );

      // Handle pending with additional action (if payments-ms returns such field)
      if (data?.status === "PENDING" && data.requiresAction) {
        console.log(
          "⏳ [VERIFY-SUPPORT] Transacción pendiente de validación. Reintentando en 5s..."
        );
        setTimeout(() => verifySupportOrder(), 5000);
        return;
      }

      // For support orders we use dedicated support screens. Redirect back to the
      // support start page and include status and orderId as query params so that
      // the UI can show appropriate messages.
      const target = (s: string) =>
        `/soporte/inicio_de_soporte?status=${encodeURIComponent(
          s
        )}&orderId=${encodeURIComponent(orderId)}`;

      if (data?.status === 200 || data?.status === "APPROVED") {
        console.log(
          "✅ [VERIFY-SUPPORT] Pago aprobado, redirigiendo a soporte..."
        );
        router.push(target("APPROVED"));
      } else if (data?.status === "PENDING") {
        console.log(
          "⏳ [VERIFY-SUPPORT] Pago pendiente. Redirigiendo a soporte para estado pendiente..."
        );
        router.push(target("PENDING"));
      } else {
        console.error("❌ [VERIFY-SUPPORT] Pago rechazado o error:", data);
        router.push(target("REJECTED"));
      }
    } catch (error) {
      console.error(
        "💥 [VERIFY-SUPPORT] Error verificando orden de soporte:",
        error
      );
      // If verification fails unexpectedly, show the support-specific error screen
      router.push(
        `/support/error-checkout?orderId=${encodeURIComponent(
          orderId ?? ""
        )}&status=REJECTED`
      );
    }
  }, [orderId, router]);

  return (
    <div className="fixed inset-0 z-50 bg-[#0057B7]">
      <LogoReloadAnimation
        open={isLoading}
        onFinish={orderId ? verifySupportOrder : undefined}
      />
    </div>
  );
}
