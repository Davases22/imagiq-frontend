import React from "react";
import { LogOut } from "lucide-react";

interface LogoutSectionProps {
  onLogout: () => void;
}

const LogoutSection: React.FC<LogoutSectionProps> = ({ onLogout }) => {
  return (
    <div className="py-6">
      <button
        onClick={onLogout}
        className="w-full flex items-center justify-center gap-3 p-4 bg-red-500 text-white rounded-3xl border-2 border-red-500 hover:bg-red-600 hover:border-red-600 transition-all font-bold"
      >
        <LogOut className="w-5 h-5" />
        <span>Cerrar sesión</span>
      </button>
    </div>
  );
};

export default LogoutSection;
