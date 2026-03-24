export interface PaymentErrorInfo {
  category: 'data' | 'funds' | 'card' | 'auth' | 'fraud' | 'system' | 'generic';
  title: string;
  description: string;
  icon: 'shield' | 'wallet' | 'card' | 'lock' | 'clock' | 'alert';
  primaryCta: { label: string; action: 'retry' | 'changeMethod' | 'contactBank' | 'viewOrders' };
  secondaryCta: { label: string; action: 'retry' | 'changeMethod' | 'contactBank' | 'goHome' } | null;
  colorScheme: 'amber' | 'red' | 'blue';
  canRetry: boolean;
  helpLink: { label: string; url: string } | null;
  tip: string | null;
}

// ---------------------------------------------------------------------------
// Static error map keyed by ePayco error code
// ---------------------------------------------------------------------------

const ERROR_CODE_MAP: Record<string, PaymentErrorInfo> = {
  // --- Data errors (amber) ---------------------------------------------------
  '14': {
    category: 'data',
    title: 'Numero de tarjeta invalido',
    description:
      'El numero de tarjeta ingresado no es valido. Verifica que lo hayas escrito correctamente, sin espacios ni caracteres adicionales.',
    icon: 'card',
    primaryCta: { label: 'Corregir datos', action: 'retry' },
    secondaryCta: { label: 'Usar otro metodo de pago', action: 'changeMethod' },
    colorScheme: 'amber',
    canRetry: true,
    helpLink: null,
    tip: null,
  },
  '54': {
    category: 'data',
    title: 'Tarjeta vencida',
    description:
      'La tarjeta ingresada ya expiro. Usa una tarjeta vigente o elige otro metodo de pago.',
    icon: 'clock',
    primaryCta: { label: 'Usar otro metodo de pago', action: 'changeMethod' },
    secondaryCta: { label: 'Contactar mi banco', action: 'contactBank' },
    colorScheme: 'amber',
    canRetry: false,
    helpLink: null,
    tip: null,
  },
  '56': {
    category: 'data',
    title: 'Tarjeta invalida',
    description:
      'Tu banco no reconoce esta tarjeta. Verifica los datos ingresados o comunicate con tu banco para confirmar que la tarjeta esta activa.',
    icon: 'card',
    primaryCta: { label: 'Corregir datos', action: 'retry' },
    secondaryCta: { label: 'Usar otro metodo de pago', action: 'changeMethod' },
    colorScheme: 'amber',
    canRetry: true,
    helpLink: null,
    tip: null,
  },
  '55': {
    category: 'data',
    title: 'PIN o CVC incorrecto',
    description:
      'El codigo de seguridad o PIN ingresado no coincide con el registrado en tu banco. Intentalo de nuevo con los datos correctos.',
    icon: 'lock',
    primaryCta: { label: 'Reintentar', action: 'retry' },
    secondaryCta: { label: 'Contactar mi banco', action: 'contactBank' },
    colorScheme: 'amber',
    canRetry: true,
    helpLink: null,
    tip: null,
  },
  N7: {
    category: 'data',
    title: 'PIN o CVC incorrecto',
    description:
      'El codigo de seguridad o PIN ingresado no coincide con el registrado en tu banco. Intentalo de nuevo con los datos correctos.',
    icon: 'lock',
    primaryCta: { label: 'Reintentar', action: 'retry' },
    secondaryCta: { label: 'Contactar mi banco', action: 'contactBank' },
    colorScheme: 'amber',
    canRetry: true,
    helpLink: null,
    tip: null,
  },
  '82': {
    category: 'data',
    title: 'PIN o CVC incorrecto',
    description:
      'El codigo de seguridad o PIN ingresado no coincide con el registrado en tu banco. Intentalo de nuevo con los datos correctos.',
    icon: 'lock',
    primaryCta: { label: 'Reintentar', action: 'retry' },
    secondaryCta: { label: 'Contactar mi banco', action: 'contactBank' },
    colorScheme: 'amber',
    canRetry: true,
    helpLink: null,
    tip: null,
  },

  // --- Insufficient funds (amber) --------------------------------------------
  '51': {
    category: 'funds',
    title: 'Fondos insuficientes',
    description:
      'Tu tarjeta no tiene saldo suficiente para completar esta compra. Verifica tu saldo e intentalo de nuevo, o usa otro metodo de pago.',
    icon: 'wallet',
    primaryCta: { label: 'Usar otro metodo de pago', action: 'changeMethod' },
    secondaryCta: { label: 'Reintentar', action: 'retry' },
    colorScheme: 'amber',
    canRetry: true,
    helpLink: null,
    tip: 'Verifica tu saldo disponible en la app de tu banco antes de reintentar.',
  },
  '61': {
    category: 'funds',
    title: 'Limite de transaccion excedido',
    description:
      'Esta transaccion supera el limite permitido por tu banco para compras en linea. Comunicate con tu banco para ampliar el limite o usa otro metodo de pago.',
    icon: 'wallet',
    primaryCta: { label: 'Usar otro metodo de pago', action: 'changeMethod' },
    secondaryCta: { label: 'Contactar mi banco', action: 'contactBank' },
    colorScheme: 'amber',
    canRetry: false,
    helpLink: null,
    tip: 'Verifica tu saldo disponible en la app de tu banco antes de reintentar.',
  },
  '65': {
    category: 'funds',
    title: 'Limite de transacciones excedido',
    description:
      'Has superado el numero de transacciones permitidas en tu banco para este periodo. Intenta mas tarde o usa otro metodo de pago.',
    icon: 'wallet',
    primaryCta: { label: 'Usar otro metodo de pago', action: 'changeMethod' },
    secondaryCta: { label: 'Reintentar', action: 'retry' },
    colorScheme: 'amber',
    canRetry: false,
    helpLink: null,
    tip: 'Verifica tu saldo disponible en la app de tu banco antes de reintentar.',
  },

  // --- 3D Secure / Authentication (amber) ------------------------------------
  '185': {
    category: 'auth',
    title: 'Verificacion 3D Secure fallida',
    description:
      'No pudimos verificar tu identidad con tu banco mediante 3D Secure. Asegurate de aprobar la notificacion en la app de tu banco e intentalo de nuevo.',
    icon: 'shield',
    primaryCta: { label: 'Reintentar', action: 'retry' },
    secondaryCta: { label: 'Contactar mi banco', action: 'contactBank' },
    colorScheme: 'amber',
    canRetry: true,
    helpLink: {
      label: 'Que es 3D Secure?',
      url: 'https://www.visa.com.co/pague-con-visa/tecnologias-de-pago/3d-secure.html',
    },
    tip: 'Asegurate de tener activada la app de tu banco para recibir notificaciones de verificacion.',
  },
  '1A': {
    category: 'auth',
    title: 'Autenticacion requerida',
    description:
      'Tu banco requiere que autentiques esta compra. Abre la app de tu banco, aprueba la solicitud de verificacion e intentalo de nuevo.',
    icon: 'lock',
    primaryCta: { label: 'Reintentar', action: 'retry' },
    secondaryCta: { label: 'Contactar mi banco', action: 'contactBank' },
    colorScheme: 'amber',
    canRetry: true,
    helpLink: {
      label: 'Que es 3D Secure?',
      url: 'https://www.visa.com.co/pague-con-visa/tecnologias-de-pago/3d-secure.html',
    },
    tip: 'Asegurate de tener activada la app de tu banco para recibir notificaciones de verificacion.',
  },
  Q1: {
    category: 'auth',
    title: 'Autenticacion de tarjeta fallida',
    description:
      'Tu banco no pudo autenticar tu tarjeta para esta transaccion. Verifica que tu tarjeta este habilitada para compras en linea o comunicate con tu banco.',
    icon: 'shield',
    primaryCta: { label: 'Reintentar', action: 'retry' },
    secondaryCta: { label: 'Contactar mi banco', action: 'contactBank' },
    colorScheme: 'amber',
    canRetry: true,
    helpLink: {
      label: 'Que es 3D Secure?',
      url: 'https://www.visa.com.co/pague-con-visa/tecnologias-de-pago/3d-secure.html',
    },
    tip: 'Asegurate de tener activada la app de tu banco para recibir notificaciones de verificacion.',
  },

  // --- Fraud / Risk (red, hard decline) --------------------------------------
  VA001: {
    category: 'fraud',
    title: 'Pago rechazado por seguridad',
    description:
      'Esta transaccion fue rechazada por nuestro sistema de seguridad. Si crees que esto es un error, comunicate con nosotros o intenta con otro metodo de pago.',
    icon: 'shield',
    primaryCta: { label: 'Usar otro metodo de pago', action: 'changeMethod' },
    secondaryCta: { label: 'Ir al inicio', action: 'goHome' },
    colorScheme: 'red',
    canRetry: false,
    helpLink: null,
    tip: null,
  },
  '59': {
    category: 'fraud',
    title: 'Transaccion rechazada',
    description:
      'Tu banco rechazo esta transaccion por razones de seguridad. Comunicate con tu banco para obtener mas informacion.',
    icon: 'shield',
    primaryCta: { label: 'Contactar mi banco', action: 'contactBank' },
    secondaryCta: { label: 'Usar otro metodo de pago', action: 'changeMethod' },
    colorScheme: 'red',
    canRetry: false,
    helpLink: null,
    tip: null,
  },
  // Codes 41 (lost card) and 43 (stolen card): do NOT reveal real reason
  '41': {
    category: 'fraud',
    title: 'Transaccion rechazada',
    description:
      'Tu banco rechazo esta transaccion. Comunicate con tu banco para obtener mas informacion y resolver el problema.',
    icon: 'alert',
    primaryCta: { label: 'Contactar mi banco', action: 'contactBank' },
    secondaryCta: { label: 'Usar otro metodo de pago', action: 'changeMethod' },
    colorScheme: 'red',
    canRetry: false,
    helpLink: null,
    tip: null,
  },
  '43': {
    category: 'fraud',
    title: 'Transaccion rechazada',
    description:
      'Tu banco rechazo esta transaccion. Comunicate con tu banco para obtener mas informacion y resolver el problema.',
    icon: 'alert',
    primaryCta: { label: 'Contactar mi banco', action: 'contactBank' },
    secondaryCta: { label: 'Usar otro metodo de pago', action: 'changeMethod' },
    colorScheme: 'red',
    canRetry: false,
    helpLink: null,
    tip: null,
  },

  // --- Generic bank decline (amber) ------------------------------------------
  '05': {
    category: 'generic',
    title: 'Pago no autorizado',
    description:
      'Tu banco no autorizo este pago. Esto puede deberse a restricciones en tu cuenta. Intenta de nuevo o usa otro metodo de pago.',
    icon: 'alert',
    primaryCta: { label: 'Reintentar', action: 'retry' },
    secondaryCta: { label: 'Usar otro metodo de pago', action: 'changeMethod' },
    colorScheme: 'amber',
    canRetry: true,
    helpLink: null,
    tip: 'Si el problema persiste, contacta a tu banco al numero en el reverso de tu tarjeta.',
  },
  '57': {
    category: 'card',
    title: 'Tarjeta no habilitada para este tipo de compra',
    description:
      'Tu tarjeta no esta habilitada para realizar compras en linea o en esta categoria. Comunicate con tu banco para activar esta opcion o usa otro metodo de pago.',
    icon: 'card',
    primaryCta: { label: 'Usar otro metodo de pago', action: 'changeMethod' },
    secondaryCta: { label: 'Contactar mi banco', action: 'contactBank' },
    colorScheme: 'amber',
    canRetry: false,
    helpLink: null,
    tip: null,
  },

  // --- System errors (blue, retryable) ---------------------------------------
  '91': {
    category: 'system',
    title: 'Banco no disponible en este momento',
    description:
      'El sistema de tu banco presenta intermitencias. Espera unos minutos e intentalo de nuevo. Tu dinero no fue cobrado.',
    icon: 'clock',
    primaryCta: { label: 'Reintentar', action: 'retry' },
    secondaryCta: { label: 'Usar otro metodo de pago', action: 'changeMethod' },
    colorScheme: 'blue',
    canRetry: true,
    helpLink: null,
    tip: 'Esto suele resolverse en pocos minutos. Tu dinero no fue cobrado.',
  },
  '96': {
    category: 'system',
    title: 'Error de procesamiento',
    description:
      'Ocurrio un error tecnico al procesar tu pago. Intentalo de nuevo en unos minutos. Tu dinero no fue cobrado.',
    icon: 'alert',
    primaryCta: { label: 'Reintentar', action: 'retry' },
    secondaryCta: { label: 'Usar otro metodo de pago', action: 'changeMethod' },
    colorScheme: 'blue',
    canRetry: true,
    helpLink: null,
    tip: 'Esto suele resolverse en pocos minutos. Tu dinero no fue cobrado.',
  },
  '19': {
    category: 'system',
    title: 'Por favor, intenta de nuevo',
    description:
      'La transaccion no pudo completarse en este intento. Vuelve a intentarlo; no se realizo ningun cobro.',
    icon: 'clock',
    primaryCta: { label: 'Reintentar', action: 'retry' },
    secondaryCta: null,
    colorScheme: 'blue',
    canRetry: true,
    helpLink: null,
    tip: 'Esto suele resolverse en pocos minutos. Tu dinero no fue cobrado.',
  },
  '94': {
    category: 'system',
    title: 'Transaccion duplicada',
    description:
      'Detectamos que esta transaccion ya fue procesada anteriormente. Revisa el estado de tu pedido antes de intentar de nuevo.',
    icon: 'alert',
    primaryCta: { label: 'Ver mis pedidos', action: 'viewOrders' },
    secondaryCta: { label: 'Reintentar', action: 'retry' },
    colorScheme: 'blue',
    canRetry: false,
    helpLink: null,
    tip: 'Esto suele resolverse en pocos minutos. Tu dinero no fue cobrado.',
  },
};

