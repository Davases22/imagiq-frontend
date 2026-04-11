"use client";

import { useState, useEffect, useCallback } from "react";
import type { FC, FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MobileMenuContent } from "./MobileMenuContent";
import { SearchBar } from "./SearchBar";
import { useVisibleCategories } from "@/hooks/useVisibleCategories";
import { usePreloadCategoryMenus } from "@/hooks/usePreloadCategoryMenus";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: (e: FormEvent) => void;
};

const dropdownVariants = {
  hidden: {
    opacity: 0,
    height: 0,
    transition: {
      height: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as const },
      opacity: { duration: 0.2, ease: "easeOut" as const },
    },
  },
  visible: {
    opacity: 1,
    height: "auto",
    transition: {
      height: { duration: 0.35, ease: [0.4, 0, 0.2, 1] as const },
      opacity: { duration: 0.25, delay: 0.05, ease: "easeIn" as const },
    },
  },
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25 } },
};

export const MobileMenu: FC<Props> = ({
  isOpen,
  onClose,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
}) => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const { getMenus, isLoading } = usePreloadCategoryMenus();
  const { getNavbarRoutes, loading } = useVisibleCategories();
  const menuRoutes = getNavbarRoutes();

  // Reset expanded category when menu closes
  useEffect(() => {
    if (!isOpen) {
      setExpandedCategory(null);
    }
  }, [isOpen]);

  const handleToggleCategory = useCallback((categoryName: string) => {
    setExpandedCategory((prev) => (prev === categoryName ? null : categoryName));
  }, []);

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 bg-black/30 z-[9998] xl:hidden"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={onClose}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Dropdown menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="absolute left-0 right-0 z-[9999] xl:hidden bg-white shadow-2xl overflow-hidden rounded-b-3xl"
            style={{ top: "100%" }}
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            <div className="max-h-[80vh] overflow-y-auto overscroll-contain">
              <div className="px-4 pb-3 pt-3">
                <SearchBar
                  value={searchQuery}
                  onChange={onSearchChange}
                  onSubmit={onSearchSubmit}
                />
              </div>

              <MobileMenuContent
                onClose={onClose}
                menuRoutes={menuRoutes}
                loading={loading}
                expandedCategory={expandedCategory}
                onToggleCategory={handleToggleCategory}
                getMenus={getMenus}
                isMenuLoading={isLoading}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
