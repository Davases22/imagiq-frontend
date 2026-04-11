"use client";

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  type CSSProperties,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { User, Menu, X, Heart, MapPin, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavbarLogic } from "@/hooks/navbarLogic";
import { posthogUtils } from "@/lib/posthogClient";
import { useVisibleCategories } from "@/hooks/useVisibleCategories";
import { useLogos } from "@/hooks/useLogos";
import { usePreloadCategoryMenus } from "@/hooks/usePreloadCategoryMenus";
import { usePrefetchProducts } from "@/hooks/usePrefetchProducts";
import type { ProductFilterParams } from "@/lib/api";
import { executeBatchPrefetch } from "@/lib/batchPrefetch";
import { usePrefetchCoordinator } from "@/hooks/usePrefetchCoordinator";
import { useOfertasDirectas } from "@/hooks/useOfertasDirectas";
import { usePrefetchOfertas } from "@/hooks/usePrefetchOfertas";
import { useHeroContext } from "@/contexts/HeroContext";
import OfertasDropdown from "./dropdowns/ofertas";
import ServicioTecnicoDropdown from "./dropdowns/servicio_tecnico";
import DynamicDropdown from "./dropdowns/dynamic";
import UserOptionsDropdown from "@/components/dropdowns/user_options";
import { useAuthContext } from "@/features/auth/context";
import { useDefaultAddress } from "@/hooks/useDefaultAddress";
import AddressDropdown from "./navbar/AddressDropdown";
import {
  MobileMenu,
  CartIcon,
  SearchBar,
  NavbarLogo,
} from "./navbar/components";
import { hasDropdownMenu, getDropdownPosition } from "./navbar/utils/helpers";
import { isStaticCategoryUuid } from "@/constants/staticCategories";
import type { DropdownName, NavItem } from "./navbar/types";

type AddressLike = {
  ciudad?: string | null;
  direccionFormateada?: string | null;
  lineaUno?: string | null;
  nombreDireccion?: string | null;
};

const getShortAddressLabel = (address: AddressLike | null): string => {
  if (!address) return "";

  const { direccionFormateada, ciudad, lineaUno } = address;

  // If no formatted address and no line one, return city
  if ((!direccionFormateada || direccionFormateada.trim().length === 0) &&
      (!lineaUno || lineaUno.trim().length === 0)) {
    return ciudad || "";
  }

  // Use formatted address or line one
  const fullAddress = (direccionFormateada && direccionFormateada.trim()) ||
                      (lineaUno && lineaUno.trim()) || "";

  // If no city, return address as is
  if (!ciudad || ciudad.trim().length === 0) {
    return fullAddress;
  }

  // Find city in the full address and extract up to it (including the city)
  const cityIndex = fullAddress.indexOf(ciudad);
  if (cityIndex !== -1) {
    // Extract up to city name + city length
    const addressUpToCity = fullAddress.substring(0, cityIndex + ciudad.length);
    return addressUpToCity;
  }

  // Fallback: if city not found in address, just return the full address
  return fullAddress;
};

