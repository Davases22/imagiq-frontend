import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { DBAddress } from "../../types";

interface EditAddressModalProps {
  address: DBAddress;
  onSave: (id: string, data: {
    nombreDireccion?: string;
    complemento?: string;
    instruccionesEntrega?: string;
    tipo?: string;
  }) => Promise<void>;
  onClose: () => void;
}

const EditAddressModal: React.FC<EditAddressModalProps> = ({
  address,
  onSave,
  onClose,
}) => {
  // Campo "Nombre de la dirección" eliminado del formulario: se conserva el
  // valor existente de la dirección (no editable) para no perder el dato.
  const [nombreDireccion] = useState(address.nombreDireccion || "");
  const [complemento, setComplemento] = useState(address.complemento || "");
  const [instrucciones, setInstrucciones] = useState(address.instruccionesEntrega || "");
  const [tipo, setTipo] = useState(address.tipo?.toUpperCase() || "CASA");
  const [saving, setSaving] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(address.id, {
        nombreDireccion: nombreDireccion.trim(),
        complemento: complemento.trim(),
        instruccionesEntrega: instrucciones.trim(),
        tipo,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Editar dirección</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dirección (solo lectura) */}
        <div className="px-6 pt-4 pb-2">
          <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Dirección</p>
          <p className="text-sm text-gray-700">{address.linea_uno}</p>
          <p className="text-sm text-gray-500">
            {address.ciudad}{address.departamento ? `, ${address.departamento}` : ""}
            {address.pais ? ` - ${address.pais === "CO" ? "Colombia" : address.pais}` : ""}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 pb-6 pt-2 space-y-4">
          {/* Tipo */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Tipo
            </label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-sm bg-white"
            >
              <option value="CASA">Casa</option>
              <option value="TRABAJO">Trabajo</option>
              <option value="AMBOS">Ambos</option>
              <option value="FACTURACION">Facturación</option>
            </select>
          </div>

          {/* Complemento */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Complemento (apto, piso, torre...)
            </label>
            <input
              type="text"
              value={complemento}
              onChange={(e) => setComplemento(e.target.value)}
              placeholder="Ej: Apto 505, Torre 3, Piso 2"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-sm"
            />
          </div>

          {/* Instrucciones */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Instrucciones de entrega
            </label>
            <textarea
              value={instrucciones}
              onChange={(e) => setInstrucciones(e.target.value)}
              placeholder="Ej: Timbrar cuando lleguen, dejar en portería..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-sm resize-none"
            />
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 rounded-lg font-semibold text-sm hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-black text-white rounded-lg font-semibold text-sm hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditAddressModal;
