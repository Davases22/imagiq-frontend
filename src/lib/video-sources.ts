/**
 * Fuentes de video para los banners de la home.
 *
 * Los banners del CMS se suben a Cloudinary y muchos quedan en WebM/VP9, pero
 * el markup declaraba siempre `type="video/mp4"`. En iOS eso deja el banner
 * congelado con el botón de play: Safari no reproduce VP9, y todos los
 * navegadores de iPhone (incluido Chrome) usan el motor de Safari.
 *
 * Cloudinary transcodifica bajo demanda con solo cambiar la extensión, así que
 * ofrecemos MP4 primero (lo entienden todos) y WebM después.
 */

export interface FuenteVideo {
  src: string;
  type: string;
}

const CLOUDINARY_VIDEO = /res\.cloudinary\.com\/[^/]+\/video\/upload\//;
const EXTENSION_VIDEO = /\.(webm|mp4|mov|m4v|ogv)(\?.*)?$/i;

const TIPO_POR_EXTENSION: Record<string, string> = {
  webm: "video/webm",
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  ogv: "video/ogg",
};

function tipoPorExtension(url: string): string {
  const ext = EXTENSION_VIDEO.exec(url)?.[1]?.toLowerCase();
  return (ext && TIPO_POR_EXTENSION[ext]) || "video/mp4";
}

export function fuentesDeVideo(url?: string | null): FuenteVideo[] {
  if (!url || typeof url !== "string") return [];

  // Fuera de Cloudinary no podemos pedir otro formato: se sirve tal cual,
  // pero al menos con el type que corresponde a su extensión.
  if (!CLOUDINARY_VIDEO.test(url) || !EXTENSION_VIDEO.test(url)) {
    return [{ src: url, type: tipoPorExtension(url) }];
  }

  const base = url.replace(EXTENSION_VIDEO, "");
  return [
    { src: `${base}.mp4`, type: "video/mp4" },
    { src: `${base}.webm`, type: "video/webm" },
  ];
}