export default function Navbar() {
  const navbar = useNavbarLogic();
  const { theme } = useHeroContext();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { getNavbarRoutes, loading } = useVisibleCategories();
  const { isAuthenticated, user } = useAuthContext();
  const { address: defaultMobileAddress } = useDefaultAddress("ENVIO");
  const { logoDark, logoLight } = useLogos();

  // Pre-cargar menús de todas las categorías dinámicas al cargar la página
  // La función prioritizeCategory permite priorizar la carga cuando el usuario hace hover
  const { getMenus, isLoading, prioritizeCategory } = usePreloadCategoryMenus();

  // Hook para prefetch de productos cuando el usuario hace hover sobre categorías
  const { prefetchWithDebounce, cancelPrefetch, prefetchProducts } =
    usePrefetchProducts();
  const { shouldPrefetch } = usePrefetchCoordinator();

  // Hook para prefetch de las 4 secciones de ofertas
  const { prefetchAllOfertas } = usePrefetchOfertas();

  // Precargar ofertas destacadas al montar el navbar
  // Esto asegura que los datos estén en caché cuando el usuario abra el dropdown
  const { ofertas: ofertasPreload } = useOfertasDirectas();


  // Ref para rastrear qué categorías ya se están precargando automáticamente
  const autoPrefetchingRef = useRef<Set<string>>(new Set());

  // Ref para rastrear qué categorías ya fueron precargadas automáticamente
  const autoPrefetchedRef = useRef<Set<string>>(new Set());

  // Ref para el timer de inicio de precarga automática
  const autoPrefetchStartTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  // Función para obtener el componente dropdown apropiado
  const getDropdownComponent = (name: DropdownName, item?: NavItem) => {
    const props = { isMobile: false };

    // Si el item tiene uuid de categoría y NO es una categoría estática, usar DynamicDropdown
    if (item?.uuid && !isStaticCategoryUuid(item.uuid)) {
      const categoryUuid = item.uuid;
      // Usar menús precargados en lugar de estado local
      const cachedMenus = getMenus(categoryUuid) || [];
      const menusLoading = isLoading(categoryUuid);

      // Siempre usar DynamicDropdown para categorías dinámicas
      // Muestra loading mientras cargan los menús o los menús si ya están cargados
      return (
        <DynamicDropdown
          menus={cachedMenus}
          categoryName={item.name}
          categoryCode={item.categoryCode || ""}
          categoryVisibleName={item.categoryVisibleName}
          isMobile={false}
          loading={menusLoading}
        />
      );
    }

    // Fallback a dropdowns estáticos solo para categorías especiales
    switch (name) {
      case "Ofertas":
        return <OfertasDropdown {...props} />;
      case "Servicio Técnico":
        return <ServicioTecnicoDropdown {...props} />;
      default:
        return null;
    }
  };

  // Sistema de precarga automática de productos de categoría + menús
  // NOTA: El prefetch automático en background fue eliminado para evitar redundancia
  // con usePreloadAllProducts que ya precarga todas las combinaciones.
  // Solo mantenemos el prefetch en hover que es más prioritario y útil.

  useEffect(() => {
    const handleResize = () => {
      const width = globalThis.innerWidth;
      if (width >= 1280) {
        setMobileMenuOpen(false);
      }
    };

    // Listener para cerrar dropdown cuando se dispara el evento personalizado
    const handleCloseDropdown = () => {
      navbar.setActiveDropdown(null);
    };

    // Ejecutar una vez al montar
    handleResize();

    globalThis.addEventListener("resize", handleResize);
    globalThis.addEventListener(
      "close-dropdown",
      handleCloseDropdown as EventListener
    );

    return () => {
      globalThis.removeEventListener("resize", handleResize);
      globalThis.removeEventListener(
        "close-dropdown",
        handleCloseDropdown as EventListener
      );
    };
  }, [navbar]);

  // Variables derivadas para sincronizar con HeroContext
  const useHeroTheme =
    (navbar.isOfertas || navbar.isHome) && !navbar.isScrolled;

  // Si hay un dropdown activo, forzar todo a negro
  const shouldShowWhiteLogo = navbar.activeDropdown
    ? false
    : navbar.isOfertas && !navbar.isScrolled
      ? true
      : useHeroTheme
        ? theme === "light"
        : navbar.showWhiteLogo;

  const shouldShowWhiteItems = navbar.activeDropdown
    ? false
    : navbar.isOfertas && !navbar.isScrolled
      ? true
      : useHeroTheme
        ? theme === "light"
        : navbar.showWhiteItems;

  const shouldShowWhiteItemsMobile = mobileMenuOpen
    ? false
    : navbar.isOfertas && !navbar.isScrolled
      ? true
      : useHeroTheme
        ? theme === "light"
        : navbar.showWhiteItemsMobile;

  const mobileAddressData = useMemo<AddressLike | null>(
    () =>
      (defaultMobileAddress as AddressLike | null) ??
      (user?.defaultAddress as AddressLike | null) ??
      null,
    [defaultMobileAddress, user?.defaultAddress]
  );

  const mobileAddressLabel = useMemo(
    () => getShortAddressLabel(mobileAddressData),
    [mobileAddressData]
  );

  const shouldShowMobileAddressLabel = Boolean(
    isAuthenticated && mobileAddressData && mobileAddressLabel.length > 0
  );

  const getIconColorClasses = (forMobile = false): string => {
    // Si hay un dropdown activo, siempre negro
    if (navbar.activeDropdown) {
      return "text-black";
    }

    // Si estamos en ofertas sin scroll, siempre blanco
    if (navbar.isOfertas && !navbar.isScrolled) {
      return "text-white";
    }

    // Siempre negro en páginas de productos
    if (
      navbar.isElectrodomesticos ||
      navbar.isDispositivosMoviles ||
      navbar.isMasInformacionProducto
    ) {
      return "text-black";
    }

    // Si estamos en home sin scroll, usar tema del Hero
    if (useHeroTheme) {
      return theme === "light" ? "text-white" : "text-black";
    }

    // Fallback a comportamiento por defecto
    if (forMobile) {
      return shouldShowWhiteItemsMobile ? "text-white" : "text-black";
    }
    return shouldShowWhiteItems ? "text-white" : "text-black";
  };

  // Obtener las rutas dinámicas desde el hook
  const menuRoutes: NavItem[] = getNavbarRoutes();

  // Determinar si debe mostrar fondo transparente o blanco
  const showTransparentBg =
    (navbar.isOfertas || navbar.isHome) &&
    !navbar.activeDropdown &&
    !navbar.isScrolled &&
    !mobileMenuOpen;

  const forceWhiteBg = mobileMenuOpen || !showTransparentBg;

  const headerStyles: CSSProperties = {
    fontFamily:
      '"SamsungOne","Samsung Sharp Sans","Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial',
    boxShadow: navbar.isScrolled && !navbar.isMultimedia ? "0 2px 8px rgba(0,0,0,0.1)" : "none",
    background: forceWhiteBg ? "white" : "transparent",
    transition: mobileMenuOpen ? "none" : "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  };

  return (
    <>
      <div
        ref={navbar.sentinelRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1,
          height: 1,
          pointerEvents: "none",
        }}
        aria-hidden="true"
      />

      <header
        data-navbar="true"
        className={cn(
          "w-full z-50 transition-all duration-300 fixed",
          !navbar.showNavbar ? "-translate-y-full" : "translate-y-0"
        )}
        style={{
          ...headerStyles,
          top: 0,
          left: 0,
          right: 0,
        }}
      >
        {/* Mobile/Tablet Header con hamburguesa - Mostrar en pantallas < 1280px */}
        <div
          className={cn(
            "xl:hidden px-4 py-3 flex items-center justify-between transition-colors duration-300 min-h-16",
            mobileMenuOpen && "relative z-[10000] bg-white"
          )}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Link
              href="/"
              onClick={(e) => {
                e.preventDefault();
                posthogUtils.capture("logo_click", { source: "navbar" });
                navbar.router.push("/");
              }}
              aria-label="Inicio"
              className="flex items-center gap-2 shrink-0"
            >
              <Image
                src={
                  shouldShowWhiteItemsMobile
                    ? logoLight?.image_url || "/frame_white.png"
                    : logoDark?.image_url || "/frame_black.png"
                }
                alt="Q Logo"
                height={40}
                width={40}
                className="h-10 w-10 transition-all duration-300"
                priority
              />
            </Link>
            {shouldShowMobileAddressLabel ? (
              <div className="flex-1 min-w-0 xl:hidden">
                <AddressDropdown
                  showWhiteItems={shouldShowWhiteItemsMobile}
                  renderMobileTrigger={({ onClick }) => (
                    <button
                      type="button"
                      onClick={onClick}
                      className={cn(
                        "flex items-center gap-0.5 hover:opacity-80 transition-opacity",
                        shouldShowWhiteItemsMobile ? "text-white" : "text-black"
                      )}
                      title={mobileAddressLabel}
                    >
                      <p className="text-[11px] leading-tight text-left">
                        <span className="font-medium opacity-80">Enviar a </span>
                        <span className="font-bold">{mobileAddressLabel}</span>
                      </p>
                      <ChevronDown className="w-3 h-3 flex-shrink-0" />
                    </button>
                  )}
                />
              </div>
            ) : (
              <Link
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  posthogUtils.capture("logo_click", {
                    source: "navbar_samsung",
                  });
                  navbar.router.push("/");
                }}
                aria-label="Inicio Samsung"
                className="flex items-center"
              >
                <Image
                  src="https://res.cloudinary.com/dnglv0zqg/image/upload/v1760575601/Samsung_black_ec1b9h.svg"
                  alt="Samsung"
                  height={30}
                  width={100}
                  className={cn(
                    "h-7 w-auto transition-all duration-300",
                    shouldShowWhiteItemsMobile && "brightness-0 invert"
                  )}
                  priority
                />
              </Link>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2"
              aria-label="Buscar"
            >
              <Search
                className={cn(
                  "w-5 h-5 transition-colors duration-300",
                  shouldShowWhiteItemsMobile ? "text-white" : "text-black"
                )}
              />
            </button>
            <CartIcon
              count={navbar.itemCount}
              showBump={false}
              isClient={navbar.isClient}
              onClick={navbar.handleCartClick}
              colorClass={
                shouldShowWhiteItemsMobile ? "text-white" : "text-black"
              }
            />
            {/* Solo mostrar dropdown si está autenticado, tiene nombre Y NO es invitado (rol 3) */}
            {navbar.isAuthenticated && navbar.user?.nombre && (navbar.user?.role ?? navbar.user?.rol) !== 3 ? (
              <UserOptionsDropdown
                showWhiteItems={shouldShowWhiteItemsMobile}
              />
            ) : (
              <button
                className="p-2 cursor-pointer active:scale-95 transition-transform duration-150 ease-out"
                aria-label="Usuario"
                onClick={() => globalThis.location.replace("/login")}
              >
                <User
                  className={cn(
                    "w-6 h-6 transition-colors duration-300",
                    shouldShowWhiteItemsMobile ? "text-white" : "text-black"
                  )}
                />
              </button>
            )}
            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="p-2 relative w-10 h-10 flex items-center justify-center"
              aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            >
              <X
                className={cn(
                  "w-6 h-6 absolute transition-all duration-200",
                  shouldShowWhiteItemsMobile ? "text-white" : "text-black",
                  mobileMenuOpen ? "opacity-100 rotate-0" : "opacity-0 rotate-90"
                )}
              />
              <Menu
                className={cn(
                  "w-6 h-6 absolute transition-all duration-200",
                  shouldShowWhiteItemsMobile ? "text-white" : "text-black",
                  mobileMenuOpen ? "opacity-0 -rotate-90" : "opacity-100 rotate-0"
                )}
              />
            </button>
          </div>
        </div>

        {/* Desktop Header completo - Mostrar en pantallas >= 1280px */}
        <div className="hidden xl:flex px-4 sm:px-6 lg:px-8 py-4 min-h-[100px] items-end justify-between gap-4 2xl:gap-8">
          <div className="flex items-center gap-2.5 xl:gap-3.5 2xl:gap-5 min-w-0 flex-1">
            <NavbarLogo
              showWhiteLogo={shouldShowWhiteLogo}
              onNavigate={() => navbar.router.push("/")}
            />

            <nav className="min-w-0 flex-1">
              <ul className="flex items-center gap-1.5 xl:gap-2.5 2xl:gap-5">
                {loading ? (
                  // Skeleton loader
                  <>
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <li key={i} className="shrink-0">
                        <div className="h-6 w-20 xl:w-24 2xl:w-28 bg-gray-200 rounded animate-pulse" />
                      </li>
                    ))}
                  </>
                ) : (
                  menuRoutes.map((item) => {
                    const dropdownKey = item.dropdownName || item.name;

                    return (
                      <li key={item.name} className="relative shrink-0">
                        <div
                          data-item-name={dropdownKey}
                          ref={navbar.setNavItemRef}
                          onMouseEnter={() => {
                            // Prefetch de ofertas cuando se hace hover en el link "Ofertas"
                            if (item.name === "Ofertas" && item.href === "/ofertas") {
                              prefetchAllOfertas().catch(() => {
                                // Silenciar errores
                              });
                            }

                            if (hasDropdownMenu(dropdownKey, item)) {
                              navbar.handleDropdownEnter(
                                dropdownKey as DropdownName
                              );
                              // Priorizar la carga del menú si es una categoría dinámica
                              // Esto asegura que el menú se cargue inmediatamente al hacer hover
                              if (
                                item.uuid &&
                                !isStaticCategoryUuid(item.uuid)
                              ) {
                                prioritizeCategory(item.uuid);
                              }
                            }

                            // Prefetch productos de la categoría base cuando hay categoryCode
                            // Esto mejora la velocidad percibida al hacer clic en la categoría
                            // Al hacer hover, se PRIORIZA esta categoría (se acelera el prefetch)
                            if (item.categoryCode && item.uuid) {
                              // Marcar que esta categoría se está precargando por hover (priorizada)
                              // Esto evita que el sistema automático la procese si ya se está precargando
                              autoPrefetchingRef.current.add(item.uuid);

                              // Prefetch de la categoría base (priorizado - sin delay adicional)
                              prefetchProducts({
                                categoryCode: item.categoryCode,
                              });

                              // Prefetch de todos los menús de esta categoría (priorizado usando batch)
                              // Esperar un poco para que los menús se carguen si aún no están disponibles
                              const initialTimer = setTimeout(async () => {
                                if (
                                  item.uuid &&
                                  !isStaticCategoryUuid(item.uuid)
                                ) {
                                  const menus = getMenus(item.uuid) || [];

                                  // Construir parámetros para batch request
                                  const buildParams = (menuUuid?: string): ProductFilterParams => ({
                                    page: 1,
                                    limit: 50,
                                    precioMin: 1,
                                    lazyLimit: 6,
                                    lazyOffset: 0,
                                    sortBy: "precio",
                                    sortOrder: "desc",
                                    categoria: item.categoryCode!,
                                    ...(menuUuid && { menuUuid }),
                                  });

                                  // Recopilar combinaciones de menús usando coordinador
                                  const menuCombinations: ProductFilterParams[] = [];
                                  
                                  for (const menu of menus) {
                                    if (menu.activo && menu.uuid && item.categoryCode) {
                                      const params = buildParams(menu.uuid);
                                      if (shouldPrefetch(params)) {
                                        menuCombinations.push(params);
                                      }
                                    }
                                  }

                                  // Si hay combinaciones, hacer batch request usando helper centralizado
                                  if (menuCombinations.length > 0) {
                                    await executeBatchPrefetch(menuCombinations, 'Navbar-hover');
                                  }

                                  // Marcar como precargado por hover
                                  autoPrefetchedRef.current.add(item.uuid);
                                }
                              }, 50); // Esperar solo 50ms (más rápido que automático)
                            }
                          }}
                          onMouseLeave={() => {
                            navbar.handleDropdownLeave();

                            // Cancelar prefetch cuando el usuario deja de hacer hover
                            if (item.categoryCode) {
                              // Cancelar prefetch de la categoría base
                              cancelPrefetch({
                                categoryCode: item.categoryCode,
                              });

                              // Cancelar prefetches de todos los menús de esta categoría
                              if (
                                item.uuid &&
                                !isStaticCategoryUuid(item.uuid)
                              ) {
                                const menus = getMenus(item.uuid) || [];
                                menus.forEach((menu) => {
                                  if (
                                    menu.activo &&
                                    menu.uuid &&
                                    item.categoryCode
                                  ) {
                                    cancelPrefetch({
                                      categoryCode: item.categoryCode,
                                      menuUuid: menu.uuid,
                                    });
                                  }
                                });
                              }
                            }
                          }}
                          className="relative inline-block"
                        >
                          <Link
                            href={item.href}
                            onClick={(e) => {
                              // Prefetch de ofertas cuando se hace click en el link "Ofertas"
                              if (item.name === "Ofertas" && item.href === "/ofertas") {
                                prefetchAllOfertas().catch(() => {
                                  // Silenciar errores
                                });
                              }

                              // Prevenir navegación por defecto del Link
                              e.preventDefault();
                              // 🔥 Disparar analytics antes de navegar
                              navbar.handleNavClick(item);
                              // Cerrar dropdown inmediatamente
                              navbar.setActiveDropdown(null);
                              // Navegar de forma programática (instantáneo)
                              navbar.router.push(item.href);
                            }}
                            className={cn(
                              "whitespace-nowrap px-0.5 py-1 pb-2 text-[13px] xl:text-[13.5px] 2xl:text-[15.5px] leading-6 font-semibold  tracking-tight relative inline-block transition-colors duration-200",
                              shouldShowWhiteItems
                                ? navbar.activeDropdown
                                  ? "text-black hover:text-blue-600"
                                  : "text-white hover:opacity-90"
                                : "text-black hover:text-blue-600",
                              !shouldShowWhiteItems &&
                              "after:absolute after:left-0 after:right-0 after:bottom-0 after:h-1 after:bg-blue-500 after:rounded-full after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-200 after:origin-left"
                            )}
                          >
                            {item.name}
                          </Link>

                          {navbar.activeDropdown === dropdownKey &&
                            hasDropdownMenu(dropdownKey, item) && (
                              <div
                                className="fixed left-0 right-0 z-[9999] bg-white shadow-xl"
                                style={{
                                  top: `${getDropdownPosition(dropdownKey).top}px`,
                                }}
                              >
                                <div
                                  className={
                                    dropdownKey === "Ofertas"
                                      ? "w-full pl-4 pr-8"
                                      : "mx-auto max-w-screen-2xl"
                                  }
                                >
                                  {getDropdownComponent(
                                    dropdownKey as DropdownName,
                                    item
                                  )}
                                </div>
                              </div>
                            )}
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
            </nav>
          </div>

          <div className="hidden lg:flex flex-col items-start justify-between flex-none min-w-[320px] xl:min-w-[340px] 2xl:min-w-[380px]">
            <div className="w-full flex items-center justify-end gap-4">
              {/* Dirección predeterminada del usuario con dropdown */}
              {/* Se muestra siempre: si no está logueado, muestra "Agregar dirección" y redirige a login */}
              <div className="flex-none min-w-0 w-[200px] xl:w-[220px] 2xl:w-[260px]">
                <AddressDropdown showWhiteItems={shouldShowWhiteItems} />
              </div>

              <Link
                href="/ventas-corporativas"
                className={cn(
                  "text-[13px] md:text-[13.5px] font-bold whitespace-nowrap shrink-0",
                  shouldShowWhiteItems
                    ? "text-white/90 hover:text-white"
                    : "text-black"
                )}
                title="Para Empresas"
              >
                Para Empresas ↗
              </Link>
            </div>

            <div className="w-full flex items-center justify-end gap-2">
              <SearchBar
                value={navbar.searchQuery}
                onChange={navbar.setSearchQuery}
                onSubmit={navbar.handleSearchSubmit}
              />
              <CartIcon
                count={navbar.itemCount}
                showBump={navbar.bump}
                isClient={navbar.isClient}
                onClick={navbar.handleCartClick}
                colorClass={getIconColorClasses()}
              />
              <Link
                href="/favoritos"
                className={cn(
                  "flex items-center justify-center w-10 h-10",
                  getIconColorClasses()
                )}
                aria-label="Favoritos"
              >
                <Heart className={cn("w-5 h-5", getIconColorClasses())} />
              </Link>
              <div className="flex items-center justify-end">
                {/* Solo mostrar dropdown si está autenticado, tiene nombre Y NO es invitado (rol 3) */}
                {navbar.isAuthenticated && navbar.user?.nombre && (navbar.user?.role ?? navbar.user?.rol) !== 3 ? (
                  <UserOptionsDropdown showWhiteItems={shouldShowWhiteItems} />
                ) : (
                  <button
                    type="button"
                    className={cn(
                      "flex items-center justify-center w-10 h-10 cursor-pointer active:scale-95 transition-transform duration-150 ease-out",
                      getIconColorClasses()
                    )}
                    onClick={() => globalThis.location.replace("/login")}
                    aria-label="Ingresar"
                  >
                    <User className={cn("w-5 h-5", getIconColorClasses())} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* Mobile dropdown menu - positioned relative to header */}
        <MobileMenu
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          searchQuery={navbar.searchQuery}
          onSearchChange={navbar.setSearchQuery}
          onSearchSubmit={navbar.handleSearchSubmit}
        />
      </header>
    </>
  );
}
