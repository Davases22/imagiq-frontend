"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { FC } from "react";
import { hasDropdownMenu } from "../utils/helpers";
import { isStaticCategoryUuid } from "@/constants/staticCategories";
import type { NavItem } from "../types";
import type { Menu } from "@/lib/api";
import { toSlug } from "@/app/productos/[categoria]/utils/slugUtils";
import OfertasDropdown from "@/components/dropdowns/ofertas";
import ServicioTecnicoDropdown from "@/components/dropdowns/servicio_tecnico";

type Props = {
  onClose: () => void;
  menuRoutes: NavItem[];
  loading: boolean;
  expandedCategory: string | null;
  onToggleCategory: (categoryName: string) => void;
  getMenus: (categoryUuid: string) => Menu[] | undefined;
  isMenuLoading: (categoryUuid: string) => boolean;
};

const submenuVariants = {
  hidden: {
    opacity: 0,
    height: 0,
    transition: { duration: 0.25, ease: "easeInOut" as const },
  },
  visible: {
    opacity: 1,
    height: "auto",
    transition: { duration: 0.3, ease: "easeInOut" as const },
  },
};

const getCategorySlug = (
  categoryCode: string,
  categoryVisibleName?: string
): string => {
  if (categoryVisibleName) return toSlug(categoryVisibleName);
  const mapping: Record<string, string> = {
    IM: "dispositivos-moviles",
    AV: "televisores",
    DA: "electrodomesticos",
    IT: "monitores",
    accesorios: "accesorios",
  };
  return mapping[categoryCode] || categoryCode.toLowerCase();
};

const menuNameToSlug = (name: string): string =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

/** Skeleton for loading state */
const MenuSkeleton: FC = () => (
  <div className="space-y-2">
    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
      <div key={i} className="w-full flex items-center justify-between py-3 px-2">
        <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
        <div className="h-5 w-5 bg-gray-200 rounded animate-pulse" />
      </div>
    ))}
  </div>
);

/** Inline submenu skeleton */
const SubmenuSkeleton: FC = () => (
  <div className="grid grid-cols-2 gap-2 px-2 py-2">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="flex items-center gap-2 p-3">
        <div className="w-14 h-14 bg-gray-200 rounded animate-pulse flex-shrink-0" />
        <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
      </div>
    ))}
  </div>
);

/** Dynamic category submenu (API-driven menus) */
const DynamicSubmenuItems: FC<{
  menus: Menu[];
  categoryCode: string;
  categoryVisibleName?: string;
  onClose: () => void;
  loading: boolean;
}> = ({ menus, categoryCode, categoryVisibleName, onClose, loading }) => {
  if (loading) return <SubmenuSkeleton />;

  const activeMenus = menus.filter((m) => m.activo);
  if (activeMenus.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-3 px-4">
        No hay menús disponibles
      </p>
    );
  }

  const categorySlug = getCategorySlug(categoryCode, categoryVisibleName);

  return (
    <div className="grid grid-cols-2 gap-2 px-2 py-2">
      {activeMenus.map((menu) => {
        const seccionSlug = menuNameToSlug(
          menu.nombreVisible || menu.nombre
        );
        return (
          <Link
            key={menu.uuid}
            href={`/productos/${categorySlug}?seccion=${seccionSlug}`}
            onClick={onClose}
            className="flex items-center gap-2 p-3 hover:bg-gray-50 rounded-xl transition-colors"
          >
            {menu.imagen && (
              <div className="w-14 h-14 flex-shrink-0 relative">
                <Image
                  src={menu.imagen}
                  alt={menu.nombreVisible || menu.nombre}
                  fill
                  className="object-contain"
                />
              </div>
            )}
            <span className="text-xs font-semibold text-gray-800 leading-tight">
              {menu.nombreVisible || menu.nombre}
            </span>
          </Link>
        );
      })}
    </div>
  );
};

/** Static dropdown submenu (Ofertas, Servicio Tecnico) */
const StaticSubmenuItems: FC<{
  dropdownName: string;
  onClose: () => void;
}> = ({ dropdownName, onClose }) => {
  switch (dropdownName) {
    case "Ofertas":
      return (
        <div className="py-2">
          <OfertasDropdown isMobile onItemClick={onClose} />
        </div>
      );
    case "Servicio Técnico":
      return (
        <div className="py-2">
          <ServicioTecnicoDropdown isMobile onItemClick={onClose} />
        </div>
      );
    default:
      return null;
  }
};

/** Single menu category item with optional accordion submenu */
const CategoryItem: FC<{
  item: NavItem;
  isExpanded: boolean;
  onToggle: () => void;
  onClose: () => void;
  getMenus: (uuid: string) => Menu[] | undefined;
  isMenuLoading: (uuid: string) => boolean;
}> = ({ item, isExpanded, onToggle, onClose, getMenus, isMenuLoading }) => {
  const dropdownKey = item.dropdownName || item.name;
  const hasDropdown = hasDropdownMenu(dropdownKey, item);

  if (!hasDropdown) {
    return (
      <Link
        href={item.href}
        onClick={onClose}
        className="w-full flex items-center justify-between py-3 text-base font-semibold text-gray-900 hover:bg-gray-50 rounded-lg px-2 transition-colors"
      >
        <span>{item.name}</span>
      </Link>
    );
  }

  const isStatic = isStaticCategoryUuid(item.uuid);

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-3 text-base font-semibold text-gray-900 hover:bg-gray-50 rounded-lg px-2 transition-colors"
      >
        <span>{item.name}</span>
        <motion.span
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.25 }}
        >
          <ChevronDown className="w-5 h-5 text-gray-400" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            className="overflow-hidden"
            variants={submenuVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            {isStatic ? (
              <StaticSubmenuItems dropdownName={dropdownKey} onClose={onClose} />
            ) : (
              <DynamicSubmenuItems
                menus={item.uuid ? getMenus(item.uuid) || [] : []}
                categoryCode={item.categoryCode || ""}
                categoryVisibleName={item.categoryVisibleName}
                onClose={onClose}
                loading={item.uuid ? isMenuLoading(item.uuid) : false}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const MobileMenuContent: FC<Props> = ({
  onClose,
  menuRoutes,
  loading,
  expandedCategory,
  onToggleCategory,
  getMenus,
  isMenuLoading,
}) => (
  <div className="p-4">
    {/* Categories section */}
    <div className="mb-6">
      <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">
        COMPRAR POR CATEGORIA
      </h3>
      <nav>
        {loading ? (
          <MenuSkeleton />
        ) : (
          menuRoutes.map((item) => (
            <CategoryItem
              key={item.name}
              item={item}
              isExpanded={expandedCategory === item.name}
              onToggle={() => onToggleCategory(item.name)}
              onClose={onClose}
              getMenus={getMenus}
              isMenuLoading={isMenuLoading}
            />
          ))
        )}
      </nav>
    </div>

  </div>
);
