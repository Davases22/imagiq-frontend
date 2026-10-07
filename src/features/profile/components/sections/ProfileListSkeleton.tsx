/**
 * Esqueleto de carga para las listas del perfil (direcciones, tarjetas,
 * pedidos).
 *
 * Existe porque esas pantallas pintaban su estado vacio mientras el perfil
 * todavia estaba cargando: se leia "No tienes direcciones" y un instante
 * despues aparecian. Decirle a alguien que no tiene nada, para desdecirse medio
 * segundo mas tarde, es peor que no decir nada.
 */

export default function ProfileListSkeleton({
  filas = 3,
}: {
  /** Cuantas tarjetas falsas dibujar. */
  filas?: number;
}) {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando…</span>
      {Array.from({ length: filas }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border border-gray-200 bg-white p-5"
        >
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2.5">
              <div className="h-4 w-1/3 rounded bg-gray-200" />
              <div className="h-3 w-2/3 rounded bg-gray-100" />
              <div className="h-3 w-1/2 rounded bg-gray-100" />
            </div>
            <div className="h-8 w-20 flex-shrink-0 rounded-lg bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
