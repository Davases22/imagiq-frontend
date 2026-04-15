// -------------------------------------------------------------
// 📊 Cliente PostHog para Analytics y Session Replay
// -------------------------------------------------------------
// Este archivo gestiona la integración con PostHog:
// - Inicializa el SDK y configura el cliente
// - Permite capturar eventos personalizados, vistas de página, replays de sesión
// - Proporciona utilidades para identificar usuarios, evaluar feature flags y controlar la sesión
// - Los datos NO se almacenan localmente, se envían a los servidores de PostHog
// -------------------------------------------------------------

"use client";
/**
 * Cliente y configuración de PostHog
 * - Inicialización del SDK de PostHog
 * - Configuración de session replays
 * - Setup de feature flags
 * - Configuración de A/B testing
 * - Heat maps y event capture
 * - GDPR compliance settings
 */

import posthog from "posthog-js";
import type { CapturedNetworkRequest } from "posthog-js";
import type { CampaignData } from "@/components/InWebCampaign/types";

// Configuración de claves y host de PostHog
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || "";
// Use reverse proxy (/ingest) to bypass ad blockers; fall back to direct host
const POSTHOG_HOST =
  typeof window !== "undefined" ? "/ingest" : (process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com");

// Configuración avanzada del cliente PostHog
export const posthogConfig = {
  api_host: POSTHOG_HOST, // Proxied through Next.js rewrites to avoid ad blockers
  ui_host: "https://us.posthog.com", // Keep UI links pointing to PostHog directly
  loaded: (_posthog: unknown) => {
    // Callback cuando PostHog se carga correctamente
  },
  capture_pageview: true, // Captura vistas de página automáticamente
  capture_pageleave: true, // Captura cuando el usuario abandona la página
  capture_performance: {
    network_timing: true,
    web_vitals: true,
  },
  session_recording: {
    enabled: true, // Habilita grabación de sesión
    maskAllInputs: true, // Oculta inputs sensibles
    maskAllText: false,
    recordCrossOriginIframes: false,
    recordHeaders: true,
    recordBody: true,
    // Replace PostHog's aggressive default scrubbing (which redacts ANY body
    // containing "token", "auth", etc.) with targeted field-level redaction.
    maskCapturedNetworkRequestFn: (request: CapturedNetworkRequest) => {
      // Don't capture payment processor or third-party requests at all
      if (
        request.name.includes("epayco.co") ||
        request.name.includes("stripe.com") ||
        request.name.includes("mercadopago.com") ||
        request.name.includes("addi.com") ||
        request.name.includes("facebook.com") ||
        request.name.includes("sentry.io") ||
        request.name.includes("clarity.ms")
      ) {
        return null;
      }

      // Keys that must be fully redacted
      const fullyRedactedKeys = [
        "cardCvc", "cvc", "cvv", "cardExpYear", "cardExpMonth",
        "password", "contrasena", "clave",
        "cardTokenId", "token", "codigo_seguridad",
      ];
      // Keys containing card numbers — show first 6 digits (BIN) for debug
      const cardNumberKeys = [
        "cardNumber", "card_number", "numero_tarjeta",
      ];

      const truncateCard = (val: unknown): string => {
        const s = String(val).replace(/\D/g, "");
        if (s.length <= 6) return s;
        return s.slice(0, 6) + "••••••" + (s.length > 12 ? s.slice(-4) : "");
      };

      const redactBody = (raw: string | null | undefined): string | null => {
        if (!raw) return null;
        try {
          const body = JSON.parse(raw);
          for (const key of fullyRedactedKeys) {
            if (key in body) body[key] = "[REDACTED]";
          }
          for (const key of cardNumberKeys) {
            if (key in body) body[key] = truncateCard(body[key]);
          }
          // Redact card holder to initials for privacy but keep for debug
          if (body.cardHolder) body.cardHolder = body.cardHolder.split(" ").map((w: string) => w[0] || "").join(".");
          if (body.card_holder) body.card_holder = body.card_holder.split(" ").map((w: string) => w[0] || "").join(".");
          if (body.userInfo?.password) body.userInfo.password = "[REDACTED]";
          return JSON.stringify(body);
        } catch {
          // Not valid JSON — discard body entirely to prevent leaking sensitive data
          return null;
        }
      };

      request.requestBody = redactBody(request.requestBody);
      request.responseBody = redactBody(request.responseBody);

      // Redact auth headers
      if (request.requestHeaders) {
        const h = request.requestHeaders as Record<string, string>;
        if (h["authorization"] || h["Authorization"]) {
          h["authorization"] = "[REDACTED]";
          h["Authorization"] = "[REDACTED]";
        }
      }

      return request;
    },
  },
  autocapture: {
    enabled: true, // Captura automática de clicks y acciones
    css_selector_allowlist: [
      "[data-track]",
      ".track-click",
      "button",
      "a[href]",
    ],
  },
  capture_heatmaps: true,
  disable_session_recording: false,
  enable_recording_console_log: false,
  advanced_disable_decide: false,
};

// Inicialización del SDK de PostHog
export const initPostHog = () => {
  // Only initialize in browser environment
  if (typeof window === "undefined") {
    return;
  }

  // Return early if PostHog key is empty
  if (!POSTHOG_KEY) {
    console.warn("PostHog key is not set. PostHog will not be initialized.");
    return;
  }

  // Check if PostHog is already initialized
  if (posthog.__loaded) {
    return;
  }

  try {
    posthog.init(POSTHOG_KEY, posthogConfig);
    console.log("PostHog initialized successfully");
    
    // 🧪 Evento de prueba al inicializar - puedes eliminarlo después de verificar
    posthog.capture("posthog_test_event", {
      test: true,
      timestamp: new Date().toISOString(),
      source: "posthog_initialization",
      message: "PostHog se ha inicializado correctamente en Imagiq"
    });
    console.log("🧪 PostHog test event captured: posthog_test_event");
  } catch (error) {
    console.error("Error initializing PostHog:", error);
  }
};

// Variable global para almacenar el userId actual
let currentUserId: string | null = null;

/**
 * Establece el userId global para PostHog
 * Llama a esta función al autenticar o identificar al usuario
 * @param userId - ID único del usuario
 */
export function setPosthogUserId(
  userId: string,
  userProperties?: Record<string, unknown>
) {
  currentUserId = userId;
  posthogUtils.identify(userId, userProperties);
}

/**
 * Associate an email with the current PostHog session.
 * Works even for anonymous/guest users — sets $set_once so the first email
 * seen sticks as the canonical one, while $set keeps the latest.
 */
export function associateEmailWithSession(
  email: string,
  extraProperties?: Record<string, unknown>
) {
  if (typeof window === "undefined" || !email) return;
  try {
    posthog.setPersonProperties(
      { $email: email, ...extraProperties },
      { $initial_email: email }
    );
  } catch (error) {
    console.error("Error associating email with PostHog session:", error);
  }
}

// Utilidades para interactuar con PostHog
export const posthogUtils = {
  /**
   * Identifica al usuario en PostHog
   * @param userId - ID único del usuario
   * @param userProperties - Propiedades adicionales del usuario
   */
  identify: (userId: string, userProperties?: Record<string, unknown>) => {
    if (typeof window === "undefined") return;
    try {
      posthog.identify(userId, userProperties);
      currentUserId = userId;
    } catch (error) {
      console.error("Error identifying user in PostHog:", error);
    }
  },

  /**
   * Captura un evento personalizado en PostHog, incluyendo el userId si está disponible
   * @param eventName - Nombre del evento
   * @param properties - Propiedades adicionales del evento
   */
  capture: (eventName: string, properties?: Record<string, unknown>) => {
    if (typeof window === "undefined") return;
    try {
      const eventProps = {
        ...(properties || {}),
        ...(currentUserId ? { userId: currentUserId } : {}),
      };
      posthog.capture(eventName, eventProps);
    } catch (error) {
      console.error("Error capturing event in PostHog:", error);
    }
  },

  /**
   * Captura una vista de página
   * @param pageName - Nombre de la página (opcional)
   */
  capturePageView: (pageName?: string) => {
    if (typeof window === "undefined") return;
    try {
      const page = pageName || window.location.pathname;
      posthog.capture("$pageview", { page });
    } catch (error) {
      console.error("Error capturing page view in PostHog:", error);
    }
  },

  /**
   * Evalúa si un feature flag está habilitado
   * @param flagKey - Clave del feature flag
   * @returns boolean
   */
  isFeatureEnabled: (flagKey: string): boolean => {
    if (typeof window === "undefined") return false;
    try {
      return posthog.isFeatureEnabled(flagKey) || false;
    } catch (error) {
      console.error("Error checking feature flag in PostHog:", error);
      return false;
    }
  },

  /**
   * Inicia la grabación de sesión (session replay)
   */
  startSessionRecording: () => {
    if (typeof window === "undefined") return;
    try {
      posthog.startSessionRecording();
    } catch (error) {
      console.error("Error starting session recording in PostHog:", error);
    }
  },

  /**
   * Detiene la grabación de sesión
   */
  stopSessionRecording: () => {
    if (typeof window === "undefined") return;
    try {
      posthog.stopSessionRecording();
    } catch (error) {
      console.error("Error stopping session recording in PostHog:", error);
    }
  },

  /**
   * Resetea el usuario (logout)
   */
  reset: () => {
    if (typeof window === "undefined") return;
    try {
      posthog.reset();
      currentUserId = null;
    } catch (error) {
      console.error("Error resetting user in PostHog:", error);
    }
  },
};

/**
 * Interfaz para los productos en el carrito
 */
export interface ProductCartItem {
  productId: string;
  name: string;
  category?: string;
  price: number;
  brand?: string;
  quantity: number;
}

/**
 * Captura un evento relevante de ecommerce en PostHog, mostrando todos los datos importantes en consola
 * @param eventName - Nombre del evento (ej: add_to_cart, purchase, view_product)
 * @param eventData - Objeto con los datos relevantes del ecommerce
 */
export function captureEcommerceEvent(
  eventName: string,
  eventData: {
    userId?: string;
    userEmail?: string;
    userName?: string;
    product?: ProductCartItem;
    cart?: {
      cartId?: string;
      products?: ProductCartItem[];
      total?: number;
      totalQuantity?: number;
    };
    order?: {
      orderId?: string;
      status?: string;
      total?: number;
      date?: string;
    };
    interaction?: {
      type?: string;
      page?: string;
      source?: string;
      timestamp?: string;
    };
    device?: {
      type?: string;
      browser?: string;
      os?: string;
    };
    location?: {
      country?: string;
      city?: string;
    };
  }
) {
  // Aquí iría la llamada real al SDK de PostHog
  void eventName;
  void eventData;
  // posthog.capture(eventName, eventData);
}

// -------------------------------------------------------------
// InWeb Campaign Tracking
// -------------------------------------------------------------

const INWEB_CAMPAIGN_STORAGE_KEY = "posthog_inweb_campaign_redirect";

/**
 * Helper to get current page URL
 */
function getCurrentPageUrl(): string {
  if (typeof window === "undefined") return "";
  return window.location.href;
}

/**
 * Helper to build common campaign properties
 */
function buildCampaignProperties(
  campaign: CampaignData,
  userId?: string
): Record<string, unknown> {
  const isPopup = campaign.display_style === "modal";
  const isSlider = campaign.display_style === "slider";

  return {
    campaign_name: campaign.campaign_name,
    campaign_type: campaign.campaign_type,
    content_type: campaign.content_type,
    display_style: campaign.display_style,
    destination_url: campaign.content_url,
    is_popup: isPopup,
    is_slider: isSlider,
    source_page: getCurrentPageUrl(),
    ...(userId ? { userId } : {}),
  };
}

/**
 * Track when an in-web notification campaign is shown to the user
 * @param campaign - Campaign data object
 * @param userId - Optional user ID
 */
export function trackInWebNotificationShown(
  campaign: CampaignData,
  userId?: string
) {
  if (!campaign) return;

  const properties = buildCampaignProperties(campaign, userId);
  posthogUtils.capture("inweb_notification_shown", properties);
}

/**
 * Track when a user clicks on an in-web notification campaign
 * @param campaign - Campaign data object
 * @param userId - Optional user ID
 */
export function trackInWebNotificationClicked(
  campaign: CampaignData,
  userId?: string
) {
  if (!campaign) return;

  const properties = buildCampaignProperties(campaign, userId);
  posthogUtils.capture("inweb_notification_clicked", properties);
}

/**
 * Store campaign redirect info in sessionStorage for cross-page tracking
 * Call this before redirecting the user to the destination page
 * @param campaign - Campaign data object
 * @param userId - Optional user ID
 */
export function storeInWebCampaignRedirect(
  campaign: CampaignData,
  userId?: string
) {
  if (typeof window === "undefined" || !campaign) return;

  try {
    const redirectData = {
      campaign_name: campaign.campaign_name,
      campaign_type: campaign.campaign_type,
      content_type: campaign.content_type,
      display_style: campaign.display_style,
      destination_url: campaign.content_url,
      source_page: getCurrentPageUrl(),
      userId: userId || null,
      timestamp: new Date().toISOString(),
    };
    sessionStorage.setItem(
      INWEB_CAMPAIGN_STORAGE_KEY,
      JSON.stringify(redirectData)
    );
  } catch (error) {
    console.error("Error storing InWeb campaign redirect:", error);
  }
}

/**
 * Track when user is redirected from an in-web campaign click
 * @param campaign - Campaign data object
 * @param userId - Optional user ID
 */
export function trackInWebCampaignRedirect(
  campaign: CampaignData,
  userId?: string
) {
  if (!campaign) return;

  const properties = buildCampaignProperties(campaign, userId);
  posthogUtils.capture("inweb_campaign_redirect", properties);
}

/**
 * Track when user views the destination page from an in-web campaign
 * @param campaignData - Stored campaign data from sessionStorage
 */
export function trackInWebCampaignDestinationViewed(campaignData: {
  campaign_name?: string;
  campaign_type?: string;
  content_type?: string;
  display_style?: string;
  destination_url?: string;
  source_page?: string;
  userId?: string | null;
}) {
  if (!campaignData) return;

  const isPopup = campaignData.display_style === "modal";
  const isSlider = campaignData.display_style === "slider";

  const properties: Record<string, unknown> = {
    campaign_name: campaignData.campaign_name,
    campaign_type: campaignData.campaign_type,
    content_type: campaignData.content_type,
    display_style: campaignData.display_style,
    destination_url: campaignData.destination_url,
    referrer_page: campaignData.source_page,
    current_page: getCurrentPageUrl(),
    is_popup: isPopup,
    is_slider: isSlider,
    ...(campaignData.userId ? { userId: campaignData.userId } : {}),
  };

  posthogUtils.capture("inweb_campaign_destination_viewed", properties);
}

/**
 * Check and track if current page is a destination from an InWeb campaign redirect
 * Call this on page load to detect campaign destination views
 */
export function checkAndTrackInWebDestination() {
  if (typeof window === "undefined") return;

  try {
    const storedData = sessionStorage.getItem(INWEB_CAMPAIGN_STORAGE_KEY);
    if (!storedData) return;

    const campaignData = JSON.parse(storedData);
    
    // Check if current URL matches the destination URL (or is a subpath of it)
    const currentUrl = getCurrentPageUrl();
    const destinationUrl = campaignData.destination_url;
    
    if (destinationUrl && currentUrl.includes(new URL(destinationUrl, window.location.origin).pathname)) {
      // Track the destination view
      trackInWebCampaignDestinationViewed(campaignData);
      
      // Clear the stored data to prevent duplicate tracking
      sessionStorage.removeItem(INWEB_CAMPAIGN_STORAGE_KEY);
    }
  } catch (error) {
    console.error("Error checking InWeb campaign destination:", error);
    // Clear corrupted data
    sessionStorage.removeItem(INWEB_CAMPAIGN_STORAGE_KEY);
  }
}

// -------------------------------------------------------------
// Los datos capturados se envían a los servidores de PostHog
// Puedes consultarlos en el dashboard web de PostHog
// -------------------------------------------------------------
