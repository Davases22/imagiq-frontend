"use client";

import Image from "next/image";
import { WHATSAPP_CHAT_URL } from "./constants";

export function ChatInitiationSection() {
  return (
    <div className="bg-white py-4">
      <div className="max-w-6xl mx-auto px-8">
        {/* Main Title */}
        <h2 className="text-3xl md:text-4xl font-black text-center mb-12 text-black">
          Iniciar un chat con Samsung Store
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 max-w-5xl mx-auto">
          {/* Option 2 - Direct Chat Button */}
          <div className="text-center">
            <h3 className="text-4xl md:text-5xl font-bold mb-4 text-black">
              1. Opción
            </h3>
            <p className="text-black mb-6 text-base">
              Haz click en el botón para abrir directamente un chat con WhatsApp
            </p>
            
            {/* Chat Button */}
            <div className="flex justify-center">
              <a
                href={WHATSAPP_CHAT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white border-2 border-black text-black px-8 py-3 rounded-full font-bold text-base transition-colors duration-200 hover:bg-gray-50 inline-block"
              >
                CHATEA AQUÍ
              </a>
            </div>
          </div>

          {/* Option 3 - QR Code */}
          <div className="text-center">
            <h3 className="text-4xl md:text-5xl font-bold mb-4 text-black">
              2. Opción
            </h3>
            <p className="text-black mb-6 text-base">
              Escanea el código QR con la cámara de tu smartphone para iniciar un chat de WhatsApp
            </p>
            
            {/* QR Code */}
            <div className="flex justify-center">
              <Image
                src="https://res.cloudinary.com/dbqgbemui/image/upload/v1765474064/Generated_Image_December_11_2025_-_12_27PM_rm79sv.jpg"
                alt="WhatsApp QR Code"
                width={320}
                height={320}
                className="object-contain"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}