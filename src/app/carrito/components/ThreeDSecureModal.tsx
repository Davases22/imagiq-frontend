"use client";
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ThreeDSChallengeData {
    acsURL: string;
    encodedCReq: string;
    threeDSServerTransID?: string;
    acsTransID?: string;
}

interface ThreeDSecureModalProps {
    isOpen: boolean;
    challengeData: ThreeDSChallengeData | null;
    orderId: string;
    onSuccess: () => void;
    onError: (error: string) => void;
    onClose: () => void;
}

const API_BASE_URL = "";

export const ThreeDSecureModal: React.FC<ThreeDSecureModalProps> = ({
    isOpen,
    challengeData,
    orderId,
    onSuccess,
    onError,
    onClose,
}) => {
    const router = useRouter();
    const formRef = useRef<HTMLFormElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (isOpen && challengeData && formRef.current) {
            console.log("🔐 [3DS] Auto-submitting form to bank:", challengeData.acsURL);
            // Auto-submit del form al banco cuando se abre el modal
            setTimeout(() => {
                formRef.current?.submit();
            }, 100);
        }
    }, [isOpen, challengeData]);

    useEffect(() => {
        // Escuchar mensajes del iframe (cuando el banco termina)
        const handleMessage = async (event: MessageEvent) => {
            // Verificar origen por seguridad
            if (!event.origin.includes('epayco') && !event.origin.includes('alignet')) {
                console.log("🔐 [3DS] Ignoring message from unknown origin:", event.origin);
                return;
            }

            console.log('🔐 [3DS] Message received from bank:', event.data);

            // El banco puede enviar diferentes mensajes
            if (event.data === '3DSComplete' || event.data.status === 'complete') {
                console.log('🔐 [3DS] Challenge completed, verifying transaction...');
                setIsProcessing(true);
                await verifyTransaction();
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [orderId]);

    const verifyTransaction = async () => {
        console.log('🔍 [3DS] Verifying transaction:', orderId);
        try {
            const response = await fetch(`${API_BASE_URL}/api/orders/verify/${orderId}`);
            const data = await response.json();

            console.log('📦 [3DS] Verification response:', data);

            if (data.orderStatus === 'PENDING' || (data.status === 'PENDING' && data.requiresAction)) {
                console.log('⏳ [3DS] Still pending, retrying in 2 seconds...');
                // Todavía pendiente, esperar un poco y reintentar
                setTimeout(verifyTransaction, 2000);
            } else if (response.ok && data.orderStatus === 'APPROVED') {
                console.log('✅ [3DS] Transaction approved!');
                onSuccess();
            } else {
                console.error('❌ [3DS] Transaction rejected:', data);
                onError(data.message || 'Transacción rechazada');
            }
        } catch (error) {
            console.error('💥 [3DS] Error verifying transaction:', error);
            onError('Error verificando la transacción');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleIframeLoad = () => {
        console.log('🔐 [3DS] Iframe loaded');
        // Timeout removido - el usuario puede tomar el tiempo que necesite
    };

    if (!isOpen || !challengeData) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">
                            Verificación de Seguridad
                        </h3>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-500"
                            disabled={isProcessing}
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <p className="text-sm text-gray-600 mb-4">
                        Tu banco requiere verificación adicional. Por favor, completa la autenticación en la ventana a continuación.
                    </p>

                    {/* Form oculto que se envía al iframe */}
                    <form
                        ref={formRef}
                        method="POST"
                        action={challengeData.acsURL}
                        target="threeds-iframe"
                        style={{ display: 'none' }}
                    >
                        <input type="hidden" name="creq" value={challengeData.encodedCReq} />
                        {challengeData.threeDSServerTransID && (
                            <input type="hidden" name="threeDSServerTransID" value={challengeData.threeDSServerTransID} />
                        )}
                    </form>

                    {/* Iframe donde se muestra el challenge del banco */}
                    <iframe
                        ref={iframeRef}
                        name="threeds-iframe"
                        onLoad={handleIframeLoad}
                        className="w-full h-96 border border-gray-300 rounded"
                        sandbox="allow-forms allow-scripts allow-same-origin allow-top-navigation"
                        title="3D Secure Authentication"
                    />

                    {isProcessing && (
                        <div className="mt-4 text-center">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
                            <p className="mt-2 text-sm text-gray-600">Verificando transacción...</p>
                        </div>
                    )}

                    <div className="mt-4">
                        <button
                            onClick={verifyTransaction}
                            disabled={isProcessing}
                            className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-300"
                        >
                            Ya completé la verificación
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
