"use client";

import { cn } from "@/lib/utils";
import React, { useState } from "react";
import { identifyEmailEarly } from "@/lib/posthogClient";

interface GuestUserData {
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  numero_documento: string;
  tipo_documento: string;
}

interface GuestDataModalProps {
  onSubmit: (data: GuestUserData) => void;
  onClose: () => void;
  isOpen?: boolean;
}

const GuestDataModal: React.FC<GuestDataModalProps> = ({
  onSubmit,
  onClose,
  isOpen = true,
}) => {
  const [formData, setFormData] = useState<GuestUserData>({
    nombre: "",
    apellido: "",
    email: "",
    telefono: "",
    tipo_documento: "CC",
    numero_documento: "",
  });

  const [errors, setErrors] = useState<Partial<GuestUserData>>({});
  
  // Los hooks deben llamarse antes de cualquier return condicional
  if (!isOpen) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validate = () => {
    const newErrors: Partial<GuestUserData> = {};
    if (!formData.nombre) newErrors.nombre = "Requerido";
    if (!formData.apellido) newErrors.apellido = "Requerido";
    if (!formData.email) newErrors.email = "Requerido";
    else if (!/\S+@\S+\.\S+/.test(formData.email))
      newErrors.email = "Email inválido";
    if (!formData.telefono) newErrors.telefono = "Requerido";
    if (!/^\d{6,10}$/.test(formData.numero_documento))
      newErrors.numero_documento =
        "El número de documento solo debe de tener números y debe tener de 6 a 10 caracteres. No se admiten numeros consecutivos";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSubmit(formData);
    }
  };

  return (
    <div
      className="fixed inset-0 backdrop-blur-sm bg-white/10 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white p-6 rounded-lg w-full max-w-2xl shadow-xl relative border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold mb-6 text-gray-800 text-center">
          Tus datos para guardar favoritos
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre
            </label>
            <input
              type="text"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition duration-200"
            />
            {errors.nombre && (
              <p className="text-red-500 text-sm mt-1">{errors.nombre}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Apellido
            </label>
            <input
              type="text"
              name="apellido"
              value={formData.apellido}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition duration-200"
            />
            {errors.apellido && (
              <p className="text-red-500 text-sm mt-1">{errors.apellido}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              onBlur={(e) => identifyEmailEarly(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition duration-200"
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono
            </label>
            <input
              type="tel"
              name="telefono"
              value={formData.telefono}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition duration-200"
            />
            {errors.telefono && (
              <p className="text-red-500 text-sm mt-1">{errors.telefono}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de documento
            </label>
            <select
              name="tipo_documento"
              className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition duration-200"
              value={formData.tipo_documento}
              onChange={handleChange}
            >
              <option value="CC">Cédula de ciudadanía</option>
              <option value="PP">Pasaporte</option>
              <option value="CE">Cédula de extranjería</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Número de documento
            </label>
            <input
              type="text"
              name="numero_documento"
              value={formData.numero_documento}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition duration-200"
            />
            {errors.numero_documento && (
              <p className="text-red-500 text-sm mt-1">
                {errors.numero_documento}
              </p>
            )}
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={handleSubmit}
            className={cn(
              "w-full bg-black text-white py-3 px-4 rounded-md text-sm font-medium cursor-pointer",
              "transition-all duration-200 flex items-center justify-center gap-2",
              "hover:bg-gray-800 active:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
            )}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};

export default GuestDataModal;
