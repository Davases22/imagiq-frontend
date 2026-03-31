import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Lista de rutas estáticas conocidas del sistema
 * Estas NO deben pasar por validación de slug
 *
 * IMPORTANTE: Mantener actualizada con las carpetas en /app
 */
const KNOWN_ROUTES = new Set([
  // Rutas del sistema
  "productos",
  "categorias",
  "carrito",
  "checkout",
  "cuenta",
  "perfil",
  "buscar",
  "ofertas",
  "tiendas",
  "favoritos",
  "soporte",
  "support",
  "ventas-corporativas",

  // Rutas de seguimiento y compras
  "verify-purchase",
  "purchase",
  "order",
  "pedido",
  "payment",
  "pago",
  "error-checkout",
  "success-checkout",
  "charging-result",
  "tracking-service",
  "pickup-tracking",
  "imagiq-tracking",

  // Información
  "nosotros",
  "contacto",
  "ayuda",

  // Autenticación
  "auth",
  "login",
  "register",

  // Admin
  "admin",
  "dashboard",
  "chatbot",

  // API
  "api",
]);

// Cache de slugs válidos
let validSlugs: Set<string> | null = null;
let lastFetch = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

/**
 * Obtiene la lista de slugs válidos del backend
 */
async function getValidSlugs(): Promise<Set<string>> {
  const now = Date.now();

  // Si tiene cache y no ha expirado, retornar cache
  if (validSlugs && now - lastFetch < CACHE_DURATION) {
    return validSlugs;
  }

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const endpoint = `${apiUrl}/api/multimedia/pages/slugs/active`;

    const response = await fetch(endpoint, {
      cache: "no-store",
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const slugs: string[] = await response.json();
    validSlugs = new Set(slugs);
    lastFetch = now;

    //console.log(`[Middleware] ✅ Cached ${slugs.length} valid slugs`);
    return validSlugs;
  } catch (error) {
    console.error("[Middleware] ❌ Error fetching slugs:", error);
    // Si falla y no hay cache, retornar set vacío (modo fail-closed)
    // Esto previene peticiones al backend pero puede causar 404 temporales
    return validSlugs || new Set();
  }
}

/**
 * Middleware que valida slugs antes de llegar al componente [slug]
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Excluir archivos estáticos y API
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/ingest") ||
    pathname.startsWith("/static") ||
    pathname.includes(".") ||
    pathname === "/"
  ) {
    return NextResponse.next();
  }

  // Extraer primer segmento
  const segments = pathname.split("/").filter(Boolean);
  const firstSegment = segments[0];

  if (!firstSegment) {
    return NextResponse.next();
  }

  // Normalizar: convertir puntos a guiones para compatibilidad
  // Ejemplo: ventas.corporativas -> ventas-corporativas
  const normalizedSegment = firstSegment.replace(/\./g, "-").toLowerCase();

  // Si es una ruta conocida del sistema, dejar pasar SIN validar
  if (KNOWN_ROUTES.has(normalizedSegment)) {
    return NextResponse.next();
  }

  // Preview mode: dejar pasar sin validar slug (usado por el dashboard para vista previa)
  if (request.nextUrl.searchParams.get("mode") === "preview") {
    return NextResponse.next();
  }

  // Validar que el slug esté en la lista de activos
  const validSlugSet = await getValidSlugs();

  // Si el slug no está en la lista, retornar 404
  if (!validSlugSet.has(firstSegment)) {
    console.log(`[Middleware] ❌ Slug not found: ${firstSegment}`);
    return new NextResponse(null, { status: 404 });
  }

  // Slug válido, continuar
  console.log(`[Middleware] ✅ Valid slug: ${firstSegment}`);
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
