import React from "react";
import { FileText, ChevronRight } from "lucide-react";

interface LegalSectionProps {
  onTermsClick: () => void;
  onPrivacyClick: () => void;
  onRelevantInfoClick: () => void;
  onDataProcessingClick: () => void;
}

const LegalSection: React.FC<LegalSectionProps> = ({
  onTermsClick,
  onPrivacyClick,
  onRelevantInfoClick,
  onDataProcessingClick
}) => {
  return (
    <div className="py-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Más Información</h2>
      <div className="space-y-2">
        {/* Términos y Condiciones */}
        <button
          onClick={onTermsClick}
          className="w-full flex items-center justify-between p-4 bg-white rounded-3xl border-2 border-gray-200 hover:border-black transition-all"
        >
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5" />
            <span className="font-semibold">Términos y Condiciones</span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>

        {/* Privacidad */}
        <button
          onClick={onPrivacyClick}
          className="w-full flex items-center justify-between p-4 bg-white rounded-3xl border-2 border-gray-200 hover:border-black transition-all"
        >
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5" />
            <span className="font-semibold">Privacidad</span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>

        {/* Procesamiento de Datos */}
        <button
          onClick={onDataProcessingClick}
          className="w-full flex items-center justify-between p-4 bg-white rounded-3xl border-2 border-gray-200 hover:border-black transition-all"
        >
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5" />
            <span className="font-semibold">Procesamiento de Datos</span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>

        {/* Información Relevante */}
        <button
          onClick={onRelevantInfoClick}
          className="w-full flex items-center justify-between p-4 bg-white rounded-3xl border-2 border-gray-200 hover:border-black transition-all"
        >
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5" />
            <span className="font-semibold">Información Relevante</span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
      </div>
    </div>
  );
};

export default LegalSection;
