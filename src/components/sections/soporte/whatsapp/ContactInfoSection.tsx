"use client";

import Image from "next/image";
import { useState } from "react";
import ChatbotPanel from "@/app/chatbot/chatbotPanel";
import { WHATSAPP_CHAT_URL } from "./constants";

const contactOptions = [
  {
    title: "WhatsApp",
    description: "Ayudarte ahora es más fácil a través de nuestro canal de WhatsApp",
    buttonText: "Chatea aquí",
    icon: "whatsapp",
    hasQR: true,
    href: WHATSAPP_CHAT_URL,
  },
  {
    title: "Chatea con un agente",
    description: "Soporte con un agente especializado",
    buttonText: "Chatea aquí",
    icon: "chat",
    href: "#",
    isChatbot: true,
  },
  {
    title: "Encuentra un Centro de Servicio Autorizado",
    description: "Busca el centro de servicio más cercano y visítanos para recibir una atención personalizada",
    buttonText: "Encuentra un centro de servicio",
    icon: "location",
    href: "/tiendas",
  },
  {
    title: "Compra en Centros de Servicio Autorizados",
    description: "Conoce nuestra red de tiendas a nivel nacional donde compras con descuentos exclusivos",
    buttonText: "Contáctalos aquí",
    icon: "store",
    href: "/tiendas",
  },
];

export function ContactInfoSection() {
  const [showChatbot, setShowChatbot] = useState(false);

  return (
    <>
      <div className="bg-white py-8">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-8">
            Información de Contacto
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {contactOptions.map((option, index) => (
              <div
                key={index}
                className="border border-gray-300 rounded-3xl p-8 hover:shadow-lg transition-shadow flex flex-col"
              >
                <h3 className="text-xl font-bold mb-3">{option.title}</h3>
                {option.description ? (
                  <p className="text-sm text-gray-700 mb-6 flex-grow">{option.description}</p>
                ) : (
                  <div className="flex-grow mb-6"></div>
                )}

                {option.hasQR && (
                  <div className="flex justify-center mb-4">
                    <div className="w-32 h-32 rounded-lg overflow-hidden">
                      <Image
                        src="https://res.cloudinary.com/dbqgbemui/image/upload/v1765474064/Generated_Image_December_11_2025_-_12_27PM_rm79sv.jpg"
                        alt="WhatsApp QR Code"
                        width={128}
                        height={128}
                        className="object-cover w-full h-full"
                      />
                    </div>
                  </div>
                )}

                {option.isChatbot && (
                  <div className="flex justify-center mb-4">
                    <div className="w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
                      <Image
                        src="/images/support-agent.png"
                        alt="Agente de soporte"
                        width={128}
                        height={128}
                        className="rounded-full object-cover"
                      />
                    </div>
                  </div>
                )}

                {option.hasQR && (
                  <p className="text-xs text-center text-gray-600 mb-4">Escanea para ingresar</p>
                )}

                {option.isChatbot ? (
                  <button
                    onClick={() => setShowChatbot(true)}
                    className="bg-black text-white hover:bg-gray-800 px-5 py-2.5 rounded-full font-medium text-sm transition-colors inline-flex items-center justify-center gap-2"
                  >
                    {option.buttonText}
                    <span>→</span>
                  </button>
                ) : (
                  <a
                    href={option.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-black text-white hover:bg-gray-800 px-5 py-2.5 rounded-full font-medium text-sm transition-colors inline-flex items-center justify-center gap-2"
                  >
                    {option.buttonText}
                    <span>→</span>
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {showChatbot && <ChatbotPanel onClose={() => setShowChatbot(false)} />}
    </>
  );
}
