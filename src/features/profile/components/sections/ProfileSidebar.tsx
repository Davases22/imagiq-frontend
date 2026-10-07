"use client";

/**
 * Menu lateral del perfil. Solo aparece desde lg: por debajo de ese ancho el
 * perfil sigue siendo una pila de tarjetas, que es como funciona bien en movil.
 *
 * Existe porque en escritorio el perfil era una columna estrecha centrada con
 * medio ancho de pantalla vacio a cada lado, y para cambiar de seccion habia
 * que entrar y volver al indice cada vez.
 */

import React from "react";
import { CreditCard, IdCard, LogOut, MapPin, ShoppingBag, User } from "lucide-react";

export type VistaPerfil =
  | "main"
  | "addresses"
  | "payment-methods"
  | "coupons"
  | "loyalty"
  | "orders"
  | "profile";

interface ProfileSidebarProps {
  nombre: string;
  apellido?: string;
  email: string;
  vistaActual: VistaPerfil;
  onCambiarVista: (vista: VistaPerfil) => void;
  onLogout: () => void;
  totalDirecciones: number;
  totalTarjetas: number;
}

/** Iniciales para el avatar: "Andrey Plazas" -> "AP". */
function iniciales(nombre: string, apellido?: string): string {
  const a = nombre?.trim()?.[0] ?? "";
  const b = apellido?.trim()?.[0] ?? "";
  return (a + b).toUpperCase() || "?";
}

export default function ProfileSidebar({
  nombre,
  apellido,
  email,
  vistaActual,
  onCambiarVista,
  onLogout,
  totalDirecciones,
  totalTarjetas,
}: ProfileSidebarProps) {
  const opciones: {
    vista: VistaPerfil;
    etiqueta: string;
    Icono: typeof User;
    contador?: number;
  }[] = [
    { vista: "main", etiqueta: "Resumen", Icono: User },
    { vista: "profile", etiqueta: "Perfil", Icono: IdCard },
    { vista: "orders", etiqueta: "Mis pedidos", Icono: ShoppingBag },
    { vista: "addresses", etiqueta: "Direcciones", Icono: MapPin, contador: totalDirecciones },
    { vista: "payment-methods", etiqueta: "Métodos de pago", Icono: CreditCard, contador: totalTarjetas },
  ];

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-28 space-y-6">
        <div className="rounded-3xl border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-gray-900 text-lg font-bold text-white">
              {iniciales(nombre, apellido)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-gray-900">
                {[nombre, apellido].filter(Boolean).join(" ")}
              </p>
              {/* truncate y no break-all: partir por caracteres dejaba cosas
                  como "…plazas@gmail" / "com" en dos lineas. Entero en el
                  title, para quien necesite leerlo completo. */}
              <p className="truncate text-sm text-gray-500" title={email}>
                {email}
              </p>
            </div>
          </div>
        </div>

        <nav className="overflow-hidden rounded-3xl border border-gray-200 bg-white">
          {opciones.map(({ vista, etiqueta, Icono, contador }) => {
            const activa = vistaActual === vista;
            return (
              <button
                key={vista}
                type="button"
                onClick={() => onCambiarVista(vista)}
                aria-current={activa ? "page" : undefined}
                className={`flex w-full items-center gap-3 border-b border-gray-100 px-5 py-4 text-left text-sm transition-colors last:border-b-0 ${
                  activa
                    ? "bg-gray-900 font-semibold text-white"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Icono
                  className={`h-4 w-4 flex-shrink-0 ${activa ? "text-white" : "text-gray-400"}`}
                  aria-hidden="true"
                />
                <span className="flex-1">{etiqueta}</span>
                {typeof contador === "number" && contador > 0 && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      activa ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {contador}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-2 rounded-3xl border border-gray-200 bg-white px-5 py-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          <LogOut className="h-4 w-4 text-gray-400" aria-hidden="true" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