// ---------------------------------------------------------------------------
// Keyword matchers for when no error code is available
// ---------------------------------------------------------------------------

interface KeywordMatcher {
  keywords: string[];
  info: PaymentErrorInfo;
}

const KEYWORD_MATCHERS: KeywordMatcher[] = [
  {
    keywords: ['3d secure', '3ds', 'autenticacion', 'autenticacion requerida'],
    info: ERROR_CODE_MAP['185'],
  },
  {
    keywords: ['fondos insuficientes', 'saldo insuficiente', 'sin fondos', 'no tiene fondos'],
    info: ERROR_CODE_MAP['51'],
  },
  {
    keywords: ['tarjeta expirada', 'tarjeta vencida', 'fecha de vencimiento'],
    info: ERROR_CODE_MAP['54'],
  },
  {
    keywords: ['tarjeta invalida', 'numero de tarjeta', 'numero invalido'],
    info: ERROR_CODE_MAP['14'],
  },
  {
    keywords: ['cvc', 'cvv', 'codigo de seguridad', 'pin incorrecto'],
    info: ERROR_CODE_MAP['55'],
  },
  {
    keywords: ['econtrol', 'riesgo', 'antifraude', 'fraude'],
    info: ERROR_CODE_MAP['VA001'],
  },
  {
    keywords: ['limite excedido', 'limite de transaccion', 'monto maximo'],
    info: ERROR_CODE_MAP['61'],
  },
  {
    keywords: ['banco no disponible', 'emisor no disponible', 'sistema no disponible'],
    info: ERROR_CODE_MAP['91'],
  },
  {
    keywords: ['error de procesamiento', 'error tecnico', 'error del sistema'],
    info: ERROR_CODE_MAP['96'],
  },
  {
    keywords: ['tarjeta no habilitada', 'no permitida', 'no soportada'],
    info: ERROR_CODE_MAP['57'],
  },
];

