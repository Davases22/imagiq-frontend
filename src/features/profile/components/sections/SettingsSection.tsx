import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Bell,
  ChevronDown,
  ChevronUp,
  Mail,
  MessageCircle,
  Globe,
  Loader2,
} from "lucide-react";
import {
  notificationsService,
  NotificationSettings,
} from "@/services/notifications.service";

interface SettingsSectionProps {
  userId: string;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({ userId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchSettings = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await notificationsService.getNotificationSettings(userId);
      setSettings(data);
    } catch (err) {
      console.error("Error obteniendo configuración:", err);
      setError(
        err instanceof Error ? err.message : "Error al cargar configuración"
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen && !settings && !loading) {
      fetchSettings();
    }
  }, [isOpen, settings, loading, fetchSettings]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = async (key: "email" | "whatsapp" | "in_web") => {
    if (!settings || updating) return;

    setUpdating(key);

    try {
      const newValue = !settings[key];
      const updatedSettings =
        await notificationsService.updateNotificationSettings(userId, {
          [key]: newValue,
        });
      setSettings(updatedSettings);
    } catch (err) {
      console.error("Error actualizando configuración:", err);
      // Mostrar error temporal
      setError(err instanceof Error ? err.message : "Error al actualizar");
      setTimeout(() => setError(null), 3000);
    } finally {
      setUpdating(null);
    }
  };

  const notificationOptions = [
    {
      key: "email" as const,
      label: "Correo electrónico",
      description: "Recibe actualizaciones por email",
      icon: Mail,
    },
    {
      key: "whatsapp" as const,
      label: "WhatsApp",
      description: "Recibe notificaciones por WhatsApp",
      icon: MessageCircle,
    },
    {
      key: "in_web" as const,
      label: "Notificaciones web",
      description: "Recibe notificaciones en la plataforma",
      icon: Globe,
    },
  ];

  return (
    <div className="py-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Configuración</h2>
      <div className="space-y-2" ref={dropdownRef}>
        {/* Notificaciones Dropdown */}
        <div className="bg-white rounded-3xl border-2 border-gray-200 overflow-hidden">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-all"
          >
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5" />
              <span className="font-semibold">Notificaciones</span>
            </div>
            {isOpen ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {/* Dropdown Content */}
          {isOpen && (
            <div className="border-t-2 border-gray-100 p-4">
              {renderDropdownContent()}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  function renderDropdownContent() {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          <span className="ml-2 text-sm text-gray-500">Cargando...</span>
        </div>
      );
    }

    if (error && !settings) {
      return (
        <div className="text-center py-4">
          <p className="text-sm text-red-500 mb-2">{error}</p>
          <button
            onClick={fetchSettings}
            className="text-sm text-blue-600 hover:underline"
          >
            Reintentar
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
        {notificationOptions.map((option) => {
          const Icon = option.icon;
          const isEnabled = settings?.[option.key] ?? true;
          const isUpdating = updating === option.key;

          return (
            <div
              key={option.key}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-gray-200">
                  <Icon className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {option.label}
                  </p>
                  <p className="text-xs text-gray-500">{option.description}</p>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                onClick={() => handleToggle(option.key)}
                disabled={isUpdating || !settings}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isEnabled ? "bg-black" : "bg-gray-300"
                }`}
              >
                {isUpdating ? (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  </span>
                ) : (
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                )}
              </button>
            </div>
          );
        })}
      </div>
    );
  }
};

export default SettingsSection;
