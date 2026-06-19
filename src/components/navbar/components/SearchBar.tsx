"use client";

import { Search, X, Clock } from "lucide-react";
import { useEffect, useRef, useState, type FC, type FormEvent } from "react";
import {
  getRecentSearches,
  removeRecentSearch,
  clearRecentSearches,
  recordSearch,
  type RecentSearch,
} from "@/lib/searchHistory";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
};

export const SearchBar: FC<Props> = ({ value, onChange, onSubmit }) => {
  const [focused, setFocused] = useState(false);
  const [recent, setRecent] = useState<RecentSearch[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Lee localStorage fresco cada vez que se abre el dropdown.
  const refreshRecent = () => setRecent(getRecentSearches());

  // Cerrar al hacer click fuera.
  useEffect(() => {
    if (!focused) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [focused]);

  // Mostrar recientes solo cuando el input está vacío y hay historial.
  const showDropdown = focused && value.trim().length === 0 && recent.length > 0;

  const goToSearch = (query: string) => {
    const q = query.trim();
    if (!q) return;
    recordSearch(q, { source: "recent" });
    setFocused(false);
    window.location.href = `/productos?q=${encodeURIComponent(q)}`;
  };

  return (
    <div
      ref={wrapperRef}
      className="relative w-full lg:w-[200px] xl:w-[220px] 2xl:w-[260px]"
    >
      <form
        onSubmit={onSubmit}
        className="relative flex items-center rounded-full px-5 h-14 lg:px-4 lg:h-10 transition-all duration-300 w-full backdrop-blur-md border border-gray-200 bg-white shadow-md"
        style={{
          overflow: "hidden",
          boxShadow:
            "0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.06)",
        }}
      >
        <Search className="w-5 h-5 mr-3 text-gray-500" />
        <input
          type="text"
          className="w-full bg-transparent border-none focus:outline-none text-[15px] text-gray-900 placeholder-gray-400 font-medium"
          placeholder="Búsqueda"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            refreshRecent();
            setFocused(true);
          }}
          aria-label="Buscar productos"
          autoComplete="off"
        />
      </form>

      {showDropdown && (
        <div className="absolute z-50 left-0 right-0 mt-2 rounded-2xl border border-gray-200 bg-white shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Búsquedas recientes
            </span>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                clearRecentSearches();
                refreshRecent();
              }}
              className="text-xs font-medium text-[#0066CC] hover:underline"
            >
              Borrar todo
            </button>
          </div>
          <ul className="py-1 max-h-72 overflow-y-auto">
            {recent.map((r) => (
              <li
                key={`${r.query}-${r.ts}`}
                className="group flex items-center justify-between px-4 py-2 hover:bg-gray-50 cursor-pointer"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => goToSearch(r.query)}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="truncate text-[14px] text-gray-800">
                    {r.query}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={`Eliminar ${r.query}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeRecentSearch(r.query);
                    refreshRecent();
                  }}
                  className="ml-2 p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
