/**
 * Canal de WhatsApp de atencion de Samsung Store.
 *
 * Antes cada boton traia el enlace corto `wa.link/6y2ctp` escrito a mano, que
 * redirige al 322 863 9389. Al centralizarlo aqui, el boton de la "1. Opcion"
 * y el de "Informacion de Contacto" abren siempre el mismo numero y se cambia
 * en un solo sitio.
 *
 * OJO: la imagen del codigo QR esta alojada en Cloudinary y NO se genera desde
 * esta constante, asi que sigue apuntando al numero anterior hasta que se
 * reemplace la imagen.
 */
export const WHATSAPP_NUMERO = "573006515136";

export const WHATSAPP_SALUDO = "Hola Samsung Store!";

export const WHATSAPP_CHAT_URL = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(
  WHATSAPP_SALUDO
)}`;
