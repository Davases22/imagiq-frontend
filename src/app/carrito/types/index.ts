export interface RecipientPayload {
  // = checkbox "Será recibido por el cliente" del step3.
  receivedByClient: boolean;
  // Solo presentes cuando receivedByClient === false (otra persona recibe).
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

export interface BasicPaymentData {
  totalAmount: string;
  shippingAmount: string;
  currency: string;
  items: Item[];
  userInfo: UserInfo;
  metodo_envio: number;
  codigo_bodega?: string;
  informacion_facturacion: InformacionFacturacion;
  beneficios?: BeneficiosDTO[];
  couponCode?: string;
  recipientData?: RecipientPayload;
}
export interface InformacionFacturacion {
  type: string;
  nombre_completo: string;
  tipo_documento: string;
  numero_documento: string;
  email: string;
  telefono: string;
  razon_social?: string;
  nit?: string;
  representante_legal?: string;
  direccion_id: string | null; // nullable por si no siempre se envía
}

export interface DetalleDispositivoRetoma {
  pantalla_enciende_mas_30_segundos: boolean;
  libre_uso_sin_bloqueo_operador: boolean;
  sin_danos_graves: boolean;
  buen_estado: boolean;
}

export interface BeneficiosDTO {
  type:
  | "0%_interes"
  | "entrego_y_estreno"
  | "bundle"
  | "soporte"
  | "sin_beneficios";
  // Indica si el beneficio aplica (usado para 0%_interes)
  aplica?: boolean;
  // Campos para entrego_y_estreno (Trade-In)
  dispositivo_a_recibir?: string;
  valor_retoma?: number;
  dispositivo_a_entregar?: string;
  detalles_dispositivo_a_recibir?: DetalleDispositivoRetoma;
  // Campos comunes
  sku?: string;
  descuento_producto?: number;
  descuento_bundle?: number;
}

export type AddiPaymentData = BasicPaymentData;
export interface Item {
  sku: string;
  name: string;
  quantity: string;
  unitPrice: string;
  skupostback: string;
  desDetallada: string;
  ean: string;
  categoria?: string; // Category for shipping logic
  category?: string; // Backend DTO expectation
}

export interface UserInfo {
  userId: string;
  direccionId: string;
}
export interface CardPaymentData extends BasicPaymentData {
  cardExpYear?: string;
  cardExpMonth?: string;
  cardNumber?: string;
  cardCvc?: string;
  cardTokenId?: string;
  dues: string;
}

export interface PsePaymentData extends BasicPaymentData {
  bank: string;
  bankName: string;
  description: string;
}
export type PaymentMethod = "addi" | "tarjeta" | "pse";

// Zero Interest Installments Types
export interface CheckZeroInterestRequest {
  userId: string;
  cardIds: string[];
  productSkus: string[];
  totalAmount: number;
}

export interface CardZeroInterestInfo {
  id: string;
  eligibleForZeroInterest: boolean;
  availableInstallments: number[];
}

export interface CheckZeroInterestResponse {
  aplica: boolean;
  cards: CardZeroInterestInfo[];
}
