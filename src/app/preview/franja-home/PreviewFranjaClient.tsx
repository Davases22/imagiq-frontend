"use client";

import ProductCard, {
  ProductCardProps,
} from "@/app/productos/components/ProductCard";

/**
 * Misma disposición que ProductShowcase en la home: cuatro columnas en
 * escritorio y scroll horizontal en móvil. Si aquí se viera distinto, la vista
 * previa dejaría de servir para lo único que sirve.
 *
 * Los favoritos van deshabilitados a propósito: esto se ve dentro del
 * dashboard, donde no hay sesión de comprador y el corazón no debe hacer nada.
 */
export default function PreviewFranjaClient({
  productos,
}: {
  productos: ProductCardProps[];
}) {
  return (
    <div className="w-full bg-white px-4 py-6">
      <div className="mx-auto w-full" style={{ maxWidth: "1440px" }}>
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-[25px]">
          {productos.map((product) => (
            <ProductCard
              key={product.id}
              {...product}
              forceNuevo
              isFavorite={false}
            />
          ))}
        </div>

        <div className="md:hidden overflow-x-auto scrollbar-hide">
          <div className="flex gap-3">
            {productos.map((product) => (
              <div key={product.id} className="shrink-0 w-[75vw] sm:w-[280px]">
                <ProductCard {...product} forceNuevo isFavorite={false} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
