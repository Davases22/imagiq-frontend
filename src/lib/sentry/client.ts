/**
 * Cliente de Sentry para IMAGIQ Frontend
 *
 * Proporciona funciones para:
 * - Inicializar Sentry desde el backend
 * - Capturar errores y mensajes
 * - Gestionar información del usuario
 * - Configurar el tunnel para enviar eventos
 *
 * @module sentry/client
 */

import * as Sentry from '@sentry/nextjs';
import { sentryConfig } from './config';
import { apiGet } from '@/lib/api-client';

/** Flag para evitar inicializaciones múltiples */
let sentryInitialized = false;

/** Flag para rastrear si la configuración está siendo cargada */
let configLoading = false;

/**
 * Inicializa Sentry obteniendo la configuración desde el backend
 *
 * Condiciones para inicializar:
 * 1. Sentry debe estar habilitado en la configuración
 * 2. Debe ejecutarse en el cliente (no SSR)
 * 3. No debe haberse inicializado antes
 * 4. El usuario debe haber dado consentimiento de analytics
 *
 * @example
 * ```typescript
 * import { initSentry } from '@/lib/sentry/client';
 *
 * if (hasAnalyticsConsent()) {
 *   initSentry();
 * }
 * ```
 */
export async function initSentry(): Promise<void> {
  // Validaciones previas
  if (!sentryConfig.enabled) {
    return;
  }

  if (sentryInitialized) {
    return;
  }

  if (configLoading) {
    return;
  }

  if (globalThis.window === undefined) {
    return;
  }

  try {
    configLoading = true;

    // Obtener la configuración desde el backend con autenticación API Key
    const config = await apiGet<{
      dsn: string;
      environment?: string;
      tracesSampleRate?: number;
      replaysSessionSampleRate?: number;
      replaysOnErrorSampleRate?: number;
    }>('/api/custommer/analytics/sentry/config');

    if (!config || !config.dsn) {
      console.warn('[Sentry] Configuration not available from backend, skipping initialization');
      configLoading = false;
      return;
    }

    // Inicializar Sentry con la configuración obtenida del backend
    Sentry.init({
      dsn: config.dsn,
      environment: config.environment || 'production',
      tracesSampleRate: config.tracesSampleRate ?? 0.1,
      replaysSessionSampleRate: config.replaysSessionSampleRate ?? 0.1,
      replaysOnErrorSampleRate: config.replaysOnErrorSampleRate ?? 1,
      // Filtrar ruido de terceros: Flixmedia genera la mayoría de errores en
      // /productos/* — scripts async no cancelables que corren tras la navegación
      // SPA, bugs dentro de su bundle minificado (opts/opts2), y puentes nativos
      // de WebView (Android "Java object is gone" / iOS webkit.messageHandlers).
      // No son fallos de la app y contaminan Sentry, así que se descartan aquí.
      ignoreErrors: [
        '_loadInpageCallback',
        'flixCartClick',
        'flixJsCallbacks',
        'opts is not defined',
        'opts2 is not defined',
        'Java object is gone',
        'webkit.messageHandlers',
        'AbortError',
      ],
      denyUrls: [
        /flixfacts\.com/,
        /flixcar\.com/,
        /flixsyndication/,
        /modular\/js\/minify/,
      ],
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: false,
          blockAllMedia: false,
        }),
      ],
    });

    // Exponer Sentry globalmente para compatibilidad
    if (globalThis.window) {
      globalThis.window.Sentry = Sentry as unknown as typeof globalThis.window.Sentry;
    }

    sentryInitialized = true;
    configLoading = false;
  } catch (error) {
    console.error('[Sentry] Error during initialization:', error);
    configLoading = false;
  }
}

/**
 * Captura un error y lo envía a Sentry
 *
 * @param error - Error a capturar
 * @param context - Contexto adicional (componente, acción, etc.)
 *
 * @example
 * ```typescript
 * import { captureError } from '@/lib/sentry/client';
 *
 * try {
 *   throw new Error('Something went wrong');
 * } catch (error) {
 *   captureError(error as Error, {
 *     component: 'ProductCard',
 *     action: 'addToCart',
 *     productId: '123',
 *   });
 * }
 * ```
 */
export function captureError(error: Error, context?: Record<string, unknown>): void {
  if (!sentryInitialized) {
    return;
  }

  try {
    Sentry.captureException(error, {
      contexts: context ? { custom: context } : undefined,
    });
  } catch (err) {
    console.error('[Sentry] Failed to capture error:', err);
  }
}

/**
 * Captura un mensaje y lo envía a Sentry
 *
 * @param message - Mensaje a capturar
 * @param level - Nivel de severidad
 *
 * @example
 * ```typescript
 * import { captureMessage } from '@/lib/sentry/client';
 *
 * captureMessage('User completed checkout', 'info');
 * captureMessage('Payment gateway timeout', 'warning');
 * captureMessage('Critical database error', 'error');
 * ```
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info'
): void {
  if (!sentryInitialized) {
    return;
  }

  try {
    Sentry.captureMessage(message, level);
  } catch (err) {
    console.error('[Sentry] Failed to capture message:', err);
  }
}

/**
 * Establece información del usuario para asociarla con los eventos
 *
 * Útil para rastrear errores por usuario específico
 *
 * @param user - Información del usuario
 *
 * @example
 * ```typescript
 * import { setUser } from '@/lib/sentry/client';
 *
 * // Después del login
 * setUser({
 *   id: user.id,
 *   email: user.email,
 *   username: user.username,
 * });
 * ```
 */
export function setUser(user: {
  id?: string;
  email?: string;
  username?: string;
}): void {
  if (!sentryInitialized) {
    return;
  }

  try {
    Sentry.setUser(user);
  } catch (err) {
    console.error('[Sentry] Failed to set user:', err);
  }
}

/**
 * Limpia la información del usuario
 *
 * Debe llamarse al hacer logout para no asociar eventos futuros con el usuario anterior
 *
 * @example
 * ```typescript
 * import { clearUser } from '@/lib/sentry/client';
 *
 * // Al hacer logout
 * clearUser();
 * ```
 */
export function clearUser(): void {
  if (!sentryInitialized) {
    return;
  }

  try {
    Sentry.setUser(null);
  } catch (err) {
    console.error('[Sentry] Failed to clear user:', err);
  }
}

/**
 * Verifica si Sentry está inicializado y listo para usar
 *
 * @returns true si Sentry está inicializado
 *
 * @example
 * ```typescript
 * import { isSentryInitialized } from '@/lib/sentry/client';
 *
 * if (isSentryInitialized()) {
 *   captureError(new Error('Test'));
 * }
 * ```
 */
export function isSentryInitialized(): boolean {
  return sentryInitialized;
}
