/**
 * @module ProfileTypes
 * @description Tipos simplificados para el perfil basados en v_usuario_perfil
 */

// ====================================
// Tipos base desde la view v_usuario_perfil
// ====================================

/**
 * Dirección desde la base de datos
 * Formato del JSON en el campo 'direcciones' de v_usuario_perfil
 */
export interface DBAddress {
  id: string;
  linea_uno: string;
  ciudad?: string;
  pais?: string;
  place_id?: string;
  tipo: string;
  nombreDireccion?: string;
  tipoDireccion?: string;
  esPredeterminada?: boolean;
  direccionFormateada?: string;
  departamento?: string;
  complemento?: string;
  instruccionesEntrega?: string;
  activa?: boolean;
}

/**
 * Tarjeta desde la base de datos
 * Formato del JSON en el campo 'tarjetas' de v_usuario_perfil
 */
export interface DBCard {
  id: string;
  ultimos_dijitos: string;
  tipo_tarjeta?: string;
  nombre_titular?: string;
  fecha_vencimiento?: string;
  es_predeterminada?: boolean;
  activa?: boolean;
  marca?: string;
  banco?: string;
  alias?: string;
}

/**
 * Tarjeta encriptada del backend (/api/payments/cards/:userId)
 * TODO viene encriptado en un solo bloque
 */
export interface EncryptedCard {
  encryptedData: string; // Contiene: {cardId, last4Digits, brand, banco, cardHolderName, createdAt}
}

/**
 * Tarjeta desencriptada
 * Formato después de desencriptar encryptedData
 */
export interface DecryptedCardData {
  cardId: string;          // UUID de la tarjeta
  last4Digits: string;     // Últimos 4 dígitos
  brand: string | null;    // VISA, Mastercard, etc.
  tipo: string | null;     // credit/debit
  banco: string | null;    // Banco emisor
  cardHolderName: string;  // Nombre del titular de la tarjeta
  createdAt: string;       // ISO string
}

/**
 * Usuario desde v_usuario_perfil
 */
export interface ProfileUser {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono?: string;
  tipo_documento?: string;
  numero_documento?: string;
  direcciones: DBAddress[];
  tarjetas: DBCard[];
  // Campos opcionales para compatibilidad con UI
  avatar?: string;
  loyaltyPoints?: number;
}

/**
 * Estado del perfil
 */
export interface ProfileState {
  user: ProfileUser | null;
  loading: boolean | {
    profile: boolean;
    orders: boolean;
    addresses: boolean;
    paymentMethods: boolean;
    invoices: boolean;
  };
  error: string | null;
  // Campos adicionales para compatibilidad
  addresses?: ProfileAddress[];
  paymentMethods?: PaymentMethod[];
  activeOrders?: Order[];
  recentOrders?: Order[];
  invoices?: Invoice[];
  credits?: Credits;
  coupons?: Coupon[];
  loyaltyProgram?: LoyaltyProgram | null;
  preferences?: ProfilePreferences;
}

/**
 * Respuesta de la API de perfil
 */
export interface ProfileResponse {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono?: string;
  numero_documento?: string;
  direcciones: DBAddress[] | string; // Puede venir como string JSON
  tarjetas: DBCard[] | string; // Puede venir como string JSON
}

// ====================================
// Tipos adicionales para compatibilidad (no usados por ahora)
// ====================================

export interface ProfileAddress {
  id: string;
  userId: string;
  alias: string;
  type: 'home' | 'work' | 'other';
  name: string;
  addressLine1: string;
  addressLine2?: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  isDefault: boolean;
  instructions?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentMethod {
  id: string;
  type: 'credit_card' | 'debit_card' | 'bank_account';
  isDefault: boolean;
  alias: string;
  last4Digits: string;
  expirationDate?: string;
  brand?: string;
  isActive: boolean;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export interface ProductImage {
  id: string;
  url: string;
  alt?: string;
}

export interface SimplifiedProduct {
  id: string;
  name: string;
  images: ProductImage[];
  price?: number;
  category?: string;
  brand?: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  product: SimplifiedProduct;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  addedAt: Date;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
  currency: string;
  items: OrderItem[];
  createdAt: Date;
  estimatedDelivery?: Date;
  shippingAddress: ProfileAddress;
}

export interface Credits {
  balance: number;
  currency: string;
  lastUpdate: Date;
}

export interface Coupon {
  id: string;
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderValue?: number;
  expirationDate: Date;
  isUsed: boolean;
}

export interface LoyaltyProgram {
  level: string;
  points: number;
  nextLevelPoints: number;
  benefits: string[];
}

export type InvoiceStatus = 'paid' | 'pending' | 'overdue' | 'cancelled';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  orderNumber: string;
  status: InvoiceStatus;
  issueDate: Date;
  dueDate?: Date;
  paidDate?: Date;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  currency: string;
  items: OrderItem[];
  billingAddress: ProfileAddress;
  paymentMethod?: PaymentMethod;
  downloadUrl?: string;
  notes?: string;
}

export interface ProfilePreferences {
  categories: string[];
  brands: string[];
  priceRange: { min: number; max: number };
  themes: string[];
  notifications: {
    email: boolean;
    push: boolean;
    marketing: boolean;
  };
  shopping: {
    preferredPayment: string;
    preferredShipping: string;
    wishlist: string[];
  };
}
