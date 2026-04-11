"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

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
  if (!socket) {
    const url = `${getSocketUrl()}/realtime`;
    console.log(`[Socket] Creating NEW socket -> ${url} (channel: ${channel})`);
    socket = io(url, {
      transports: ["websocket", "polling"],
      query: { channel },
      withCredentials: true,
    });

    socket.on("connect", () => {
      console.log(`[Socket] Connected! id: ${socket?.id}, channel: ${channel}`);
    });

    socket.on("connect_error", (error) => {
      console.error("[Socket] Connection error:", error.message);
    });

    socket.on("reconnect_error", (error) => {
      console.error("[Socket] Reconnection error:", error.message);
    });

    socket.on("reconnect_failed", () => {
      console.error("[Socket] Reconnection failed after all attempts");
    });

    socket.on("disconnect", (reason) => {
      console.log(`[Socket] Disconnected: ${reason}`);
    });

    // Debug: log ALL incoming events for products_updated
    socket.on("products_updated", (data: unknown) => {
      console.log(`[Socket] RAW products_updated event received:`, data);
    });
  } else {
    console.log(`[Socket] Reusing existing socket (id: ${socket.id}, original channel: ${socket.io.opts.query?.channel}, requested: ${channel})`);
  }

  return socket;
}
