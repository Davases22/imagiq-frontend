'use client';

import { useEffect, useState } from 'react';
import { hasAnalyticsConsent } from '@/lib/consent';
import { initSentry } from '@/lib/sentry/client';

/**
 * Sentry - First-Party Loading
 *
 * Errores: siempre. Tracing/Replay: solo con consentimiento de analytics.
 */
export default function SentryScript() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;

    const loadSentry = () => {
      // SIEMPRE se inicializa la captura de ERRORES (monitoreo técnico sin
      // tracing/replay/PII). Antes Sentry solo arrancaba con consentimiento de
      // analytics -> quedaba ciego para la mayoría de usuarios (~2 eventos/día).
      // Con consentimiento se activa el modo completo (tracing + replay).
      void initSentry(hasAnalyticsConsent());
    };

    // Cargar inmediatamente
    loadSentry();

    // Escuchar cambios de consentimiento
    const handleConsentChange = () => {
      loadSentry();
    };

    window.addEventListener('consentChange', handleConsentChange);

    return () => {
      window.removeEventListener('consentChange', handleConsentChange);
    };
  }, [mounted]);

  return null;
}
