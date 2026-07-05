export type CtaAction =
  | 'retry'
  | 'changeMethod'
  | 'contactBank'
  | 'viewOrders'
  | 'goHome';

/**
 * Optional educational block rendered on the rejection screen. Used to explain
 * a security mechanism the shopper may not understand (e.g. 3D Secure) so a
 * rejection reads as "here's what happened and how to complete it" rather than
 * a dead end.
 */
export interface PaymentExplainer {
  heading: string;
  intro: string;
  steps: string[];
  /** Optional illustrative diagram rendered after the steps. */
  image?: { url: string; alt: string } | null;
}

export interface PaymentErrorInfo {
  category: 'data' | 'funds' | 'card' | 'auth' | 'fraud' | 'system' | 'generic';
  title: string;
  description: string;
  icon: 'shield' | 'wallet' | 'card' | 'lock' | 'clock' | 'alert';
  primaryCta: { label: string; action: CtaAction };
  secondaryCta: { label: string; action: CtaAction } | null;
  colorScheme: 'amber' | 'red' | 'blue';
  canRetry: boolean;
  helpLink: { label: string; url: string } | null;
  tip: string | null;
  explainer?: PaymentExplainer | null;
}

// ---------------------------------------------------------------------------
// Shared explainer: what 3D Secure is and why the bank requests it.
// Content adapted from ePayco's official 3DS rules (docs.epayco.com/docs/
// reglas-3d-secure) into plain, consumer-facing Spanish.
// ---------------------------------------------------------------------------

const THREE_DS_EXPLAINER: PaymentExplainer = {
  heading: '¿Qué es la verificación 3D Secure y por qué me la piden?',
  intro:
    'Es una capa de seguridad que tu banco usa para confirmar que eres tú quien está comprando. Así protege tu tarjeta contra usos fraudulentos: no es un problema de la tienda.',
  steps: [
    'Al pagar, tu banco te pide una verificación adicional: un código (OTP) por SMS, una clave dinámica, o una aprobación en la app de tu banco.',
    'Debes aprobarla dentro del tiempo límite para que el pago se autorice.',
    'El pago se rechaza si no apruebas la notificación, se agota el tiempo, o tu banco no autoriza la compra.',
    'Para reintentar: ten tu celular y la app de tu banco a la mano, y aprueba la verificación apenas aparezca.',
  ],
  image: {
    url: 'https://cdn.document360.io/88b1b912-ebe6-4677-9cf4-27af4e66c459/Images/Documentation/image-1659453424037.png',
    alt: 'Diagrama del flujo de autenticación 3D Secure',
  },
};

