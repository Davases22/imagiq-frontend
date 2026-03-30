/**
 * Servicio para páginas multimedia dinámicas
 */

import { apiGet } from "@/lib/api-client";

export interface ProductSection {
  id: string;
  name: string;
  order: number;
  product_card_ids: string[];
}

export interface ProductCardData {
  id: string;
  page_id: string;
  image_url: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  cta_text: string | null;
  cta_url: string | null;
  url: string | null;
  content_position: Record<string, unknown> | null;
  text_styles: {
    title?: { color?: string; [key: string]: unknown };
    subtitle?: { color?: string; [key: string]: unknown };
    description?: { color?: string; [key: string]: unknown };
    cta?: { color?: string; backgroundColor?: string; [key: string]: unknown };
  } | null;
  status: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

// Estructura del contenido de Tiptap
export interface TiptapContent {
  type: 'doc';
  content: TiptapNode[];
}

export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: TiptapMark[];
  text?: string;
}

export interface TiptapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

// Secciones para navegación lateral en documentos legales
export interface LegalSection {
  id: string;
  title: string;
  level: number;
}

// Configuración de campos del formulario
export interface FormField {
  id: string;
  type: 'text' | 'email' | 'phone' | 'number' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'date' | 'address' | 'paragraph';
  label: string;
  placeholder?: string;
  required: boolean;
  order: number;
  options?: string[];
  validation?: {
    min_length?: number;
    max_length?: number;
    pattern?: string;
    message?: string;
  };
  width: 'full' | 'half';
  content?: string;
}

export interface FormConfig {
  fields: FormField[];
  submit_button_text: string;
  submit_button_style?: {
    background_color?: string;
    text_color?: string;
    border_radius?: string;
  };
}

export interface FormLayout {
  type: 'banner_top' | 'banner_left' | 'banner_right' | 'banner_behind' | 'form_only';
  banner_width?: number;
  form_width?: number;
  form_max_width?: string;
  background_color?: string;
  form_background_color?: string;
  banner_overlay_opacity?: number;
}

export interface FormSuccessConfig {
  type: 'message' | 'redirect';
  message?: string;
  redirect_url?: string;
}

export interface LivestreamConfig {
  primary_video_id: string;
  backup_video_id?: string;
  scheduled_start: string;
  scheduled_end?: string;
  enable_chat: boolean;
  enable_countdown: boolean;
  enable_live_badge: boolean;
  enable_replay: boolean;
  autoplay: boolean;
  countdown_title?: string;
  countdown_subtitle?: string;
  countdown_cta_text?: string;
  countdown_cta_url?: string;
  thumbnail_url?: string;
  failover_enabled: boolean;
  failover_message?: string;
  chat_position: 'right' | 'below';
  enable_pip: boolean;
}

export interface MultimediaPage {
  id: string;
  slug: string;
  title: string;
  status: string;
  is_active: boolean;
  is_public: boolean;
  valid_from: string;
  valid_until: string;
  banner_ids: string[];
  faq_ids: string[];
  sections: ProductSection[];
  info_sections: unknown[];
  products_section_title: string | null;
  products_section_description: string | null;
  meta_title: string;
  meta_description: string;
  meta_keywords: string | null;
  og_image: string | null;
  category: string;
  subcategory: string | null;
  tags: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  // Campos SEO adicionales
  seo_og_title?: string | null;
  seo_og_description?: string | null;
  seo_canonical?: string | null;
  seo_no_index?: boolean;
  seo_no_follow?: boolean;
  include_in_sitemap?: boolean;
  // Campos para documentos legales
  page_type?: 'landing' | 'legal' | 'promo' | 'form' | 'livestream';
  legal_content?: TiptapContent | null;
  legal_sections?: LegalSection[];
  last_updated_legal?: string | null;
  // Campos para formularios dinámicos
  form_config?: FormConfig;
  form_layout?: FormLayout;
  form_success_config?: FormSuccessConfig;
  // Campos para livestream
  livestream_config?: LivestreamConfig | null;
}

export interface MultimediaPageBanner {
  id: string;
  name: string;
  placement: string;
  desktop_image_url: string | null;
  desktop_video_url: string | null;
  mobile_image_url: string | null;
  mobile_video_url: string | null;
  link_url: string;
  status: string;
  // LEGACY: Campos del sistema antiguo (mantener para compatibilidad)
  description: string;
  cta: string;
  title: string;
  color_font: string;
  coordinates: string;
  coordinates_mobile: string;
  position_desktop: {
    x: number;
    y: number;
  };
  position_mobile: {
    x: number;
    y: number;
  };
  text_styles: Record<string, unknown> | null;
  title_boxes: string | null;
  description_boxes: string | null;
  cta_boxes: string | null;
  // SISTEMA ACTUAL: ContentBlocks unificado
  content_blocks: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface MultimediaPageFAQ {
  id: string;
  pregunta: string;
  respuesta: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface MultimediaPageData {
  page: MultimediaPage;
  banners: MultimediaPageBanner[];
  faqs: MultimediaPageFAQ[];
  product_cards: ProductCardData[];
}

/**
 * Obtiene las páginas multimedia activas de tipo livestream que tengan PiP habilitado
 */
export async function getActiveLivestreamPages(): Promise<MultimediaPage[]> {
  try {
    const response = await apiGet<{
      data: Array<{ page: MultimediaPage; banners: MultimediaPageBanner[]; faqs: MultimediaPageFAQ[] }>;
      meta: { total: number; page: number; limit: number; totalPages: number };
    }>('/api/multimedia/pages/active?limit=50');

    if (!response?.data || !Array.isArray(response.data)) return [];

    return response.data
      .map((item) => item.page)
      .filter(
        (p) =>
          p.page_type === 'livestream' &&
          p.livestream_config?.enable_pip &&
          p.livestream_config?.primary_video_id,
      );
  } catch (error) {
    console.error('Error fetching active livestream pages:', error);
    return [];
  }
}

/**
 * Obtiene una página multimedia activa por slug
 */
export async function getActivePageBySlug(slug: string): Promise<MultimediaPageData | null> {
  try {
    const response = await apiGet<MultimediaPageData>(
      `/api/multimedia/pages/slug/${slug}`
    );
    
    // Parsear posiciones y text_styles si vienen como strings JSON
    if (response?.banners) {
      response.banners = response.banners.map(banner => ({
        ...banner,
        position_desktop: typeof banner.position_desktop === 'string' 
          ? JSON.parse(banner.position_desktop) 
          : banner.position_desktop,
        position_mobile: typeof banner.position_mobile === 'string' 
          ? JSON.parse(banner.position_mobile) 
          : banner.position_mobile,
        text_styles: typeof banner.text_styles === 'string'
          ? JSON.parse(banner.text_styles)
          : banner.text_styles,
      }));
    }
    
    return response;
  } catch (error) {
    console.error(`Error fetching active page with slug "${slug}":`, error);
    return null;
  }
}
