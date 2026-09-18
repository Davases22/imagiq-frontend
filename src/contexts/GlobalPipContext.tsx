'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { getActiveLivestreamPages } from '@/services/multimedia-pages.service';

interface ActiveStream {
  videoId: string;
  slug: string;
  /** Ruta donde el stream ya se muestra inline (ej. "/" para el home): allí no se muestra el PiP global */
  inlinePathname?: string;
}

interface GlobalPipContextType {
  activeStream: ActiveStream | null;
  isGlobalPipVisible: boolean;
  registerStream: (stream: ActiveStream) => void;
  clearStream: () => void;
  dismissPip: () => void;
}

const PIP_HIDDEN_ROUTES = [
  '/carrito',
  '/charging-result',
  '/success-checkout',
  '/error-checkout',
  '/verify-purchase',
];

const GlobalPipContext = createContext<GlobalPipContextType | undefined>(undefined);

export function GlobalPipProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [activeStream, setActiveStream] = useState<ActiveStream | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isGlobalPipVisible, setIsGlobalPipVisible] = useState(false);

  // Auto-fetch active livestream on mount — only show PiP when stream is live
  useEffect(() => {
    let cancelled = false;
    let startTimer: ReturnType<typeof setTimeout> | null = null;

    async function fetchActiveStream() {
      const pages = await getActiveLivestreamPages();
      if (cancelled) return;
      if (pages.length === 0) return;

      const page = pages[0];
      const config = page.livestream_config!;
      const now = Date.now();
      const startTime = new Date(config.scheduled_start).getTime();
      const endTime = config.scheduled_end
        ? new Date(config.scheduled_end).getTime()
        : null;

      // Stream already ended — don't show
      if (endTime && now >= endTime) return;

      const register = () => {
        setActiveStream((prev) => {
          if (prev?.videoId === config.primary_video_id && prev?.slug === page.slug) return prev;
          return { videoId: config.primary_video_id, slug: page.slug };
        });
      };

      if (now >= startTime) {
        // Stream is live — register immediately
        register();
      } else {
        // Stream hasn't started — schedule auto-activation for when it begins
        const delay = startTime - now;
        startTimer = setTimeout(() => {
          if (!cancelled) register();
        }, delay);
      }
    }

    fetchActiveStream();

    return () => {
      cancelled = true;
      if (startTimer) clearTimeout(startTimer);
    };
  }, []);

  // Route-based visibility: show PiP when NOT on the stream page
  useEffect(() => {
    if (!activeStream || isDismissed) {
      setIsGlobalPipVisible(false);
      return;
    }

    const isOnStreamPage =
      pathname === '/' + activeStream.slug ||
      (!!activeStream.inlinePathname && pathname === activeStream.inlinePathname);
    const isOnHiddenRoute = PIP_HIDDEN_ROUTES.some((route) => pathname.startsWith(route));

    setIsGlobalPipVisible(!isOnStreamPage && !isOnHiddenRoute);
  }, [pathname, activeStream, isDismissed]);

  const registerStream = useCallback((stream: ActiveStream) => {
    setActiveStream((prev) => {
      // Only update if videoId, slug or inline route changed
      if (
        prev?.videoId === stream.videoId &&
        prev?.slug === stream.slug &&
        prev?.inlinePathname === stream.inlinePathname
      ) {
        return prev;
      }
      return stream;
    });
    setIsDismissed(false);
  }, []);

  const clearStream = useCallback(() => {
    setActiveStream(null);
    setIsDismissed(false);
  }, []);

  const dismissPip = useCallback(() => {
    setIsDismissed(true);
  }, []);

  return (
    <GlobalPipContext.Provider
      value={{ activeStream, isGlobalPipVisible, registerStream, clearStream, dismissPip }}
    >
      {children}
    </GlobalPipContext.Provider>
  );
}

export function useGlobalPip() {
  const context = useContext(GlobalPipContext);
  if (!context) {
    throw new Error('useGlobalPip must be used within a GlobalPipProvider');
  }
  return context;
}