// Shared shape for transient gateway/config errors (invalid merchant, format,
// routing, generic processor error). All map to the same retryable message.
const SYSTEM_TEMPORARY: PaymentErrorInfo = {
  category: 'system',
  title: 'No pudimos procesar el pago',
  description:
    'Hubo un problema temporal al procesar tu pago. Intentalo de nuevo en unos minutos o usa otro metodo de pago. No se realizo ningun cobro.',
  icon: 'alert',
  primaryCta: { label: 'Reintentar', action: 'retry' },
  secondaryCta: { label: 'Usar otro metodo de pago', action: 'changeMethod' },
  colorScheme: 'blue',
  canRetry: true,
  helpLink: null,
  tip: 'Esto suele resolverse en pocos minutos. Tu dinero no fue cobrado.',
};

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

  // --- PSE specific -----------------------------------------------------------
  'PSE_TIMEOUT': {
    category: 'auth',
    title: 'Tu banco aún no confirma el pago',
    description:
      'La transacción PSE está siendo procesada por tu banco. Esto puede tomar unos minutos. Si ya autorizaste el pago en tu portal bancario, la confirmación llegará automáticamente a tu correo.',
    icon: 'clock',
    primaryCta: { label: 'Volver al inicio', action: 'goHome' },
    secondaryCta: { label: 'Ver mis pedidos', action: 'viewOrders' },
    colorScheme: 'blue',
    canRetry: false,
    helpLink: null,
    tip: 'No intentes pagar de nuevo. Si el pago fue exitoso en tu banco, recibirás la confirmación por correo electrónico.',
  },

  // --- Addi specific ----------------------------------------------------------
  'ADDI_PENDING': {
    category: 'auth',
    title: 'Estamos confirmando tu pago con Addi',
    description:
      'Tu solicitud con Addi se está procesando. Si Addi aprobó tu crédito, la confirmación llegará automáticamente y verás tu pedido reflejado. Esto puede tomar unos minutos.',
    icon: 'clock',
    primaryCta: { label: 'Ver mis pedidos', action: 'viewOrders' },
    secondaryCta: { label: 'Volver al inicio', action: 'goHome' },
    colorScheme: 'blue',
    canRetry: false,
    helpLink: null,
    tip: 'No vuelvas a pagar. Si Addi aprobó tu crédito, recibirás la confirmación por correo electrónico.',
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
    // No external help link: the in-page explainer + ePayco flow diagram below
    // already answer "what is 3D Secure". (The old Visa URL 404'd.)
    helpLink: null,
    tip: 'Asegurate de tener activada la app de tu banco para recibir notificaciones de verificacion.',
    explainer: THREE_DS_EXPLAINER,
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
    // No external help link: the in-page explainer + ePayco flow diagram below
    // already answer "what is 3D Secure". (The old Visa URL 404'd.)
    helpLink: null,
    tip: 'Asegurate de tener activada la app de tu banco para recibir notificaciones de verificacion.',
    explainer: THREE_DS_EXPLAINER,
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
    // No external help link: the in-page explainer + ePayco flow diagram below
    // already answer "what is 3D Secure". (The old Visa URL 404'd.)
    helpLink: null,
    tip: 'Asegurate de tener activada la app de tu banco para recibir notificaciones de verificacion.',
    explainer: THREE_DS_EXPLAINER,
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

  // --- Issuer referral / authorization (amber) -------------------------------
  '01': {
    category: 'auth',
    title: 'Tu banco requiere autorizar la compra',
    description:
      'Tu banco pidio confirmar esta compra contigo antes de aprobarla. Comunicate con tu banco para autorizarla e intentalo de nuevo.',
    icon: 'lock',
    primaryCta: { label: 'Contactar mi banco', action: 'contactBank' },
    secondaryCta: { label: 'Usar otro metodo de pago', action: 'changeMethod' },
    colorScheme: 'amber',
    canRetry: true,
    helpLink: null,
    tip: 'Llama al numero en el reverso de tu tarjeta para autorizar la compra.',
  },

  // --- Restricted / inactive / closed card -----------------------------------
  '62': {
    category: 'card',
    title: 'Tarjeta restringida',
    description:
      'Tu banco tiene una restriccion sobre esta tarjeta para este tipo de compra (por ejemplo, compras internacionales o en linea). Comunicate con tu banco o usa otra tarjeta.',
    icon: 'lock',
    primaryCta: { label: 'Contactar mi banco', action: 'contactBank' },
    secondaryCta: { label: 'Usar otro metodo de pago', action: 'changeMethod' },
    colorScheme: 'amber',
    canRetry: false,
    helpLink: null,
    tip: 'Las tarjetas internacionales suelen requerir habilitar compras en Colombia con tu banco.',
  },
  '78': {
    category: 'card',
    title: 'Tarjeta no activada',
    description:
      'Esta tarjeta aun no esta activada para compras. Activala con tu banco o usa otra tarjeta.',
    icon: 'card',
    primaryCta: { label: 'Contactar mi banco', action: 'contactBank' },
    secondaryCta: { label: 'Usar otro metodo de pago', action: 'changeMethod' },
    colorScheme: 'amber',
    canRetry: false,
    helpLink: null,
    tip: 'Las tarjetas nuevas suelen requerir activacion o una primera compra presencial.',
  },
  '46': {
    category: 'card',
    title: 'Cuenta cerrada',
    description:
      'La cuenta asociada a esta tarjeta esta cerrada. Usa otra tarjeta o metodo de pago.',
    icon: 'card',
    primaryCta: { label: 'Usar otro metodo de pago', action: 'changeMethod' },
    secondaryCta: { label: 'Contactar mi banco', action: 'contactBank' },
    colorScheme: 'amber',
    canRetry: false,
    helpLink: null,
    tip: null,
  },
  '15': {
    category: 'data',
    title: 'Tarjeta no reconocida',
    description:
      'No pudimos identificar el banco emisor de esta tarjeta. Verifica el numero ingresado o usa otra tarjeta.',
    icon: 'card',
    primaryCta: { label: 'Corregir datos', action: 'retry' },
    secondaryCta: { label: 'Usar otro metodo de pago', action: 'changeMethod' },
    colorScheme: 'amber',
    canRetry: true,
    helpLink: null,
    tip: null,
  },
  '75': {
    category: 'data',
    title: 'Excediste los intentos permitidos',
    description:
      'Tu tarjeta se bloqueo temporalmente por multiples intentos fallidos. Comunicate con tu banco para desbloquearla o usa otra tarjeta.',
    icon: 'lock',
    primaryCta: { label: 'Contactar mi banco', action: 'contactBank' },
    secondaryCta: { label: 'Usar otro metodo de pago', action: 'changeMethod' },
    colorScheme: 'amber',
    canRetry: false,
    helpLink: null,
    tip: null,
  },

  // --- Amount (amber) --------------------------------------------------------
  '13': {
    category: 'data',
    title: 'Monto no valido',
    description:
      'El monto de la compra no pudo ser procesado por tu banco. Intentalo de nuevo; si el problema persiste, contactanos.',
    icon: 'alert',
    primaryCta: { label: 'Reintentar', action: 'retry' },
    secondaryCta: { label: 'Usar otro metodo de pago', action: 'changeMethod' },
    colorScheme: 'amber',
    canRetry: true,
    helpLink: null,
    tip: null,
  },

  // --- Hard security declines (red, do not reveal exact reason) ---------------
  '04': {
    category: 'fraud',
    title: 'Transaccion rechazada',
    description:
      'Tu banco rechazo esta transaccion. Comunicate con tu banco para obtener mas informacion o usa otro metodo de pago.',
    icon: 'shield',
    primaryCta: { label: 'Contactar mi banco', action: 'contactBank' },
    secondaryCta: { label: 'Usar otro metodo de pago', action: 'changeMethod' },
    colorScheme: 'red',
    canRetry: false,
    helpLink: null,
    tip: null,
  },
  '93': {
    category: 'fraud',
    title: 'Transaccion rechazada',
    description:
      'Tu banco no puede procesar esta transaccion. Comunicate con tu banco para obtener mas informacion.',
    icon: 'shield',
    primaryCta: { label: 'Contactar mi banco', action: 'contactBank' },
    secondaryCta: { label: 'Usar otro metodo de pago', action: 'changeMethod' },
    colorScheme: 'red',
    canRetry: false,
    helpLink: null,
    tip: null,
  },

  // --- Temporary processing / config errors (blue, retryable) ----------------
  '03': SYSTEM_TEMPORARY,
  '06': SYSTEM_TEMPORARY,
  '12': SYSTEM_TEMPORARY,
  '30': SYSTEM_TEMPORARY,
  '92': SYSTEM_TEMPORARY,
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
