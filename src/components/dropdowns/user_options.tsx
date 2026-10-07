import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/features/auth/context";
import { cn } from "@/lib/utils";
import { User, Package, LogOut } from "lucide-react";

/**
 *
 * Props para UserOptionsDropdown
 */
interface UserOptionsDropdownProps {
  showWhiteItems: boolean;
}

/**
 * Dropdown de usuario para el Navbar
 * Diseño limpio y simétrico con posicionamiento relativo
 */
const UserOptionsDropdown: React.FC<UserOptionsDropdownProps> = ({
  showWhiteItems,
}) => {
  const { isAuthenticated, user, logout } = useAuthContext();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const primerNombre = user?.nombre?.split(" ")[0] || "";

  // Manejo simple del dropdown
  const handleToggle = () => setOpen(!open);

  const handleClose = () => setOpen(false);

  // Se abre al pasar por encima, como los submenus del navbar. El cierre lleva
  // un respiro de 150 ms: sin el, al mover el raton del boton hacia el panel se
  // cruza el hueco entre ambos y el menu se cerraba en la cara.
  const cierreDiferido = useRef<ReturnType<typeof setTimeout> | null>(null);

  const abrirPorHover = () => {
    if (cierreDiferido.current) {
      clearTimeout(cierreDiferido.current);
      cierreDiferido.current = null;
    }
    setOpen(true);
  };

  const cerrarPorHover = () => {
    if (cierreDiferido.current) clearTimeout(cierreDiferido.current);
    cierreDiferido.current = setTimeout(() => setOpen(false), 150);
  };

  useEffect(() => {
    return () => {
      if (cierreDiferido.current) clearTimeout(cierreDiferido.current);
    };
  }, []);

  // Cierra el dropdown al hacer click fuera
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // No mostrar el dropdown si:
  // 1. No está autenticado
  // 2. No tiene nombre
  // 3. Es usuario invitado (rol 3) - los invitados no tienen menú de perfil
  const userRole = user?.role ?? user?.rol;
  if (!isAuthenticated || !user?.nombre || userRole === 3) return null;

  return (
    <div
      className="relative"
      ref={dropdownRef}
      onMouseEnter={abrirPorHover}
      onMouseLeave={cerrarPorHover}
    >
      {/* Botón del usuario */}
      <button
        className={cn(
          "flex flex-col items-end justify-center py-2 pb-2 text-xs md:text-sm font-medium leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 rounded-md transition-colors duration-300 hover:opacity-80",
          showWhiteItems ? "text-white" : "text-black",
          // Mismo subrayado que los enlaces del navbar (Dispositivos moviles,
          // TV y Audio...): se despliega de izquierda a derecha al pasar por
          // encima y queda fijo mientras el menu esta abierto.
          !showWhiteItems &&
            "relative after:absolute after:left-0 after:right-0 after:bottom-0 after:h-1 after:bg-blue-500 after:rounded-full after:transition-transform after:duration-200 after:origin-left",
          !showWhiteItems && (open ? "after:scale-x-100" : "after:scale-x-0 hover:after:scale-x-100"),
        )}
        aria-label={primerNombre ? `Opciones de usuario para ${primerNombre}` : "Opciones de tu cuenta"}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={handleToggle}
        type="button"
      >
        {/* Sin nombre quedaba un "Hola," colgando, sin nadie detras. Si no
            sabemos como se llama, se dice "Mi cuenta", que al menos nombra lo
            que hay al otro lado del boton. */}
        {primerNombre ? (
          <>
            <span>Hola,</span>
            <span className="font-semibold">{primerNombre}</span>
          </>
        ) : (
          <span className="font-semibold">Mi cuenta</span>
        )}
      </button>

      {/* Dropdown menu */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-[10000] overflow-hidden"
          role="menu"
          aria-label="Menú de usuario"
        >
          <button
            className="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors duration-150 border-b border-gray-100"
            role="menuitem"
            onClick={() => {
              handleClose();
              router.push("/perfil");
            }}
          >
            <span className="flex items-center gap-2.5">
              <User className="w-4 h-4 text-gray-400 shrink-0" aria-hidden="true" />
              <span>
                <span className="block font-medium">Mi perfil</span>
                <span className="block text-sm text-gray-500">
                  Tus datos y direcciones
                </span>
              </span>
            </span>
          </button>

          <button
            className="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors duration-150 border-b border-gray-100"
            role="menuitem"
            onClick={() => {
              handleClose();
              router.push("/perfil?ver=orders");
            }}
          >
            <span className="flex items-center gap-2.5">
              <Package className="w-4 h-4 text-gray-400 shrink-0" aria-hidden="true" />
              <span>
                <span className="block font-medium">Mis pedidos</span>
                <span className="block text-sm text-gray-500">
                  Sigue tus compras
                </span>
              </span>
            </span>
          </button>

          <button
            className="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors duration-150"
            role="menuitem"
            onClick={() => {
              handleClose();
              logout();
              router.push("/");
            }}
          >
            <span className="flex items-center gap-2.5">
              <LogOut className="w-4 h-4 text-gray-400 shrink-0" aria-hidden="true" />
              <span>
                <span className="block font-medium">Cerrar sesión</span>
                <span className="block text-sm text-gray-500">
                  Salir de tu cuenta
                </span>
              </span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

export default UserOptionsDropdown;
