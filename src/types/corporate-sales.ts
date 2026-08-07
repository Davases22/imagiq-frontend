export interface Industry {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  color: string;
  bgColor: string;
  href: string;
}

export interface CorporateProduct {
  id: string;
  name: string;
  description: string;
  image: string;
  category: string;
  features: string[];
  price?: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  products: CorporateProduct[];
}

export interface ContactFormData {
  companyName: string;
  email: string;
  firstName: string;
  lastName: string;
  industry?: string;
  acceptPrivacy: boolean;
  acceptMarketing: boolean;
}

export interface CorporateLeadAttachment {
  filename: string;
  contentBase64: string;
  contentType?: string;
}

export interface SpecializedConsultationFormData {
  fullName: string;
  phone: string;
  company: string;
  email: string;
  solutionInterest: string[];
  message: string;
  acceptPrivacy: boolean;
  recaptchaToken: string | null;
  /** Imágenes/PDF que el cliente adjunta (van en el correo del lead). */
  attachments?: CorporateLeadAttachment[];
}

export type SolutionInterestOption =
  | "mobile"
  | "electrodomesticos"
  | "pantallas"
  | "climatizacion";
