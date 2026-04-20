'use client';

import { useState } from 'react';
import Image from 'next/image';
import Modal from './Modal';
import { useAuthContext } from '@/features/auth/context';
import { identifyEmailEarly } from '@/lib/posthogClient';

interface StockNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  productImage?: string;
  selectedColor?: string;
  selectedStorage?: string;
  onNotificationRequest: (email: string) => Promise<void>;
}

export default function StockNotificationModal({
  isOpen,
  onClose,
  productName,
  productImage,
  selectedColor,
  selectedStorage,
  onNotificationRequest,
}: StockNotificationModalProps) {
  const { user } = useAuthContext();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const isLoggedIn = !!user;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const emailToSubmit = isLoggedIn ? user.email : email;

    if (!emailToSubmit) {
      setError('Por favor ingresa un correo electrónico válido');
      return;
    }

    // Validación básica de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailToSubmit)) {
      setError('Por favor ingresa un correo electrónico válido');
      return;
    }

    setIsLoading(true);
    try {
      await onNotificationRequest(emailToSubmit);
      onClose();
      setEmail('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al registrar la notificación'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setError('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="md"
      title="Notificarme cuando esté disponible"
      footer={
        <div className="flex gap-3 justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={isLoading}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            {isLoading ? 'Enviando...' : 'Notificarme'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="text-sm text-gray-600">
          <p className="mb-3">
            Te notificaremos por correo electrónico cuando el producto esté
            disponible nuevamente.
          </p>

          <div className="bg-gray-50 p-4 rounded-lg flex gap-4 items-start">
            {productImage && (
              <div className="flex-shrink-0 w-20 h-20 relative">
                <Image
                  src={productImage}
                  alt={productName}
                  fill
                  className="object-contain"
                  sizes="80px"
                />
              </div>
            )}
            <div className="flex-1 space-y-1">
              <p className="font-medium text-gray-900">{productName}</p>
              {selectedColor && (
                <p className="text-sm text-gray-600">Color: {selectedColor}</p>
              )}
              {selectedStorage && (
                <p className="text-sm text-gray-600">Almacenamiento: {selectedStorage}</p>
              )}
            </div>
          </div>
        </div>

        {isLoggedIn ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <span className="font-medium">Correo electrónico:</span>{' '}
              {user.email}
            </p>
            <p className="text-xs text-blue-700 mt-2">
              Te enviaremos la notificación a este correo cuando el producto esté
              disponible.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
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
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                onBlur={(e) => identifyEmailEarly(e.target.value)}
                placeholder="tu@email.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={isLoading}
              />
            </div>
            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                {error}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
