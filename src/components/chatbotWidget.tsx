"use client";
import { useEffect } from "react";
import ChatLauncher from "./chat/ChatLauncher";
import ChatPanel from "./chat/ChatPanel";
import { useChatbotVisibility } from "@/hooks/useChatbotVisibility";
import { useChatbot } from "@/contexts/ChatbotContext";

export default function ChatbotWidget() {
  const isVisible = useChatbotVisibility();
  const { isOpen, openChat, closeChat } = useChatbot();

  // Cerrar el panel si navegamos a una ruta donde no debe verse
  useEffect(() => {
    if (!isVisible && isOpen) {
      closeChat();
    }
  }, [isVisible, isOpen, closeChat]);

  // No renderizar nada si no es visible
  if (!isVisible) {
    return null;
  }

  return (
    <>
      <ChatLauncher onClick={openChat} hidden={isOpen} />
      {isOpen && <ChatPanel onClose={closeChat} />}
    </>
  );
}
