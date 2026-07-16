"use client";

import { io, Socket } from "socket.io-client";

// Un socket POR canal (no un singleton único). Antes había un solo `socket`
// compartido y el canal se fijaba con la PRIMERA conexión: como los grids del
// home conectan 'products' antes de que ClientLayout conecte 'inweb' (React
// corre los efectos hijo→padre), el socket quedaba con channel='products' y el
// backend —que hace el catch-up de la campaña activa SOLO a channel='inweb'
// (campaigns-proxy.gateway.ts)— se lo saltaba → el pop-up no salía en cargas
// directas. Con una conexión independiente por canal, 'inweb' SIEMPRE conecta
// como 'inweb' y recibe la campaña activa.
const sockets: Record<string, Socket> = {};

function getSocketUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  // In the browser, if the page was loaded via a non-localhost hostname (e.g. LAN IP
  // or devtunnel), replace localhost in the API URL with the actual hostname so that
  // socket.io can reach the backend from devices like the iOS Simulator.
  if (typeof window !== "undefined") {
    const pageHost = window.location.hostname;
    if (pageHost !== "localhost" && pageHost !== "127.0.0.1" && envUrl.includes("localhost")) {
      return envUrl.replace("localhost", pageHost);
    }
  }
  return envUrl;
}

export function connectSocket(channel: string): Socket {
  const existing = sockets[channel];
  if (existing) {
    console.log(
      `[Socket] Reusing existing socket for channel '${channel}' (id: ${existing.id})`,
    );
    return existing;
  }

  const url = `${getSocketUrl()}/realtime`;
  console.log(`[Socket] Creating NEW socket -> ${url} (channel: ${channel})`);
  const socket = io(url, {
    transports: ["websocket", "polling"],
    query: { channel },
    withCredentials: true,
    // CRÍTICO: forzar una conexión NUEVA por canal. Sin esto, socket.io reusa
    // el Manager de la primera conexión al mismo host e IGNORA el `query.channel`
    // distinto → volveríamos al bug del canal compartido.
    forceNew: true,
  });

  socket.on("connect", () => {
    console.log(`[Socket] Connected! id: ${socket.id}, channel: ${channel}`);
  });

  socket.on("connect_error", (error) => {
    console.error(`[Socket] Connection error (channel: ${channel}):`, error.message);
  });

  socket.on("reconnect_error", (error) => {
    console.error(`[Socket] Reconnection error (channel: ${channel}):`, error.message);
  });

  socket.on("reconnect_failed", () => {
    console.error(`[Socket] Reconnection failed after all attempts (channel: ${channel})`);
  });

  socket.on("disconnect", (reason) => {
    console.log(`[Socket] Disconnected (channel: ${channel}): ${reason}`);
  });

  // Debug: log ALL incoming products_updated events (relevante para el canal 'products')
  socket.on("products_updated", (data: unknown) => {
    console.log(`[Socket] RAW products_updated event received (channel: ${channel}):`, data);
  });

  sockets[channel] = socket;
  return socket;
}
