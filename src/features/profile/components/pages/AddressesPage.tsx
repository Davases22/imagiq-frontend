import React, { useState } from "react";
import { ArrowLeft, Plus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useProfile } from "../../hooks/useProfile";
import { addressesService, type CreateAddressRequest } from "@/services/addresses.service";
import { DBAddress } from "../../types";
import AddressCard from "../addresses/AddressCard";
import EditAddressModal from "../addresses/EditAddressModal";
import AddNewAddressForm from "@/app/carrito/components/AddNewAddressForm";

interface AddressesPageProps {
  onBack: () => void;
  className?: string;
}

const AddressesPage: React.FC<AddressesPageProps> = ({ onBack, className }) => {
  const { state, actions } = useProfile();
  const [selectedFilter, setSelectedFilter] = useState<
    "all" | "home" | "work" | "other"
  >("all");
  const [deleteConfirm, setDeleteConfirm] = useState<DBAddress | null>(null);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  // Obtener direcciones del usuario, excluyendo las recién eliminadas
  const addresses = (state.user?.direcciones || []).filter(a => !removedIds.has(a.id));

  // Filtrar direcciones y ordenar predeterminada primero
  const filteredAddresses = addresses
    .filter((addr) => {
      if (selectedFilter === "all") return true;

      const tipo = addr.tipo?.toUpperCase();
      if (selectedFilter === "home") return tipo === "CASA" || tipo === "AMBOS";
      if (selectedFilter === "work")
        return tipo === "TRABAJO" || tipo === "AMBOS";
      if (selectedFilter === "other")
        return tipo !== "CASA" && tipo !== "TRABAJO" && tipo !== "AMBOS";

      return true;
    })
    .sort((a, b) => {
      // Predeterminada siempre primero
      if (a.esPredeterminada && !b.esPredeterminada) return -1;
      if (!a.esPredeterminada && b.esPredeterminada) return 1;
      return 0;
    });

  // Contar direcciones por tipo
  const counts = {
    all: addresses.length,
    home: addresses.filter(
      (a) =>
        a.tipo?.toUpperCase() === "CASA" || a.tipo?.toUpperCase() === "AMBOS"
    ).length,
    work: addresses.filter(
      (a) =>
        a.tipo?.toUpperCase() === "TRABAJO" || a.tipo?.toUpperCase() === "AMBOS"
    ).length,
    other: addresses.filter((a) => {
      const tipo = a.tipo?.toUpperCase();
      return tipo !== "CASA" && tipo !== "TRABAJO" && tipo !== "AMBOS";
    }).length,
  };

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingAddress, setEditingAddress] = useState<DBAddress | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const handleAddAddress = () => {
    setShowAddModal(true);
  };

  const handleEditAddress = (id: string) => {
    const address = addresses.find((a) => a.id === id);
    if (address) setEditingAddress(address);
  };

  const handleSaveEdit = async (id: string, data: {
    nombreDireccion?: string;
    complemento?: string;
    instruccionesEntrega?: string;
    tipo?: string;
  }) => {
    try {
      await addressesService.updateAddress(id, data as Partial<CreateAddressRequest>);
      toast.success("Dirección actualizada");
      setEditingAddress(null);
      await actions.refreshData();
    } catch (err) {
      console.error("Error actualizando dirección:", err);
      toast.error(err instanceof Error ? err.message : "Error al actualizar dirección");
    }
  };

  const handleDeleteAddress = (id: string) => {
    const address = addresses.find((a) => a.id === id);
    if (address?.esPredeterminada) {
      toast.error("No puedes eliminar la dirección predeterminada");
      return;
    }
    if (address) setDeleteConfirm(address);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const id = deleteConfirm.id;
    setDeleteConfirm(null);
    // Ocultar la tarjeta inmediatamente (optimista)
    setRemovedIds(prev => new Set(prev).add(id));
    try {
      await addressesService.deactivateAddress(id);
      toast.success("Dirección eliminada");
      await actions.refreshData();
      // Limpiar el ID removido después del refresh (ya no está en los datos)
      setRemovedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    } catch (err) {
      console.error("Error desactivando dirección:", err);
      toast.error(err instanceof Error ? err.message : "Error al eliminar dirección");
      // Restaurar la tarjeta si falló
      setRemovedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  const handleSetDefault = async (id: string) => {
    const address = addresses.find((a) => a.id === id);
    // No permitir facturación como predeterminada
    if (address?.tipo?.toUpperCase() === "FACTURACION") {
      toast.error("Las direcciones de facturación no pueden ser predeterminadas");
      return;
    }
    setActionLoading(id);
    try {
      await addressesService.setDefaultAddress(id);
      toast.success("Dirección predeterminada actualizada");
      await actions.refreshData();
      // Sincronizar navbar: actualizar localStorage + invalidar caches + disparar eventos
      if (address) {
        const navbarAddress = {
          id: address.id,
          linea_uno: address.linea_uno,
          ciudad: address.ciudad || "",
          pais: address.pais || "Colombia",
          esPredeterminada: true,
          direccionFormateada: address.direccionFormateada || address.linea_uno,
          lineaUno: address.linea_uno,
          nombreDireccion: address.nombreDireccion || "",
          complemento: address.complemento || "",
          instruccionesEntrega: address.instruccionesEntrega || "",
          departamento: address.departamento || "",
        };
        localStorage.setItem("checkout-address", JSON.stringify(navbarAddress));
        localStorage.setItem("imagiq_default_address", JSON.stringify(navbarAddress));
      }
      const { invalidateDefaultAddressCache } = await import("@/hooks/useDefaultAddress");
      const { invalidateShippingOriginCache } = await import("@/hooks/useShippingOrigin");
      invalidateDefaultAddressCache();
      invalidateShippingOriginCache();
      window.dispatchEvent(new CustomEvent("address-changed", { detail: { address, fromHeader: false } }));
      window.dispatchEvent(new Event("storage"));
    } catch (err) {
      console.error("Error estableciendo predeterminada:", err);
      toast.error(err instanceof Error ? err.message : "Error al establecer predeterminada");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div
      className={`min-h-screen bg-gray-50${className ? ` ${className}` : ""}`}
    >
      {/* Header */}
      <div className="bg-white border-b-2 border-gray-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Mis Direcciones
                </h1>
                <p className="text-sm text-gray-600">
                  {addresses.length} direcciones
                </p>
              </div>
            </div>
            <button
              onClick={handleAddAddress}
              className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-semibold"
            >
              <Plus className="w-5 h-5" />
              Agregar
            </button>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setSelectedFilter("all")}
              className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap transition-colors ${
                selectedFilter === "all"
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Todas{" "}
              {counts.all > 0 && <span className="ml-1">({counts.all})</span>}
            </button>
            <button
              onClick={() => setSelectedFilter("home")}
              className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap transition-colors ${
                selectedFilter === "home"
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Casa{" "}
              {counts.home > 0 && <span className="ml-1">({counts.home})</span>}
            </button>
            <button
              onClick={() => setSelectedFilter("work")}
              className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap transition-colors ${
                selectedFilter === "work"
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Trabajo{" "}
              {counts.work > 0 && <span className="ml-1">({counts.work})</span>}
            </button>
            <button
              onClick={() => setSelectedFilter("other")}
              className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap transition-colors ${
                selectedFilter === "other"
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Otras{" "}
              {counts.other > 0 && (
                <span className="ml-1">({counts.other})</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Lista de direcciones */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {filteredAddresses.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-gray-200 p-12 text-center">
            <p className="text-gray-500 mb-4">
              No tienes direcciones en esta categoría
            </p>
            <button
              onClick={handleAddAddress}
              className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-semibold"
            >
              Agregar dirección
            </button>
          </div>
        ) : (
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAddresses.map((address) => (
              <AddressCard
                key={address.id}
                address={address}
                onEdit={handleEditAddress}
                onDelete={handleDeleteAddress}
                onSetDefault={handleSetDefault}
                loading={!!actionLoading}
              />
            ))}
          </div>
        )}
      </div>

      {/* Info al final */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center flex-shrink-0">
              {/* Location icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-1">
                Acerca de tus direcciones
              </h3>
              <p className="text-xs text-gray-600">
                Puedes tener múltiples direcciones y elegir una como
                predeterminada. Las direcciones se verifican automáticamente
                para asegurar entregas exitosas.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de edición */}
      {editingAddress && (
        <EditAddressModal
          address={editingAddress}
          onSave={handleSaveEdit}
          onClose={() => setEditingAddress(null)}
        />
      )}

      {/* Modal de confirmación de eliminación */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/50"
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-7 h-7 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Eliminar dirección
              </h3>
              <p className="text-sm text-gray-600 mb-1">
                ¿Estás seguro de que deseas eliminar esta dirección?
              </p>
              <p className="text-sm font-semibold text-gray-800 mb-6">
                {deleteConfirm.nombreDireccion || deleteConfirm.linea_uno}
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2.5 border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de agregar dirección */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-xl font-semibold text-gray-900">
                Agregar nueva dirección
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                type="button"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-6">
              <AddNewAddressForm
                onAddressAdded={async () => {
                  setShowAddModal(false);
                  await actions.refreshData();
                  toast.success("Dirección agregada");
                }}
                onCancel={() => setShowAddModal(false)}
                withContainer={false}
                skipSetDefault
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddressesPage;
