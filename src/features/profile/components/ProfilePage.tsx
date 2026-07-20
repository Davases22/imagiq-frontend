/**
 * @module ProfilePage
 * @description Página de perfil simplificada
 */

import React, { useState } from "react";
import { toast } from "sonner";
import { PUBLIC_ROUTES } from "@/constants/routes";
import Link from "next/link";
import { cn } from "@/lib/utils";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useProfile } from "../hooks/useProfile";
import ProfileHeader from "./sections/ProfileHeader";
import QuickActions from "./sections/QuickActions";
import AccountSection from "./sections/AccountSection";
import BenefitsSection from "./sections/BenefitsSection";
import SettingsSection from "./sections/SettingsSection";
import LegalSection from "./sections/LegalSection";
import LogoutSection from "./sections/LogoutSection";
import AddressesPage from "./pages/AddressesPage";
import PaymentMethodsPage from "./pages/PaymentMethodsPage";
import CouponsPage from "./pages/CouponsPage";
import LoyaltyPage from "./pages/LoyaltyPage";
import OrdersPage from "./pages/OrdersPage";
import EditProfileModal, { EditProfileData } from "./modals/EditProfileModal";

type CurrentView =
  | "main"
  | "addresses"
  | "payment-methods"
  | "coupons"
  | "loyalty"
  | "orders";

interface ProfilePageProps {
  className?: string;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ className }) => {
  const { state, actions, isLoading } = useProfile();
  const [currentView, setCurrentView] = useState<CurrentView>("main");
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);

  const handleLogout = async () => {
    await actions.logout();
  };

  // Handlers de navegación
  const handleEditProfile = () => setIsEditProfileModalOpen(true);
  const handleOrdersClick = () => setCurrentView("orders");
  const handlePaymentMethodsClick = () => setCurrentView("payment-methods");
  const handleAddressesClick = () => setCurrentView("addresses");
  const handleCouponsClick = () => setCurrentView("coupons");
  const handleLoyaltyClick = () => setCurrentView("loyalty");
  const handleTermsClick = () => console.log("Ver términos");
  const handlePrivacyClick = () => console.log("Ver privacidad");
  const handleRelevantInfoClick = () =>
    console.log("Ver información relevante");
  const handleDataProcessingClick = () =>
    console.log("Ver procesamiento de datos");

  const handleBackToMain = () => setCurrentView("main");

  const handleSaveProfile = async (data: EditProfileData) => {
    const res = await actions.updateProfile({
      nombre: data.nombre,
      apellido: data.apellido,
      email: data.email,
      telefono: data.telefono,
      tipo_documento: data.tipo_documento,
      numero_documento: data.numero_documento,
    });

    if (res.ok) {
      toast.success("Perfil actualizado correctamente");
      setIsEditProfileModalOpen(false);
    } else {
      // Usar el mensaje REAL devuelto por updateProfile (no state.error, que es
      // asíncrono y llega tarde). Fallback con la pista de validación del backend.
      toast.error(
        res.error ||
          "No se pudo actualizar el perfil. Verifica que el teléfono tenga 10 dígitos y el documento entre 6 y 10."
      );
    }
  };

  if (!state.user) {
    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <LoadingSpinner size="sm" />
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6 text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Parece que no has iniciado sesión
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Inicia sesión para ver y gestionar tu perfil, pedidos y métodos de
            pago.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href={PUBLIC_ROUTES.LOGIN}
              className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
            >
              Ingresar
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-4 py-2 border border-gray-200 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Renderizar vista de direcciones
  if (currentView === "addresses") {
    return <AddressesPage onBack={handleBackToMain} />;
  }

  // Renderizar vista de métodos de pago
  if (currentView === "payment-methods") {
    return <PaymentMethodsPage onBack={handleBackToMain} />;
  }

  // Renderizar vista de cupones
  if (currentView === "coupons") {
    return <CouponsPage onBack={handleBackToMain} />;
  }

  // Renderizar vista de programa de lealtad
  if (currentView === "loyalty") {
    return <LoyaltyPage onBack={handleBackToMain} />;
  }

  // Renderizar vista de órdenes
  if (currentView === "orders") {
    return (
      <OrdersPage onBack={handleBackToMain} userEmail={state.user.email} />
    );
  }

  return (
    <div className={cn("min-h-screen bg-white", className)}>
      {/* Profile Header */}
      <ProfileHeader
        user={state.user}
        onEditProfile={handleEditProfile}
        loading={isLoading}
      />

      {/* Quick Actions */}
      <QuickActions
        onOrdersClick={handleOrdersClick}
        onPaymentMethodsClick={handlePaymentMethodsClick}
      />

      <div className="max-w-6xl mx-auto px-4 pb-8">
        {/* Benefits Section */}
        <BenefitsSection
          couponsCount={0}
          loyaltyProgram={undefined}
          onCouponsClick={handleCouponsClick}
          onLoyaltyClick={handleLoyaltyClick}
        />

        {/* My Account Section */}
        <AccountSection
          addressesCount={state.user.direcciones?.length || 0}
          paymentMethodsCount={state.user.tarjetas?.length || 0}
          onAddressesClick={handleAddressesClick}
          onPaymentMethodsClick={handlePaymentMethodsClick}
        />

        {/* Settings Section */}
        <SettingsSection userId={state.user.id} />

        {/* More Information Section */}
        <LegalSection
          onTermsClick={handleTermsClick}
          onPrivacyClick={handlePrivacyClick}
          onRelevantInfoClick={handleRelevantInfoClick}
          onDataProcessingClick={handleDataProcessingClick}
        />

        {/* Logout Section */}
        <LogoutSection onLogout={handleLogout} />
      </div>

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={isEditProfileModalOpen}
        onClose={() => setIsEditProfileModalOpen(false)}
        user={state.user}
        onSave={handleSaveProfile}
        isLoading={isLoading}
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center gap-3">
            <LoadingSpinner size="sm" />
            <span className="text-gray-700">Cargando...</span>
          </div>
        </div>
      )}
    </div>
  );
};

ProfilePage.displayName = "ProfilePage";

export default ProfilePage;
