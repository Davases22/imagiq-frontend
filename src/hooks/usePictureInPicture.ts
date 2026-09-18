'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/** Fracción visible del video por debajo de la cual se pasa a mini-player. */
const PIP_ENTER_RATIO = 0.1;
/** Fracción visible del video a partir de la cual se vuelve al modo inline. */
const PIP_EXIT_RATIO = 0.5;

interface UsePictureInPictureOptions {
  enabled: boolean;
}

interface UsePictureInPictureReturn {
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  isPip: boolean;
  isDismissed: boolean;
  dismiss: () => void;
  restore: () => void;
}

export function usePictureInPicture({
  enabled,
}: UsePictureInPictureOptions): UsePictureInPictureReturn {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [isIntersecting, setIsIntersecting] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  // IntersectionObserver sobre el contenedor del video (que conserva su
  // tamaño también en modo PiP). Con histéresis para que no parpadee:
  // - pasa a PiP solo cuando queda visible menos del 10% del video
  //   (es decir, tras hacer bastante scroll), y
  // - vuelve al modo inline cuando reaparece al menos la mitad.
  useEffect(() => {
    if (!enabled) return;

    const element = sentinelRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const ratio = entry.isIntersecting ? entry.intersectionRatio : 0;

        if (ratio <= PIP_ENTER_RATIO) {
          setIsIntersecting(false);
        } else if (ratio >= PIP_EXIT_RATIO) {
          setIsIntersecting(true);
          // Reset dismiss when video comes back into view
          setIsDismissed(false);
        }
      },
      { threshold: [0, PIP_ENTER_RATIO, PIP_EXIT_RATIO, 1] },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled]);

  const isPip = enabled && !isIntersecting && !isDismissed;

  const dismiss = useCallback(() => {
    setIsDismissed(true);
  }, []);

  const restore = useCallback(() => {
    const element = sentinelRef.current;
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  return {
    sentinelRef,
    isPip,
    isDismissed,
    dismiss,
    restore,
  };
}
