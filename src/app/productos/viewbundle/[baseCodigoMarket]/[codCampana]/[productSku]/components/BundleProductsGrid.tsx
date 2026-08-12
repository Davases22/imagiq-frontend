import Link from "next/link";
import Image from "next/image";
import type { BundleProduct } from "@/lib/api";

interface BundleProductsGridProps {
  products: BundleProduct[];
}

/**
 * Grid de productos del bundle con imágenes y botón "Saber más"
 * Muestra cada producto con su imagen, nombre y enlace a su página individual
 */
export function BundleProductsGrid({ products }: BundleProductsGridProps) {
  if (!products || products.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
      {products.map((product) => (
        <ProductCard key={product.sku} product={product} />
      ))}
    </div>
  );
}

function ProductCard({ product }: { product: BundleProduct }) {
  // Extraer solo la parte antes del slash del codigoMarket
  // Ejemplo: "BSM-L320/3R2" -> "BSM-L320"
  const baseCodigoMarket = product.codigoMarket.split('/')[0];
  const productUrl = `/productos/multimedia/${baseCodigoMarket}`;
  
  // BundleProduct.imagePreviewUrl es un string, no un array
  const getValidImageUrl = () => {
    if (product.imagePreviewUrl) {
      // Verificar que sea una URL válida (comienza con http/https o /)
      if (product.imagePreviewUrl.startsWith('http') || product.imagePreviewUrl.startsWith('/')) {
        return product.imagePreviewUrl;
      }
    }
    return "/images/placeholder-product.png";
  };

  const imageUrl = getValidImageUrl();

  // Normaliza valores placeholder ("No aplica", "0", "-", vacío) a "" para no
  // mostrarlos: el cliente no debe ver "No aplica | 50\"" ni "Negro | -".
  const clean = (v?: string) => {
    const s = (v || "").trim();
    if (!s || s === "-" || s === "0" || /^no\s*aplica$/i.test(s)) return "";
    return s;
  };
  const colorLabel = clean(product.nombreColor);
  const capacidadLabel = clean(product.capacidad);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col h-full">
      {/* Imagen del producto */}
      <div className="relative w-full aspect-square bg-gray-50">
        <Image
          src={imageUrl}
          alt={product.modelo}
          fill
          className="object-contain p-4"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
      </div>

      {/* Información del producto */}
      <div className="p-4 flex flex-col flex-grow">
        <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
          {product.modelo}
        </h3>
        
        {/* Detalles (color, capacidad) — placeholders "No aplica"/"0"/"-" se ocultan */}
        {(colorLabel || capacidadLabel) && (
          <div className="text-sm text-gray-600 mb-4">
            {colorLabel && <span>{colorLabel}</span>}
            {colorLabel && capacidadLabel && <span> | </span>}
            {capacidadLabel && <span>{capacidadLabel}</span>}
          </div>
        )}

        {/* Espaciador flexible */}
        <div className="flex-grow" />

        {/* Botón "Saber más" */}
        <Link
          href={productUrl}
          onClick={() => {
            // Guardar la VARIANTE del bundle para que la PDP destino la
            // preseleccione (misma clave/estructura que usa ProductCard). Sin
            // esto la PDP cae a la "mejor"/primera variante (58" en vez de 50",
            // 15kg en vez de 21kg) y confunde al cliente con otro precio.
            try {
              localStorage.setItem(
                `product_selection_${baseCodigoMarket}`,
                JSON.stringify({
                  productId: baseCodigoMarket,
                  productName: product.modelo,
                  price: product.product_discount_price,
                  originalPrice: product.product_original_price,
                  color: product.nombreColor, // nombre display
                  colorHex: product.color, // hex
                  capacity: product.capacidad,
                  ram: product.memoriaram,
                  sku: product.sku,
                  ean: product.ean,
                  image: product.imagePreviewUrl,
                })
              );
            } catch {
              /* localStorage no disponible: navegar sin preselección */
            }
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="mt-4 w-full py-2.5 px-4 bg-white text-gray-900 border-2 border-gray-900 rounded-full font-medium text-center hover:bg-gray-900 hover:text-white transition-colors duration-200"
        >
          Saber más
        </Link>
      </div>
    </div>
  );
}
