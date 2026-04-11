"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { type FC, useState, useEffect } from "react";
import { useCartHover } from "@/hooks/useCartHover";
import CartPopover from "../CartPopover";

type Props = {
  count: number;
  showBump: boolean;
  isClient?: boolean;
  onClick: () => void;
  colorClass: string;
};

export const CartIcon: FC<Props> = ({
  count,
  showBump,
  onClick,
  colorClass,
}) => {
  const pathname = usePathname();
  const isCarritoPage = pathname === "/carrito" || pathname?.startsWith("/carrito/");
  // Delay badge rendering until after hydration to prevent server/client mismatch.
  // The cart count comes from localStorage which isn't available during SSR.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { isOpen, handleMouseEnter, handleMouseLeave, closePopover } = useCartHover(200, 0);

  const handleClick = () => {
    closePopover();
    onClick();
  };

  return (
    <div
      className="relative"
      onMouseEnter={isCarritoPage ? undefined : handleMouseEnter}
      onMouseLeave={isCarritoPage ? undefined : handleMouseLeave}
    >
      <Link
        href="/carrito"
        className={cn(
          "flex items-center justify-center w-10 h-10",
          colorClass,
          "relative"
        )}
        title="Carrito de compras"
        onClick={handleClick}
      >
        <ShoppingCart className={cn("w-5 h-5", colorClass)} />
        {mounted && count > 0 && (
          <span
            className={cn(
              "absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-extrabold transition-transform duration-150 ease-out",
              showBump ? "scale-110" : "scale-100"
            )}
            aria-live="polite"
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Link>

      {/* Cart Popover - Solo desktop y solo si NO estamos en /carrito */}
      {!isCarritoPage && (
        <CartPopover
          isOpen={isOpen}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        />
      )}
    </div>
  );
};
