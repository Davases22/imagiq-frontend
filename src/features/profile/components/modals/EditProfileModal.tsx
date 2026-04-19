import React, { useState, useEffect } from "react";
import Modal from "@/components/Modal";
import { ProfileUser } from "../../types";
import { identifyEmailEarly } from "@/lib/posthogClient";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: ProfileUser;
  onSave: (data: EditProfileData) => void;
  isLoading?: boolean;
}

export interface EditProfileData {
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  tipo_documento: string;
  numero_documento: string;
}

const DOCUMENT_TYPES = [
  { value: "cedula", label: "Cédula de Ciudadanía" },
  { value: "cedula_extranjeria", label: "Cédula de Extranjería" },
  { value: "pasaporte", label: "Pasaporte" },
  { value: "nit", label: "NIT" },
];

const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onSave,
  isLoading = false,
}) => {
  const [formData, setFormData] = useState<EditProfileData>({
    nombre: "",
    apellido: "",
    email: "",
    telefono: "",
    tipo_documento: "cedula",
    numero_documento: "",
  });

  // Inicializar formulario con datos del usuario
  useEffect(() => {
    if (user && isOpen) {
      setFormData({
        nombre: user.nombre || "",
        apellido: user.apellido || "",
        email: user.email || "",
        telefono: user.telefono || "",
        tipo_documento: "cedula",
        numero_documento: user.numero_documento || "",
      });
    }
  }, [user, isOpen]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Editar perfil"
      size="md"
      isLoading={isLoading}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Nombre */}
        <div>
          <label
            htmlFor="nombre"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Nombre
          </label>
          <input
            type="text"
            id="nombre"
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-black focus:outline-none transition-colors"
            placeholder="Ingresa tu nombre"
            required
          />
        </div>

        {/* Apellido */}
        <div>
          <label
            htmlFor="apellido"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Apellido
          </label>
          <input
            type="text"
            id="apellido"
            name="apellido"
            value={formData.apellido}
            onChange={handleChange}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-black focus:outline-none transition-colors"
            placeholder="Ingresa tu apellido"
            required
          />
        </div>

        {/* Correo */}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Correo electrónico
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            onBlur={(e) => identifyEmailEarly(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-black focus:outline-none transition-colors"
            placeholder="correo@ejemplo.com"
            required
          />
        </div>

        {/* Teléfono */}
        <div>
          <label
            htmlFor="telefono"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Teléfono
          </label>
          <input
            type="tel"
            id="telefono"
            name="telefono"
            value={formData.telefono}
            onChange={handleChange}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-black focus:outline-none transition-colors"
            placeholder="Ingresa tu teléfono"
          />
        </div>

        {/* Tipo de Documento */}
        <div>
          <label
            htmlFor="tipo_documento"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Tipo de documento
          </label>
          <select
            id="tipo_documento"
            name="tipo_documento"
            value={formData.tipo_documento}
            onChange={handleChange}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-black focus:outline-none transition-colors bg-white"
          >
            {DOCUMENT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Número de Documento */}
        <div>
          <label
            htmlFor="numero_documento"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Número de documento
          </label>
          <input
            type="text"
            id="numero_documento"
            name="numero_documento"
            value={formData.numero_documento}
            onChange={handleChange}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-black focus:outline-none transition-colors"
            placeholder="Ingresa tu número de documento"
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {isLoading ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default EditProfileModal;
