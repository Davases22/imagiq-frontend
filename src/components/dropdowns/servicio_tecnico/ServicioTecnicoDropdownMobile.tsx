"use client";

import Link from "next/link";
import { SERVICIO_TECNICO_MENU_ITEMS } from "./constants";

type Props = {
  onItemClick: (label: string, href: string) => void;
};

export default function ServicioTecnicoDropdownMobile({ onItemClick }: Props) {
  return (
    <div className="px-2 py-1">
      <ul className="divide-y divide-gray-100">
        {SERVICIO_TECNICO_MENU_ITEMS.map((item) => {
          const IconComponent = item.icon;

          return (
            <li key={item.title}>
              <Link
                href={item.href}
                onClick={() => onItemClick(item.title, item.href)}
                className="flex items-center gap-3 px-2 py-3 rounded-md hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <IconComponent
                  className="flex-shrink-0 w-5 h-5 text-gray-500"
                  strokeWidth={1.75}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-gray-900">
                    {item.title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                    {item.description}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
