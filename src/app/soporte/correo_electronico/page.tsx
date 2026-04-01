"use client";

import { useState } from "react";
import { associateEmailWithSession } from "@/lib/posthogClient";

export default function CorreoElectronicoPage() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    emailConfirm: "",
    contactNumber: "",
    type: "",
    modelCode: "",
    message: "",
    files: [] as File[],
    privacyPolicy: false
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setFormData(prev => ({ ...prev, files: [...prev.files, ...files].slice(0, 5) }));
  };

  const removeFile = (index: number) => {
    setFormData(prev => ({ ...prev, files: prev.files.filter((_, i) => i !== index) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.email) {
      associateEmailWithSession(formData.email, {
        $name: `${formData.firstName} ${formData.lastName}`.trim() || undefined,
      });
    }
    // Handle form submission
    console.log("Form submitted:", formData);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="py-8">
        <div className="max-w-6xl mx-auto px-6">
          {/* Header with Gray Band around Title */}
          <div className="mb-8">
            <div className="w-full bg-gray-200 py-3 mb-4">
              <div className="max-w-6xl mx-auto px-6">
                <h1 className="text-3xl md:text-4xl font-bold text-black">Soporte por Correo Electrónico</h1>
              </div>
            </div>
            <p className="text-black">
              Los campos marcados con un asterisco <span className="text-red-500">*</span> son obligatorios. 
              (Para consultas de impresoras, por favor visita la página web de HP{" "}
              <a href="https://www.hp.com/support/samsung" className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">
                www.hp.com/support/samsung
              </a>)
            </p>
          </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Tu Información Section */}
          <div>
            <h2 className="text-2xl font-bold text-black mb-6">Tu Información</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-black mb-2">
                  Nombre<span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  placeholder="Nombre"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-black mb-2">
                  Apellido<span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  placeholder="Apellido"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-black mb-2">
                  Dirección de correo electrónico<span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Dirección de correo electrónico"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-black mb-2">
                  Confirmar dirección de correo electrónico<span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="emailConfirm"
                  value={formData.emailConfirm}
                  onChange={handleInputChange}
                  placeholder="Confirmar dirección de correo electrónico"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-black mb-2">Número de contacto</label>
                <input
                  type="tel"
                  name="contactNumber"
                  value={formData.contactNumber}
                  onChange={handleInputChange}
                  placeholder="Número de contacto"
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Información del Producto Section */}
          <div>
            <h2 className="text-2xl font-bold text-black mb-6">Información del Producto</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-black mb-2">
                  Tipo<span className="text-red-500">*</span>
                </label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                >
                  <option value="">Seleccionar...</option>
                  <option value="smartphone">Smartphone</option>
                  <option value="tablet">Tablet</option>
                  <option value="tv">TV</option>
                  <option value="appliance">Electrodoméstico</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-black mb-2">
                  Código/nombre del modelo<span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="modelCode"
                  value={formData.modelCode}
                  onChange={handleInputChange}
                  placeholder="Código/nombre del modelo"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="mt-2">
                  <a href="#" className="text-blue-600 underline text-sm">
                    ¿Dónde puedo encontrar el código de modelo de mi producto Samsung?
                  </a>
                </p>
              </div>
            </div>
          </div>

          {/* Mensaje Section */}
          <div>
            <h2 className="text-2xl font-bold text-black mb-6">Mensaje</h2>
            <div>
              <label className="block text-black mb-2">
                Mensaje<span className="text-red-500">*</span>
              </label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleInputChange}
                placeholder="Mensaje"
                required
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
              />
            </div>
          </div>

          {/* Subir Archivos Section */}
          <div>
            <h2 className="text-2xl font-bold text-black mb-6">Subir archivos</h2>
            <div>
              <label className="block text-black mb-2">Subir archivos</label>
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-gray-600 text-sm mt-2">
                Puedes adjuntar un máximo de 5 archivos. El límite de tamaño total es de 10MB.
              </p>
              
              {/* Display selected files */}
              {formData.files.length > 0 && (
                <div className="mt-4 space-y-2">
                  {formData.files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                      <span className="text-sm text-black">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Eliminar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Política de Privacidad Checkbox */}
          <div>
            <label className="flex items-start space-x-3">
              <input
                type="checkbox"
                name="privacyPolicy"
                checked={formData.privacyPolicy}
                onChange={handleInputChange}
                required
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-black text-sm">
                He leído y acepto la{" "}
                <a href="#" className="text-blue-600 underline">
                  Política de Privacidad de Samsung
                </a>
                .<span className="text-red-500">*</span>
              </span>
            </label>
          </div>


          {/* Submit Button */}
          <div className="flex justify-center pt-8">
            <button
              type="submit"
              className="bg-black text-white px-12 py-4 rounded-full font-bold text-lg hover:bg-gray-800 transition-colors duration-200"
            >
              ENVIAR
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}
