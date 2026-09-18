'use client';

import { useState } from 'react';

interface LiveChatProps {
  videoId: string;
  isLive: boolean;
}

export default function LiveChat({ videoId, isLive }: LiveChatProps) {
  // En móvil el chat arranca recogido para que los productos queden a la
  // vista debajo del video; en escritorio siempre se muestra (md:block).
  const [isCollapsed, setIsCollapsed] = useState(true);

  if (!isLive) return null;

  const embedDomain = typeof window !== 'undefined' ? window.location.hostname : '';
  const chatUrl = `https://www.youtube.com/live_chat?v=${videoId}&embed_domain=${embedDomain}`;

  return (
    <div className="flex flex-col h-full">
      {/* Mobile toggle */}
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="md:hidden flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-100 text-gray-700 text-sm font-medium rounded-t-lg"
      >
        {isCollapsed ? 'Ver chat en vivo' : 'Ocultar chat'}
        <svg
          className={`w-4 h-4 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Chat iframe */}
      <div
        className={`flex-1 min-h-0 ${isCollapsed ? 'hidden md:block' : ''}`}
      >
        <iframe
          src={chatUrl}
          className="w-full h-full min-h-[300px] md:min-h-[400px] rounded-b-lg md:rounded-lg border border-gray-200"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          title="YouTube Live Chat"
        />
      </div>
    </div>
  );
}
