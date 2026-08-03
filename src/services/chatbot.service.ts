/**
 * Servicio de Chatbot
 * Maneja la comunicación con el API de agente conversacional
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;

export interface ChatbotRequest {
  query: string;
  session_id?: string;
}

// Interfaz simplificada para productos del agente
// Solo necesitamos el ID (codigoMarketBase) para renderizar el ProductCard
export interface AgentProduct {
  id: string; // codigoMarketBase - es lo único que necesitamos
  nombre?: string;
  precio?: number;
  imagen_url?: string;
}

export interface ChatbotResponse {
  success: boolean;
  message: string;
  session_id: string;
  category: string | null;
  menu: string | null;
  submenu: string | null;
  reasoning: string | null;
  product: AgentProduct | null;
  products: AgentProduct[];
  answer: string;
  route: string;
}

/**
 * Envía un mensaje al agente conversacional
 * 
 * @param query - Mensaje del usuario
 * @param sessionId - ID de sesión opcional para mantener el contexto de la conversación
 * @returns Respuesta del agente con el campo answer para mostrar al usuario
 */
export async function sendMessageToAgent(
  query: string,
  sessionId?: string
): Promise<ChatbotResponse> {
  try {
    const body: ChatbotRequest = { query };
    
    // Añadir session_id si existe
    if (sessionId) {
      body.session_id = sessionId;
    }

    // Crear AbortController para timeout de 2 minutos
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 segundos = 2 minutos

    // Token del usuario, si tiene sesión iniciada. Sin esto el asistente no
    // puede consultar SU pedido: el backend deriva la identidad del JWT y trata
    // como anónimo a quien no lo manda (nunca del user_id del cuerpo, que era
    // falsificable y permitía leer pedidos ajenos).
    const authToken =
      typeof window !== "undefined"
        ? localStorage.getItem("imagiq_token")
        : null;

    const response = await fetch(`${API_BASE_URL}/api/agent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(API_KEY && { "X-API-Key": API_KEY }),
        ...(authToken && { Authorization: `Bearer ${authToken}` }),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // El backend acompaña sus rechazos (429, 400, 503) con un `answer` ya
      // redactado en español. Mostrarlo es más útil que un código de estado.
      const errorBody = (await response.json().catch(() => null)) as
        | { answer?: string; message?: string }
        | null;
      throw new Error(
        errorBody?.answer ||
          errorBody?.message ||
          `Error ${response.status}: ${response.statusText}`
      );
    }

    const data: ChatbotResponse = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || "Error en la respuesta del agente");
    }

    return data;
  } catch (error) {
    console.error("[ChatbotService] Error al comunicarse con el agente:", error);
    
    // Manejo específico de errores de timeout del servidor
    if (error instanceof Error) {
      if (error.message.includes('504') || error.message.includes('Gateway Timeout')) {
        throw new Error('El servidor está tardando mucho en responder. Por favor, intenta con una consulta más específica.');
      }
      if (error.name === 'AbortError') {
        throw new Error('La solicitud tardó demasiado tiempo. Por favor, intenta de nuevo.');
      }
    }
    
    throw error;
  }
}
