"use client";

/**
 * Página de confirmación de compra exitosa
 * Muestra overlay de éxito con animación y mensaje de confirmación
 * Siempre redirige al usuario a la página principal al hacer clic en "Continuar"
 *
 * Características:
 * - Animación premium con video de confirmación
 * - Mensaje claro y directo
 * - Limpieza automática del carrito
 * - Redirección a la página principal para continuar comprando
 * - Diseño responsive y accesible
 * - Envío automático de mensaje de WhatsApp con confirmación
 */

import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import CheckoutSuccessOverlay from "../../carrito/CheckoutSuccessOverlay";
import { useCart } from "@/hooks/useCart";
import { apiClient } from "@/lib/api";
import { useAnalyticsWithUser } from "@/lib/analytics";
import { posthogUtils } from "@/lib/posthogClient";
import { apiPost } from "@/lib/api-client";
import { addBusinessDays, getNextBusinessDay } from "@/lib/dateUtils";
import useSecureStorage from "@/hooks/useSecureStorage";
import { User } from "@/types/user";

interface OrderItem {
  sku: string;
  quantity?: number;
  cantidad?: number;
  product_name?: string;
  nombre?: string;
  desdetallada?: string;
  unit_price?: string | number;
  precio?: string | number;
  imagen?: string;
  image_preview_url?: string;
  picture_url?: string;
}

interface TiendaData {
  codigo?: string;
  descripcion?: string;
  nombre?: string;
  direccion?: string;
  ciudad?: string;
  telefono?: string;
  latitud?: string;
  longitud?: string;
}

interface DireccionDestino {
  id?: string;
  linea_uno?: string;
  direccion_formateada?: string;
  ciudad?: string;
}

interface OrderData {
  id?: string;
  orden_id?: string;
  fecha_creacion: string;
  usuario_id?: string;
  metodo_envio?: number; // 1=Coordinadora, 2=Pickup, 3=Imagiq
  total_amount?: number;
  serial_id?: string;
  envios?: Array<{
    numero_guia: string;
    tiempo_entrega_estimado: string;
  }>;
  order_items?: OrderItem[];
  productos?: OrderItem[]; // Para Coordinadora
  // Para Imagiq
  envio?: {
    numero_guia: string;
    tiempo_entrega_estimado: string;
    direccion_destino?: DireccionDestino;
    tienda_origen?: TiendaData;
  };
  items?: OrderItem[]; // Para Imagiq y Pickup
  // Para Pickup
  tienda?: TiendaData;
  tienda_origen?: TiendaData;
  token?: string;
  recogida_tienda?: {
    hora_recogida_autorizada?: string;
  };
  direccion_entrega?: string;
  ciudad_entrega?: string;
  shippingAddress?: string;
}

interface UserData {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string;
  email?: string;
}


