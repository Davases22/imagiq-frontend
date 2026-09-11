import Link from "next/link";
import type { FC } from "react";
import { posthogUtils } from "@/lib/posthogClient";
import { useLogos } from "@/hooks/useLogos";

type Props = {
  showWhiteLogo: boolean;
  onNavigate: () => void;
};

export const NavbarLogo: FC<Props> = ({ showWhiteLogo, onNavigate }) => {
  // Cargar logos dinámicos desde la base de datos
  const { logoDark, logoLight } = useLogos();

  // Determinar qué logo mostrar según el tema del navbar
  const logoUrl = showWhiteLogo
    ? logoLight?.image_url || "/frame_white.png"
    : logoDark?.image_url || "/frame_black.png";

  return (
    <Link
      href="/"
      onClick={(e) => {
        e.preventDefault();
        posthogUtils.capture("logo_click", { source: "navbar" });
        onNavigate();
      }}
      aria-label="Inicio"
      className="flex items-center gap-2 shrink-0"
    >
      {/* Logo circular de ImagIQ - Dinámico desde la DB */}
      <img
        src={logoUrl}
        alt="ImagIQ Logo"
        height={44}
        width={44}
        className="h-11 w-11 min-w-11 object-contain rounded-full"
        style={{ width: "44px", height: "44px" }}
      />
      {/* Logo de Samsung - Siempre igual */}
      <img
        src="https://res.cloudinary.com/dnglv0zqg/image/upload/v1760575601/Samsung_black_ec1b9h.svg"
        alt="Samsung"
        height={42}
        width={118}
        className={
          showWhiteLogo ? "h-10 w-auto brightness-0 invert" : "h-10 w-auto"
        }
        style={{ height: "40px", width: "auto" }}
      />
    </Link>
  );
};
