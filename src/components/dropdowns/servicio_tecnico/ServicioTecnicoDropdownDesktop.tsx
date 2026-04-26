"use client";

import Link from "next/link";
import { SERVICIO_TECNICO_MENU_ITEMS } from "./constants";

type Props = {
  onItemClick: (label: string, href: string) => void;
};

export default function ServicioTecnicoDropdownDesktop({ onItemClick }: Props) {
  return (
    <div className="bg-white shadow-lg rounded-b-lg border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-8 py-6">
        <div className="grid grid-cols-2 gap-2">
          {SERVICIO_TECNICO_MENU_ITEMS.map((item) => {
            const IconComponent = item.icon;

            return (
              <Link
                key={item.title}
                href={item.href}
                onClick={() => onItemClick(item.title, item.href)}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                <IconComponent
                  className="flex-shrink-0 w-5 h-5 text-gray-500 mt-0.5 group-hover:text-black transition-colors"
                  strokeWidth={1.75}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-gray-900 group-hover:text-black transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                    {item.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
