'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PipPlayerWrapperProps {
  isPip: boolean;
  onDismiss: () => void;
  onRestore: () => void;
  children: React.ReactNode;
}

export default function PipPlayerWrapper({
  isPip,
  onDismiss,
  onRestore,
  children,
}: PipPlayerWrapperProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const constraintsRef = useRef({ top: 0, left: 0, right: 0, bottom: 0 });

  // Recalculate drag constraints on resize
  useEffect(() => {
    const update = () => {
      const w = typeof window !== 'undefined' ? window.innerWidth : 0;
      const h = typeof window !== 'undefined' ? window.innerHeight : 0;
      // Desktop: 384x216, Mobile: 280x158
      const pipW = w >= 768 ? 384 : 280;
      const pipH = w >= 768 ? 216 : 158;
      constraintsRef.current = {
        top: -(h - pipH - 24),
        left: -(w - pipW - 24),
        right: 0,
        bottom: 0,
      };
    };

    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Inline mode: render children directly
  if (!isPip) {
    return <>{children}</>;
  }

  // PiP mode: placeholder del mismo tamaño en el flujo (evita saltos de
  // layout) + reproductor flotante con drag
  return (
    <>
      <div
        className="w-full aspect-video rounded-lg bg-gray-900 flex flex-col items-center justify-center gap-3 text-white"
        aria-hidden="true"
      >
        <span className="text-sm text-white/70">Reproduciendo en el mini-player</span>
        <button
          type="button"
          onClick={onRestore}
          className="text-sm font-medium bg-white/10 hover:bg-white/20 rounded-full px-4 py-1.5 transition-colors"
        >
          Volver al video
        </button>
      </div>
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        drag
        dragConstraints={constraintsRef.current}
        dragElastic={0.1}
        dragMomentum={false}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={() => setIsDragging(false)}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
        onTouchStart={() => setShowControls(true)}
        className="fixed bottom-6 right-6 w-[280px] h-[158px] md:w-[384px] md:h-[216px] rounded-xl overflow-hidden shadow-2xl cursor-grab active:cursor-grabbing"
        style={{ zIndex: 50000 }}
      >
        {/* Player content - disable pointer events during drag */}
        <div
          className="w-full h-full"
          style={{ pointerEvents: isDragging ? 'none' : 'auto' }}
        >
          {children}
        </div>

        {/* Controls overlay */}
        <div
          className={`absolute inset-0 transition-opacity duration-200 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ pointerEvents: showControls ? 'auto' : 'none' }}
        >
          {/* Top bar */}
          <div className="absolute top-0 inset-x-0 flex items-center justify-between px-2 py-1.5 bg-gradient-to-b from-black/60 to-transparent">
            {/* Close button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              className="flex items-center justify-center w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
              aria-label="Cerrar mini-player"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M11 3L3 11M3 3l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            {/* Expand button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRestore();
              }}
              className="flex items-center justify-center w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
              aria-label="Expandir video"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 5V1h4M13 9v4H9M1 1l4.5 4.5M13 13L8.5 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* Bottom: mini live indicator */}
          <div className="absolute bottom-2 left-2">
            <span className="flex items-center gap-1 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
              </span>
              EN VIVO
            </span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
    </>
  );
}