export default function SuccessCheckoutPage({
  params,
}: Readonly<{ params: Promise<{ orderId: string }> }>) {
  const pathParams = use(params);
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [verified, setVerified] = useState(false);
  const { clearCart } = useCart();

  // Safety net: verificar que la orden realmente fue aprobada
  useEffect(() => {
    const verifyOrderStatus = async () => {
      try {
        const res = await apiClient.get<{ orderStatus?: string; message?: string }>(
          `/api/orders/verify/${pathParams.orderId}`
        );
        if (res.data?.orderStatus === "REJECTED") {
          router.replace(
            `/error-checkout?message=${encodeURIComponent(res.data?.message || "Tu pago fue rechazado por el banco")}`
          );
          return;
        }
      } catch {
        // Si falla la verificación, mostrar success como fallback
      }
      setVerified(true);
    };
    verifyOrderStatus();
  }, [pathParams.orderId, router]);
  const { trackPurchase } = useAnalyticsWithUser();
  const whatsappSentRef = useRef(false);
  const analyticsSentRef = useRef(false);
  const emailSentRef = useRef(false);
  // Hook para obtener usuario del localStorage encriptado (para usuarios sin sesión activa pero con cuenta creada en Step2)
  const [loggedUser] = useSecureStorage<User | null>("imagiq_user", null);

  // Enviar evento de purchase a analytics
  useEffect(() => {
    const sendPurchaseEvent = async () => {
      if (analyticsSentRef.current) return;
      analyticsSentRef.current = true;

      try {
        const orderResponse = await apiClient.get<OrderData>(
          `/api/orders/shipping-info/${pathParams.orderId}`
        );

        if (orderResponse.success && orderResponse.data) {
          const orderData = orderResponse.data;
          const items = orderData.order_items || [];

          // Calcular el valor total usando precios reales
          const totalValue = orderData.total_amount || items.reduce(
            (sum, item) => sum + (Number(item.unit_price || item.precio) || 0) * (item.quantity || item.cantidad || 1),
            0
          );

          const mappedItems = items.map((item) => ({
            item_id: item.sku || "unknown",
            item_name: item.product_name || item.nombre || "Producto",
            item_brand: "Samsung",
            price: Number(item.unit_price || item.precio) || 0,
            quantity: item.quantity || item.cantidad || 1,
          }));

          // Enviar evento de purchase a GA4/Meta/TikTok
          trackPurchase(pathParams.orderId, mappedItems, totalValue);

          // Enviar evento de purchase a PostHog (client-side, dedup via $insert_id en server)
          try {
            posthogUtils.capture("purchase", {
              $insert_id: `purchase_${pathParams.orderId}`,
              event_id: `purchase_${pathParams.orderId}`,
              order_id: pathParams.orderId,
              transaction_id: pathParams.orderId,
              currency: "COP",
              value: totalValue,
              items: mappedItems.map((item) => ({
                sku: item.item_id,
                name: item.item_name,
                brand: "Samsung",
                price: item.price,
                quantity: item.quantity,
              })),
              item_count: mappedItems.reduce((sum, i) => sum + i.quantity, 0),
              source: "client",
            });
          } catch (e) {
            console.error("[PostHog] Error capturing purchase:", e);
          }
        }
      } catch (error) {
        console.error("[Analytics] Error sending purchase event:", error);
      }
    };

    sendPurchaseEvent();
  }, [pathParams.orderId, trackPurchase]);

  /*
  // Enviar mensaje de WhatsApp cuando se carga la página
  useEffect(() => {
    const sendWhatsAppMessage = async () => {
      if (whatsappSentRef.current) {
        return; // Evitar envíos duplicados
      }
      whatsappSentRef.current = true; // Marcar como enviado inmediatamente

      try {
        // Primero obtener el método de envío
        let metodoEnvio: number | undefined;
        try {
          const deliveryMethodRes = await apiClient.get<{ metodo_envio: number }>(
            `/api/orders/${pathParams.orderId}/delivery-method`
          );
          if (deliveryMethodRes.success && deliveryMethodRes.data) {
            metodoEnvio = deliveryMethodRes.data.metodo_envio;
          }
        } catch (error) {
          console.error("❌ [WhatsApp] Error al obtener método de envío:", error);
          return;
        }

        // Validar método de envío soportado (1=Coordinadora, 2=Pickup, 3=Imagiq)
        if (metodoEnvio !== 1 && metodoEnvio !== 2 && metodoEnvio !== 3) {
          console.log("ℹ️ [WhatsApp] WhatsApp no se envía para este método de envío:", {
            metodo_envio: metodoEnvio,
            ordenId: pathParams.orderId,
            razon: "Método desconocido"
          });
          return;
        }

        // Obtener datos de la orden según el método de envío
        // Coordinadora (1): usar /api/orders/shipping-info/${orderId} para obtener items
        // Pickup (2): usar /api/orders/${orderId}/tiendas para obtener datos de tienda
        // Imagiq (3): usar /api/orders/${orderId}/imagiq
        let orderEndpoint = `/api/orders/shipping-info/${pathParams.orderId}`;
        if (metodoEnvio === 2) {
          orderEndpoint = `/api/orders/${pathParams.orderId}/tiendas`;
        } else if (metodoEnvio === 3) {
          orderEndpoint = `/api/orders/${pathParams.orderId}/imagiq`;
        }

        const orderResponse = await apiClient.get<OrderData>(orderEndpoint);

        if (!orderResponse.success || !orderResponse.data) {
          console.error("❌ [WhatsApp] Error al obtener datos de la orden:", orderResponse);
          return;
        }

        const orderData = orderResponse.data;

        // Obtener datos del usuario desde SecureStorage (datos encriptados)
        // Usamos loggedUser que viene del hook useSecureStorage
        const userInfo: UserData | null = loggedUser ? {
          id: loggedUser.id,
          nombre: loggedUser.nombre || "",
          apellido: loggedUser.apellido || "",
          telefono: loggedUser.telefono || "",
          email: loggedUser.email,
        } : null;

        if (!userInfo || !userInfo.telefono) {
          console.error("❌ [WhatsApp] No hay información de usuario o teléfono disponible", { loggedUser });
          return;
        }

        // Limpiar y formatear el teléfono (quitar espacios, guiones, paréntesis, etc.)
        let telefono = userInfo.telefono.toString().replace(/[\s+\-()]/g, "");

        // Asegurar que el teléfono tenga el código de país 57
        if (!telefono.startsWith("57")) {
          telefono = "57" + telefono;
        }

        // Capitalizar la primera letra del nombre
        const nombreCapitalizado =
          userInfo.nombre.charAt(0).toUpperCase() +
          userInfo.nombre.slice(1).toLowerCase();

        // CASO 1: PICKUP EN TIENDA (metodo_envio === 2)
        if (metodoEnvio === 2) {
          // Para pickup, necesitamos: nombre de tienda, nombre usuario, order id, token
          const ordenId = orderData.id || pathParams.orderId;
          
          // Obtener datos de la tienda
          const tiendaData = orderData.tienda || orderData.tienda_origen;
          let nombreTienda = tiendaData?.descripcion || tiendaData?.nombre || "Tienda IMAGIQ";
          
          // Validar y truncar nombre de tienda si excede 30 caracteres
          if (nombreTienda.length > 30) {
            // Para Bogotá: quitar "Ses " del inicio si existe
            if (nombreTienda.toLowerCase().includes('bogotá') || nombreTienda.toLowerCase().includes('bogota')) {
              if (nombreTienda.startsWith("Ses ")) {
                nombreTienda = nombreTienda.substring(4); // Quitar "Ses "
              }
            } else {
              // Para otras ciudades: tomar últimas 3, 2 o 1 palabra según sea necesario
              const palabras = nombreTienda.trim().split(/\s+/); // Dividir por espacios
              
              // Intentar con las últimas 3 palabras
              if (palabras.length >= 3) {
                const ultimas3 = palabras.slice(-3).join(' ');
                if (ultimas3.length <= 30) {
                  nombreTienda = ultimas3;
                } else {
                  // Si aún excede, intentar con las últimas 2 palabras
                  if (palabras.length >= 2) {
                    const ultimas2 = palabras.slice(-2).join(' ');
                    if (ultimas2.length <= 30) {
                      nombreTienda = ultimas2;
                    } else {
                      // Si aún excede, tomar solo la última palabra
                      nombreTienda = palabras[palabras.length - 1];
                    }
                  } else {
                    nombreTienda = palabras[palabras.length - 1];
                  }
                }
              } else {
                // Si hay menos de 3 palabras, tomar la última
                nombreTienda = palabras[palabras.length - 1];
              }
            }
          }
          
          // Obtener token de recogida - puede venir como objeto o string
          const tokenData = orderData.token as unknown;
          let tokenRecogida = "";
          if (typeof tokenData === 'string') {
            tokenRecogida = tokenData;
          } else if (tokenData && typeof tokenData === 'object' && 'token' in tokenData) {
            tokenRecogida = String((tokenData as { token: string }).token);
          }
          
          // Obtener número de pedido (serial_id o primeros 8 del UUID)
          const numeroPedido = orderData.serial_id || ordenId.substring(0, 8);

          const payloadPickup = {
            to: telefono,
            nombre: nombreCapitalizado,
            numeroPedido: numeroPedido,
            nombreTienda: nombreTienda,
            producto: "Token", // Fijo
            horarioRecogida: tokenRecogida, // Este es el token
            resumen: "Token", // Fijo
            ordenId: ordenId
          };

          console.log("📱 [WhatsApp Pickup] Payload que se enviará:", JSON.stringify(payloadPickup, null, 2));

          // Enviar mensaje de WhatsApp de pickup al backend
          try {
            const whatsappData = await apiPost<{
              success: boolean;
              messageId?: string;
              message?: string;
              error?: string;
              details?: string;
            }>('/api/messaging/pickup', payloadPickup);

            if (!whatsappData.success) {
              console.error("❌ [WhatsApp] Error en respuesta de WhatsApp pickup:", {
                success: whatsappData.success,
                error: whatsappData.error,
                details: whatsappData.details
              });
              whatsappSentRef.current = false;
            } else {
              console.log("✅ [WhatsApp] Mensaje de pickup enviado exitosamente:", {
                messageId: whatsappData.messageId,
                message: whatsappData.message,
                ordenId: pathParams.orderId,
                telefono: telefono
              });
            }
          } catch (whatsappError) {
            console.error("❌ [WhatsApp] Error al enviar mensaje de WhatsApp pickup:", whatsappError);
            whatsappSentRef.current = false;
            return;
          }
          
          return; // Terminar aquí para pickup
        }

        // CASO 2 y 3: ENVÍO A DOMICILIO (Coordinadora o Imagiq)
        // Obtener datos del envío según el método
        let numeroGuia: string;
        let tiempoEntregaEstimado: string | undefined;

        if (metodoEnvio === 3) {
          // Imagiq: datos vienen en orderData.envio
          numeroGuia = orderData.envio?.numero_guia || 
            (orderData.orden_id ? orderData.orden_id.substring(0, 8) : pathParams.orderId.substring(0, 8));
          tiempoEntregaEstimado = orderData.envio?.tiempo_entrega_estimado;
        } else {
          // Coordinadora: datos vienen en orderData.envios array
          const envioData =
            orderData.envios && orderData.envios.length > 0
              ? orderData.envios[0]
              : null;
          numeroGuia = envioData?.numero_guia || 
            (orderData.orden_id ? orderData.orden_id.substring(0, 8) : pathParams.orderId.substring(0, 8));
          tiempoEntregaEstimado = envioData?.tiempo_entrega_estimado;
        }

        // Calcular fechas de entrega estimada (formato corto para WhatsApp) - solo días hábiles
        let fechaEntrega = "Próximamente";

        if (tiempoEntregaEstimado) {
          const fechaCreacion = new Date(orderData.fecha_creacion);
          const dias = Number.parseInt(tiempoEntregaEstimado);

          // Calcular fecha inicial sumando días hábiles
          const fechaInicial = addBusinessDays(fechaCreacion, dias);
          const diaInicio = fechaInicial.getDate();
          const mesInicio = fechaInicial.toLocaleDateString("es-ES", {
            month: "short",
          });

          // Fecha final: un día hábil después de la inicial
          const fechaFinal = getNextBusinessDay(fechaInicial);
          const diaFin = fechaFinal.getDate();
          const mesFin = fechaFinal.toLocaleDateString("es-ES", {
            month: "short",
          });

          // Formato corto: "29-31 de oct" o "29 oct - 1 nov"
          if (mesInicio === mesFin) {
            fechaEntrega = `${diaInicio}-${diaFin} de ${mesInicio}`;
          } else {
            fechaEntrega = `${diaInicio} ${mesInicio} - ${diaFin} ${mesFin}`;
          }
        }

        // Obtener productos según el método
        let productosDesc = "tus productos";
        let cantidadTotal = 0;

        if (metodoEnvio === 3) {
          // Imagiq: productos vienen en orderData.items
          if (orderData.items && orderData.items.length > 0) {
            cantidadTotal = orderData.items.reduce(
              (total: number, item: { cantidad?: number }) => {
                return total + (item.cantidad || 1);
              },
              0
            );

            const descripcion = orderData.items
              .map((item: { cantidad?: number; desdetallada?: string; nombre?: string }) => {
                const quantity = item.cantidad || 1;
                const name = item.desdetallada || item.nombre || "producto";
                return `${quantity} ${name}`;
              })
              .join(", ");

            // WhatsApp tiene límite de 30 caracteres para este campo
            if (descripcion.length <= 30) {
              productosDesc = descripcion;
            } else {
              productosDesc =
                cantidadTotal === 1
                  ? "tu producto"
                  : `tus ${cantidadTotal} productos`;
            }
          }
        } else {
          // Coordinadora: obtener items del carrito desde localStorage
          const cartItems = localStorage.getItem("cart-items");
          if (cartItems) {
            try {
              const items = JSON.parse(cartItems);
              if (Array.isArray(items) && items.length > 0) {
                cantidadTotal = items.reduce(
                  (total: number, item: { quantity?: number }) => {
                    return total + (item.quantity || 1);
                  },
                  0
                );

                const descripcion = items
                  .map(
                    (item: {
                      quantity?: number;
                      name?: string;
                      sku?: string;
                    }) => {
                      const quantity = item.quantity || 1;
                      const name = item.name || item.sku || "producto";
                      return `${quantity} ${name}`;
                    }
                  )
                  .join(", ");

                if (descripcion.length <= 30) {
                  productosDesc = descripcion;
                } else {
                  productosDesc =
                    cantidadTotal === 1
                      ? "tu producto"
                      : `tus ${cantidadTotal} productos`;
                }
              }
            } catch {
              // Error al parsear cart-items, continuar con valor por defecto
            }
          }
        }

        // Validar y truncar productos si excede 30 caracteres
        let productosFinal = productosDesc;
        if (productosDesc.length > 30) {
          productosFinal = "tus productos";
        }

        // Validar y truncar fechaEntrega si excede 30 caracteres
        let fechaEntregaFinal = fechaEntrega;
        if (fechaEntrega.length > 30) {
          fechaEntregaFinal = "Próximamente";
        }

        // Preparar payload para el endpoint /api/messaging/pedido-confirmado
        // El backend maneja el template_id internamente, no necesitamos enviarlo
        // Usar el id (UUID) de la orden como orderId
        const ordenId = orderData.id || pathParams.orderId;
        
        const payload = {
          to: telefono,
          nombre: nombreCapitalizado,
          ordenId: ordenId,
          numeroGuia: numeroGuia,
          productos: productosFinal,
          fechaEntrega: fechaEntregaFinal,
        };

        // Enviar mensaje de WhatsApp al backend usando apiPost
        try {
          const whatsappData = await apiPost<{
            success: boolean;
            messageId?: string;
            message?: string;
            error?: string;
            details?: string;
          }>('/api/messaging/pedido-confirmado', payload);

          // Verificar respuesta exitosa según la especificación del endpoint
          if (!whatsappData.success) {
            console.error("❌ [WhatsApp] Error en respuesta de WhatsApp:", {
              success: whatsappData.success,
              error: whatsappData.error,
              details: whatsappData.details
            });
            whatsappSentRef.current = false;
          } else {
            console.log("✅ [WhatsApp] Mensaje enviado exitosamente:", {
              messageId: whatsappData.messageId,
              message: whatsappData.message,
              ordenId: pathParams.orderId,
              telefono: telefono
            });
          }
        } catch (whatsappError) {
          console.error("❌ [WhatsApp] Error al enviar mensaje de WhatsApp:", whatsappError);
          // Resetear el flag para permitir reintento en caso de error
          whatsappSentRef.current = false;
          return;
        }
      } catch (error) {
        console.error("❌ [WhatsApp] Error al procesar envío de WhatsApp:", error);
        whatsappSentRef.current = false;
      }
    };

    sendWhatsAppMessage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathParams.orderId, loggedUser?.id]); // Depende del orderId y loggedUser.id, useRef previene duplicados

  // Enviar email de confirmación cuando se carga la página
  useEffect(() => {
    const sendEmailConfirmation = async () => {
      if (emailSentRef.current) {
        return; // Evitar envíos duplicados
      }
      emailSentRef.current = true; // Marcar como enviado inmediatamente

      try {
        // Primero obtener el método de envío
        let metodoEnvio: number | undefined;
        try {
          const deliveryMethodRes = await apiClient.get<{ metodo_envio: number }>(
            `/api/orders/${pathParams.orderId}/delivery-method`
          );
          if (deliveryMethodRes.success && deliveryMethodRes.data) {
            metodoEnvio = deliveryMethodRes.data.metodo_envio;
          }
        } catch (error) {
          console.error("❌ [Email] Error al obtener método de envío:", error);
          return;
        }

        // Obtener datos de la orden según el método de envío
        // Para EMAIL:
        // Coordinadora (1): usar /api/orders/${orderId}/imagiq (mismo que Imagiq para obtener items)
        // Imagiq (3): usar /api/orders/${orderId}/imagiq
        // Pickup (2): usar /api/orders/${orderId}/tiendas
        let orderEndpoint = `/api/orders/${pathParams.orderId}/imagiq`;
        if (metodoEnvio === 2) {
          orderEndpoint = `/api/orders/${pathParams.orderId}/tiendas`;
        }

        const orderResponse = await apiClient.get<OrderData>(orderEndpoint);

        if (!orderResponse.success || !orderResponse.data) {
          console.error("❌ [Email] Error al obtener datos de la orden:", orderResponse);
          return;
        }

        const orderData = orderResponse.data;

        // Obtener datos del usuario desde SecureStorage (datos encriptados)
        // Usamos loggedUser que viene del hook useSecureStorage
        const userInfo: UserData | null = loggedUser ? {
          id: loggedUser.id,
          nombre: loggedUser.nombre || "",
          apellido: loggedUser.apellido || "",
          telefono: loggedUser.telefono || "",
          email: loggedUser.email,
        } : null;

        if (!userInfo || !userInfo.email) {
          console.error("❌ [Email] No hay información de usuario o email disponible", { loggedUser });
          return;
        }

        // Determinar si es recogida en tienda (metodo_envio === 2)
        const isRecogidaEnTienda = metodoEnvio === 2;

        if (isRecogidaEnTienda) {
          // Recogida en tienda: usar endpoint store-pickup
          // Mapear igual que en tracking service
          // Usar el id (UUID) de la orden como orderId
          const ordenId = orderData.id || pathParams.orderId;
          
          console.log("📦 [Email Pickup] Datos recibidos del endpoint /tiendas:", {
            ordenId,
            tienda: orderData.tienda,
            items: orderData.items,
            token: orderData.token,
            total_amount: orderData.total_amount,
            fecha_creacion: orderData.fecha_creacion
          });
          
          // Obtener datos de la tienda desde orderData (para pickup) - igual que tracking service
          const tiendaDataRaw = orderData.tienda;
          if (!tiendaDataRaw || (!tiendaDataRaw.direccion && !tiendaDataRaw.ciudad && !tiendaDataRaw.descripcion)) {
            console.error("❌ [Email] No hay datos de tienda para recogida");
            return;
          }

          // Mapear tienda igual que en tracking service
          const direccionTienda = (tiendaDataRaw.direccion != null && tiendaDataRaw.direccion !== "")
            ? String(tiendaDataRaw.direccion).trim()
            : "";
          const ciudadTienda = (tiendaDataRaw.ciudad != null && tiendaDataRaw.ciudad !== "")
            ? String(tiendaDataRaw.ciudad).trim()
            : "";

          const tiendaData: TiendaData = {
            nombre: (tiendaDataRaw.nombre != null && tiendaDataRaw.nombre !== "") 
              ? String(tiendaDataRaw.nombre).trim() 
              : undefined,
            descripcion: (tiendaDataRaw.descripcion != null && tiendaDataRaw.descripcion !== "") 
              ? String(tiendaDataRaw.descripcion).trim() 
              : undefined,
            direccion: direccionTienda || "Tienda IMAGIQ",
            ciudad: ciudadTienda || "Bogotá",
            telefono: (tiendaDataRaw.telefono != null && tiendaDataRaw.telefono !== "") 
              ? String(tiendaDataRaw.telefono).trim() 
              : undefined,
          };

          // Obtener productos - igual que tracking service (data.items)
          const productos = orderData.items || [];
          const productosMapeados = productos.map((p: OrderItem) => ({
            name: p.desdetallada || p.nombre || p.product_name || p.sku || "Producto",
            quantity: p.cantidad || p.quantity || 1,
            image: p.image_preview_url || p.picture_url || undefined
          }));

          // Obtener token de recogida - puede venir como objeto o string
          const emailTokenData = orderData.token as unknown;
          let emailToken = "";
          if (typeof emailTokenData === 'string') {
            emailToken = emailTokenData;
          } else if (emailTokenData && typeof emailTokenData === 'object' && 'token' in emailTokenData) {
            emailToken = String((emailTokenData as { token: string }).token);
          }

          // Construir dirección de la tienda
          const storeAddress = tiendaData.direccion 
            ? `${tiendaData.direccion}, ${tiendaData.ciudad || ""}`.trim()
            : tiendaData.descripcion || "";

          const payload = {
            to: userInfo.email,
            orderId: ordenId,
            customerName: `${userInfo.nombre} ${userInfo.apellido || ""}`.trim(),
            products: productosMapeados,
            storeName: tiendaData.descripcion || tiendaData.nombre || "Tienda IMAGIQ",
            storeAddress: storeAddress,
            storeMapsUrl: `https://maps.google.com/?q=${encodeURIComponent(storeAddress)}`,
            pickupToken: emailToken,
            qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(emailToken)}`,
            orderDate: new Date(orderData.fecha_creacion).toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            }),
            totalValue: orderData.total_amount || 0
          };

          console.log("📧 [Email Pickup] Payload que se enviará:", JSON.stringify(payload, null, 2));

          try {
            const emailData = await apiPost<{
              success: boolean;
              messageId?: string;
              message?: string;
              error?: string;
              details?: string;
            }>('/api/messaging/email/store-pickup', payload);

            if (!emailData.success) {
              console.error("❌ [Email] Error en respuesta de email:", {
                success: emailData.success,
                error: emailData.error,
                details: emailData.details
              });
              emailSentRef.current = false;
            } else {
              console.log("✅ [Email] Email de recogida enviado exitosamente:", {
                messageId: emailData.messageId,
                message: emailData.message,
                ordenId: pathParams.orderId,
                email: userInfo.email
              });
            }
          } catch (emailError) {
            console.error("❌ [Email] Error al enviar email de recogida:", emailError);
            emailSentRef.current = false;
          }
        } else {
          // Envío a domicilio (Coordinadora o Imagiq): usar endpoint order-confirmation
          // Mapear igual que en tracking service
          // Usar el número de guía si está disponible, sino el id (UUID) de la orden
          const numeroGuia = orderData.envio?.numero_guia || 
            (orderData.envios && orderData.envios.length > 0 ? orderData.envios[0].numero_guia : null);
          const ordenId = numeroGuia || orderData.id || pathParams.orderId;

          // Obtener productos - para email, Coordinadora (1) e Imagiq (3) usan el mismo endpoint /imagiq
          // Ambos devuelven data.items con desdetallada, nombre, cantidad, unit_price, image_preview_url
          const productos: OrderItem[] = orderData.items || [];

          // Mapear productos - estructura igual para Coordinadora e Imagiq cuando se usa /imagiq
          const productosMapeados = productos.map((p: OrderItem) => ({
            name: p.desdetallada || p.nombre || p.product_name || p.sku || "Producto",
            quantity: p.cantidad || p.quantity || 1,
            price: p.unit_price ? Number.parseFloat(String(p.unit_price)) : (p.precio ? Number(p.precio) : 0),
            image: p.image_preview_url || p.picture_url || p.imagen || undefined
          }));

          // Obtener dirección de envío - para email, Coordinadora (1) e Imagiq (3) usan el mismo endpoint /imagiq
          // Ambos devuelven la dirección en orderData.envio.direccion_destino
          let shippingAddress = "";
          const direccionDestino = orderData.envio?.direccion_destino;
          if (direccionDestino) {
            shippingAddress = direccionDestino.direccion_formateada || 
              `${direccionDestino.linea_uno || ""}, ${direccionDestino.ciudad || ""}`.trim();
          } else {
            // Fallback si no viene en envio.direccion_destino
            shippingAddress = orderData.direccion_entrega || "";
          }

          // Calcular fecha de entrega estimada - para email, Coordinadora (1) e Imagiq (3) usan el mismo endpoint /imagiq
          // Ambos devuelven tiempo_entrega_estimado en orderData.envio
          let estimatedDelivery = "1-3 días hábiles";
          if (orderData.envio?.tiempo_entrega_estimado) {
            const dias = Number.parseInt(orderData.envio.tiempo_entrega_estimado);
            estimatedDelivery = `${dias} día${dias > 1 ? 's' : ''} hábil${dias > 1 ? 'es' : ''}`;
          } else if (orderData.envios && orderData.envios.length > 0) {
            // Fallback si no viene en envio.tiempo_entrega_estimado
            const dias = Number.parseInt(orderData.envios[0].tiempo_entrega_estimado);
            estimatedDelivery = `${dias} día${dias > 1 ? 's' : ''} hábil${dias > 1 ? 'es' : ''}`;
          }

          // Construir URL de tracking - usar el id (UUID) para la URL, no el número de guía
          const trackingUrlId = orderData.id || pathParams.orderId;
          const trackingUrl = `https://staging.imagiq.com/tracking-service/${trackingUrlId}`;

          const payload = {
            to: userInfo.email,
            orderId: ordenId,
            customerName: `${userInfo.nombre} ${userInfo.apellido || ""}`.trim(),
            products: productosMapeados,
            total: orderData.total_amount || 0,
            shippingAddress: shippingAddress,
            shippingMethod: metodoEnvio === 3 ? "Envío Imagiq" : "Envío Estándar",
            estimatedDelivery: estimatedDelivery,
            trackingUrl: trackingUrl,
            orderDate: new Date(orderData.fecha_creacion).toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            })
          };

          try {
            const emailData = await apiPost<{
              success: boolean;
              messageId?: string;
              message?: string;
              error?: string;
              details?: string;
            }>('/api/messaging/email/order-confirmation', payload);

            if (!emailData.success) {
              console.error("❌ [Email] Error en respuesta de email:", {
                success: emailData.success,
                error: emailData.error,
                details: emailData.details
              });
              emailSentRef.current = false;
            } else {
              console.log("✅ [Email] Email de confirmación enviado exitosamente:", {
                messageId: emailData.messageId,
                message: emailData.message,
                ordenId: pathParams.orderId,
                email: userInfo.email
              });
            }
          } catch (emailError) {
            console.error("❌ [Email] Error al enviar email de confirmación:", emailError);
            emailSentRef.current = false;
          }
        }
      } catch (error) {
        console.error("❌ [Email] Error al procesar envío de email:", error);
        emailSentRef.current = false;
      }
    };

    sendEmailConfirmation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathParams.orderId, loggedUser?.id]); // Depende del orderId y loggedUser.id, useRef previene duplicados
  */

  // Coordenadas para el efecto de expansión de la animación (centrado)
  const [triggerPosition, setTriggerPosition] = useState(() => {
    if (typeof window !== "undefined") {
      return {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      };
    }
    return { x: 0, y: 0 };
  });

  /**
   * Maneja el cierre del overlay y la redirección al tracking service
   * - Cierra suavemente la animación
   * - Limpia el carrito de compras
   * - Redirecciona al usuario al tracking service
   */
  const handleClose = () => {
    setOpen(false);

    // Pequeño retraso antes de redirigir para permitir que la animación de cierre termine
    setTimeout(() => {
      // Limpiar carrito al finalizar exitosamente usando el hook centralizado
      clearCart();

      // También limpiar otros datos relacionados con la compra
      if (typeof window !== "undefined") {
        localStorage.removeItem("applied-discount");
        localStorage.removeItem("current-order");
        // SEGURIDAD: Limpiar datos de tarjeta temporal después de compra exitosa
        sessionStorage.removeItem("checkout-card-data");
      }

      // Redirigir al tracking service
      router.push(`/tracking-service/${pathParams.orderId}`);
    }, 300);
  };

  // Ajustar posición al cambiar el tamaño de la ventana
  useEffect(() => {
    const handleResize = () => {
      setTriggerPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // No mostrar nada hasta verificar que la orden fue aprobada
  if (!verified) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#009047]">
        <div className="animate-spin h-8 w-8 border-4 border-white border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#009047]">
      <CheckoutSuccessOverlay
        open={open}
        onClose={handleClose}
        message="¡Tu compra ha sido exitosa!"
        triggerPosition={triggerPosition}
      />
    </div>
  );
}
