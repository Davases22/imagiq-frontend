/**
 * @module ProfilePage
 * @description Página de perfil simplificada
 */

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import ProfileSidebar from "./sections/ProfileSidebar";
import ProfileDataPage from "./pages/ProfileDataPage";

type CurrentView =
  | "main"
  | "addresses"
  | "payment-methods"
  | "coupons"
  | "loyalty"
  | "orders"
  | "profile";

/**
 * Cupones y Programa de Lealtad todavia no estan desarrollados: la seccion se
 * montaba con el contador fijo en 0 y sin programa, y ambas pantallas quedan
 * vacias. Se oculta hasta que existan; poner en true para reactivarla.
 */
const MOSTRAR_BENEFICIOS = false;

interface ProfilePageProps {
  className?: string;
}

const VISTAS_VALIDAS: CurrentView[] = [
  "main",
  "addresses",
  "payment-methods",
  "coupons",
  "loyalty",
  "orders",
  "profile",
];

function esVistaValida(v: string | null | undefined): v is CurrentView {
  return !!v && VISTAS_VALIDAS.includes(v as CurrentView);
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ className }) => {
  const { state, actions, isLoading } = useProfile();
  // Se puede entrar directo a una seccion con ?ver=orders (lo usa el menu del
  // navbar para llevar a "Mis pedidos" sin pasar por el indice del perfil).
  const searchParams = useSearchParams();
  const vistaPedida = searchParams?.get("ver");
  const [currentView, setCurrentView] = useState<CurrentView>(
    esVistaValida(vistaPedida) ? vistaPedida : "main",
  );

  // El useState de arriba solo corre en el primer render. Si el usuario YA
  // esta en /perfil y pulsa "Mis pedidos" en el menu del navbar, Next no
  // remonta la pagina (solo cambia el query), asi que sin este efecto la URL
  // cambiaba y la pantalla se quedaba igual.
  useEffect(() => {
    if (esVistaValida(vistaPedida)) setCurrentView(vistaPedida);
  }, [vistaPedida]);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);

  // El perfil cambia de pantalla con estado, no navegando, asi que el scroll de
  // la ventana se queda donde estaba: al entrar a Direcciones, Metodos de Pago
  // o Pedidos la vista aparecia empezada a la mitad. Se sube al inicio en cada
  // cambio de pantalla.
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [currentView]);

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

  const contenido = (() => {
    if (currentView === "addresses") return <AddressesPage onBack={handleBackToMain} />;
    if (currentView === "payment-methods")
      return <PaymentMethodsPage onBack={handleBackToMain} />;
    if (currentView === "coupons") return <CouponsPage onBack={handleBackToMain} />;
    if (currentView === "loyalty") return <LoyaltyPage onBack={handleBackToMain} />;
    if (currentView === "orders")
      return <OrdersPage onBack={handleBackToMain} userEmail={state.user!.email} />;
    if (currentView === "profile") return <ProfileDataPage onBack={handleBackToMain} />;
    return null;
  })();

  if (contenido) {
    return (
      <div className={cn("min-h-screen bg-white", className)}>
        <div className="mx-auto grid max-w-[1440px] gap-8 px-4 py-8 md:px-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
          <ProfileSidebar
            nombre={state.user.nombre}
            apellido={state.user.apellido}
            email={state.user.email}
            vistaActual={currentView}
            onCambiarVista={setCurrentView}
            onLogout={handleLogout}
            totalDirecciones={state.user.direcciones?.length || 0}
            totalTarjetas={state.user.tarjetas?.length || 0}
          />
          {/* min-w-0: sin esto una tabla ancha dentro estira la columna y
              empuja el menu lateral fuera de la pantalla. */}
          <div className="min-w-0">{contenido}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen bg-white", className)}>
      <div className="mx-auto grid max-w-[1440px] gap-8 px-4 py-8 md:px-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
        <ProfileSidebar
          nombre={state.user.nombre}
          apellido={state.user.apellido}
          email={state.user.email}
          vistaActual={currentView}
          onCambiarVista={setCurrentView}
          onLogout={handleLogout}
          totalDirecciones={state.user.direcciones?.length || 0}
          totalTarjetas={state.user.tarjetas?.length || 0}
        />

        <div className="min-w-0">
      {/* Profile Header: en escritorio los datos ya estan en el menu lateral,
          asi que aqui solo se muestra en movil. */}
      <div className="lg:hidden">
        <ProfileHeader
          user={state.user}
          onEditProfile={handleEditProfile}
          loading={isLoading}
        />
      </div>

      {/* Quick Actions */}
      <QuickActions
        onOrdersClick={handleOrdersClick}
        onPaymentMethodsClick={handlePaymentMethodsClick}
      />

      <div className="pb-8">
        {/* Benefits Section — oculta mientras Cupones y Programa de Lealtad no
            esten desarrollados. Hoy se montaba con couponsCount fijo en 0 y sin
            programa, asi que el usuario entraba a dos pantallas vacias.
            Para volver a mostrarla, poner MOSTRAR_BENEFICIOS en true. */}
        {MOSTRAR_BENEFICIOS && (
          <BenefitsSection
            couponsCount={0}
            loyaltyProgram={undefined}
            onCouponsClick={handleCouponsClick}
            onLoyaltyClick={handleLoyaltyClick}
          />
        )}

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

        {/* Logout Section: en escritorio el boton vive en el menu lateral. */}
        <div className="lg:hidden">
          <LogoutSection onLogout={handleLogout} />
        </div>
      </div>
        </div>
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