// ---------------------------------------------------------------------------
// Generic fallback
// ---------------------------------------------------------------------------

const GENERIC_FALLBACK: PaymentErrorInfo = {
  category: 'generic',
  title: 'No pudimos procesar tu pago',
  description:
    'Tu banco rechazo el pago sin especificar el motivo. Intenta de nuevo o usa otro metodo de pago.',
  icon: 'alert',
  primaryCta: { label: 'Reintentar', action: 'retry' },
  secondaryCta: { label: 'Usar otro metodo de pago', action: 'changeMethod' },
  colorScheme: 'amber',
  canRetry: true,
  helpLink: null,
  tip: 'Si el problema persiste, contacta a tu banco al numero en el reverso de tu tarjeta.',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Maps an ePayco error code and/or raw error message to structured UX data
 * for a payment rejection screen.
 *
 * Resolution order:
 *   1. Exact match on errorCode (case-insensitive)
 *   2. Keyword match on lowercased errorMessage
 *   3. Generic fallback
 *
 * Usage:
 *   const info = getPaymentErrorInfo('51');
 *   const info = getPaymentErrorInfo(undefined, 'fondos insuficientes');
 *   const info = getPaymentErrorInfo('185', 'Error 3D Secure verification failed');
 */
export function getPaymentErrorInfo(
  errorCode?: string,
  errorMessage?: string,
): PaymentErrorInfo {
  // 1. Try exact code match (normalise to uppercase to handle lowercase variants)
  if (errorCode) {
    const normalised = errorCode.trim().toUpperCase();
    const byCode =
      ERROR_CODE_MAP[normalised] ?? ERROR_CODE_MAP[errorCode.trim()];
    if (byCode) {
      return byCode;
    }
  }

  // 2. Try keyword match on the message
  if (errorMessage) {
    const lower = errorMessage.toLowerCase();
    for (const matcher of KEYWORD_MATCHERS) {
      if (matcher.keywords.some((kw) => lower.includes(kw))) {
        return matcher.info;
      }
    }
  }

  // 3. Generic fallback
  return GENERIC_FALLBACK;
}
