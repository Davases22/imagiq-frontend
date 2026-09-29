import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  Package,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
  X,
} from "lucide-react";
import {
  ordersService,
  Order,
  getOrderStatusText,
  getOrderStatusColor,
} from "@/services/orders.service";
import LoadingSpinner from "@/components/LoadingSpinner";
import { apiGet } from "@/lib/api-client";

interface OrdersPageProps {
  onBack: () => void;
  userEmail: string;
  className?: string;
}

const OrdersPage: React.FC<OrdersPageProps> = ({ onBack, userEmail, className }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(
    null
  );
  const [confirmCancelOrderId, setConfirmCancelOrderId] = useState<
    string | null
  >(null);
  // POST /api/orders no devuelve imagen de los items, solo sku y nombre. La
  // imagen si viene en GET /api/orders/{id}/imagiq, asi que se pide al
  // expandir el pedido y se guarda por sku. Si falla, la tarjeta sigue
  // mostrandose con el icono generico.
  const [imagenesPorOrden, setImagenesPorOrden] = useState<
    Record<string, Record<string, string>>
  >({});

  const fetchOrders = useCallback(async () => {
    if (!userEmail) {
      setError("Email de usuario no disponible");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await ordersService.getUserOrders(userEmail);
      // Ordenar por fecha más reciente primero
      const sortedOrders = [...data].sort(
        (a, b) =>
          new Date(b.fecha_creacion).getTime() -
          new Date(a.fecha_creacion).getTime()
      );
      setOrders(sortedOrders);
    } catch (err) {
      console.error("Error obteniendo órdenes:", err);
      setError(err instanceof Error ? err.message : "Error al cargar órdenes");
    } finally {
      setLoading(false);
    }
  }, [userEmail]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const cargarImagenes = useCallback(
    async (orderId: string) => {
      if (imagenesPorOrden[orderId]) return;
      try {
        const res = await apiGet<{
          data?: { items?: Array<Record<string, unknown>> };
          items?: Array<Record<string, unknown>>;
        }>(`/api/orders/${orderId}/imagiq`);
        const items = res?.data?.items ?? res?.items ?? [];
        const mapa: Record<string, string> = {};
        for (const it of items) {
          const sku = String(it.sku ?? it.SKU ?? "");
          const url = String(
            it.image_preview_url ?? it.picture_url ?? it.imagen ?? ""
          );
          if (sku && url) mapa[sku] = url;
        }
        setImagenesPorOrden((prev) => ({ ...prev, [orderId]: mapa }));
      } catch {
        // Sin imagenes se sigue mostrando el pedido con el icono generico.
        setImagenesPorOrden((prev) => ({ ...prev, [orderId]: {} }));
      }
    },
    [imagenesPorOrden]
  );

  const toggleOrderExpanded = (orderId: string) => {
    setExpandedOrders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
        void cargarImagenes(orderId);
      }
      return newSet;
    });
  };

  const handleCancelOrder = async (orderId: string) => {
    setCancellingOrderId(orderId);
    try {
      await ordersService.cancelOrder(orderId);
      // Actualizar la lista de órdenes
      await fetchOrders();
      setConfirmCancelOrderId(null);
    } catch (err) {
      console.error("Error cancelando orden:", err);
      alert(err instanceof Error ? err.message : "Error al cancelar la orden");
    } finally {
      setCancellingOrderId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount: number, currency: string = "COP") => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className={`min-h-screen bg-white ${className}`}>
      {/* Cancel Confirmation Modal */}
      {confirmCancelOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 mx-4 max-w-sm w-full shadow-xl">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                Cancelar Pedido
              </h3>
              <button
                onClick={() => setConfirmCancelOrderId(null)}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <p className="text-gray-600 mb-6">
              ¿Estás seguro de que deseas cancelar este pedido? Esta acción no
              se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmCancelOrderId(null)}
                className="flex-1 px-4 py-2 border-2 border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                disabled={cancellingOrderId === confirmCancelOrderId}
              >
                No, mantener
              </button>
              <button
                onClick={() => handleCancelOrder(confirmCancelOrderId)}
                disabled={cancellingOrderId === confirmCancelOrderId}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {cancellingOrderId === confirmCancelOrderId ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Cancelando...
                  </>
                ) : (
                  "Sí, cancelar"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b-2 border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold">Mis Pedidos</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">{renderContent()}</div>
    </div>
  );

  function renderContent() {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Cargando pedidos...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <Package className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Error al cargar pedidos
          </h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchOrders}
            className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Reintentar
          </button>
        </div>
      );
    }

    if (orders.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
            <ShoppingBag className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            No tienes pedidos aún
          </h2>
          <p className="text-gray-600 max-w-md">
            Cuando realices tu primera compra, podrás ver el historial de tus
            pedidos aquí.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600 mb-4">
          {orders.length} {orders.length === 1 ? "pedido" : "pedidos"} en total
        </p>

        {orders.map((order) => {
          const isExpanded = expandedOrders.has(order.id);

          return (
            <div
              key={order.id}
              className="bg-white border-2 border-gray-200 rounded-2xl overflow-hidden"
            >
              {/* Order Header */}
              <button
                onClick={() => toggleOrderExpanded(order.id)}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                    <Package className="w-6 h-6 text-gray-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-gray-900">
                      Pedido #{order.serial_id}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatDate(order.fecha_creacion)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getOrderStatusColor(
                        order.estado
                      )}`}
                    >
                      {getOrderStatusText(order.estado)}
                    </span>
                    <p className="font-bold text-gray-900 mt-1">
                      {formatCurrency(order.total_amount, order.currency)}
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Order Details (Expandable) */}
              {isExpanded && (
                <div className="border-t-2 border-gray-100 p-4">
                  {/* Order Info */}
                  {/* Envio e Impuestos se retiraron del resumen a peticion:
                      quedan el medio de pago y el numero de productos. */}
                  <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-gray-100">
                    <div>
                      <p className="text-xs text-gray-500 uppercase">
                        Medio de pago
                      </p>
                      <p className="font-semibold">{order.medio_de_pago}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">
                        Productos
                      </p>
                      <p className="font-semibold">{order.items.length}</p>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-gray-700">
                      Productos del pedido
                    </p>
                    {order.items.map((item) => {
                      const imagen = imagenesPorOrden[order.id]?.[item.sku];
                      return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl"
                      >
                        <div className="relative w-16 h-16 flex-shrink-0 bg-white rounded-lg border border-gray-200 overflow-hidden">
                          {imagen ? (
                            // <img> y no next/image: estas URLs las devuelve el
                            // backend y pueden venir de cualquier host, que
                            // next/image rechazaria por no estar en la config.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={imagen}
                              alt={item.nombre}
                              loading="lazy"
                              className="w-full h-full object-contain p-1"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-6 h-6 text-gray-300" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900">
                            {item.nombre}
                          </p>
                          <p className="text-sm text-gray-500">
                            SKU: {item.sku} • Cantidad: {item.cantidad}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
                            {formatCurrency(
                              item.precio_unitario * item.cantidad,
                              order.currency
                            )}
                          </p>
                          {item.cantidad > 1 && (
                            <p className="text-xs text-gray-500">
                              {formatCurrency(
                                item.precio_unitario,
                                order.currency
                              )}{" "}
                              c/u
                            </p>
                          )}
                        </div>
                      </div>
                      );
                    })}
                  </div>

                  {/* Order Total */}
                  <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                    <span className="font-semibold text-gray-700">Total</span>
                    <span className="text-xl font-bold">
                      {formatCurrency(order.total_amount, order.currency)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }
};

export default OrdersPage;
