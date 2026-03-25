/**
 * Clarity Recording Consent Management
 *
 * Maneja el envío del consentimiento de grabación al backend
 */

/**
 * Envía el consentimiento de grabación de Clarity al backend
 * Nota: El consent se maneja localmente, no hay endpoint en el backend
 */
export async function sendClarityConsentToBackend(_consent: boolean): Promise<boolean> {
  return true;
}

/**
 * Guarda el consentimiento localmente y lo envía al backend
 */
export function saveClarityConsent(consent: boolean): void {
  const consentData = {
    clarity_recording: consent,
    timestamp: new Date().toISOString(),
    version: "1.0",
  };

  try {
    localStorage.setItem("clarity_consent", JSON.stringify(consentData));
    sendClarityConsentToBackend(consent);
  } catch (error) {
    console.error("[Clarity Consent] Failed to save consent locally:", error);
  }
}

/**
 * Obtiene el consentimiento guardado localmente
 */
export function getClarityConsent(): boolean | null {
  try {
    const stored = localStorage.getItem("clarity_consent");
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    return parsed.clarity_recording ?? null;
  } catch (error) {
    console.error("[Clarity Consent] Failed to read consent:", error);
    return null;
  }
}

/**
 * Inicializa el consentimiento de Clarity
 * Por defecto, está habilitado para grabar todas las sesiones
 */
export function initializeClarityConsent(): void {
  const existingConsent = getClarityConsent();

  if (existingConsent === null) {
    saveClarityConsent(true);
  }
}
