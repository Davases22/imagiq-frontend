'use client';

import { useEffect } from 'react';
import type { LivestreamConfig } from '@/services/multimedia-pages.service';
import { useLivestreamState } from '@/hooks/useLivestreamState';
import { useLivestreamFailover } from '@/hooks/useLivestreamFailover';
import { usePictureInPicture } from '@/hooks/usePictureInPicture';
import { useGlobalPip } from '@/contexts/GlobalPipContext';
import LiveStreamPlayer from './LiveStreamPlayer';
import CountdownOverlay from './CountdownOverlay';
import LiveBadge from './LiveBadge';
import LiveChat from './LiveChat';
import FailoverOverlay from './FailoverOverlay';
import PipPlayerWrapper from './PipPlayerWrapper';

interface LiveStreamSectionProps {
  config: LivestreamConfig;
  slug: string;
  /** Ruta donde esta sección se renderiza inline fuera de /[slug] (ej. "/" en el home) */
  inlinePathname?: string;
}

function PreStreamPlaceholder() {
  return (
    <div className="w-full bg-white border-t border-gray-100">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10" style={{ maxWidth: '960px' }}>
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Comentarios</h3>
          <span className="text-xs text-gray-400">0</span>
        </div>

        {/* Empty state */}
        <div className="flex flex-col items-center py-8 md:py-12">
          <svg className="w-8 h-8 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
          </svg>
          <p className="text-sm text-gray-400">
            Se el primero en comentar durante la transmision
          </p>
        </div>

        {/* Disabled input */}
        <div className="flex items-center gap-3 opacity-50">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0" />
          <div className="flex-1 h-10 rounded-full border border-gray-200 bg-gray-50 flex items-center px-4">
            <span className="text-sm text-gray-400">Escribe un comentario...</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LiveStreamSection({ config, slug, inlinePathname }: LiveStreamSectionProps) {
  const streamState = useLivestreamState(config);
  const failover = useLivestreamFailover(config, streamState);
  const pip = usePictureInPicture({ enabled: config.enable_pip && streamState.phase === 'live' });
  const { registerStream } = useGlobalPip();

  const { phase, activeVideoId, timeUntilStart } = streamState;

  // Register stream in global context for cross-page PiP
  useEffect(() => {
    if (phase === 'live' && config.enable_pip) {
      registerStream({ videoId: activeVideoId, slug, inlinePathname });
    }
  }, [phase, config.enable_pip, activeVideoId, slug, inlinePathname, registerStream]);
  const { isFailingOver, handlePlayerError, handlePlayerStateChange } = failover;

  const showChat = config.enable_chat && phase === 'live';
  const chatRight = config.chat_position === 'right';

  // Pre-stream: countdown facade (no iframe) + placeholder
  if (phase === 'pre-stream' && config.enable_countdown && timeUntilStart !== null) {
    return (
      <section className="w-full">
        <CountdownOverlay
          timeUntilStart={timeUntilStart}
          title={config.countdown_title}
          subtitle={config.countdown_subtitle}
          thumbnailUrl={config.thumbnail_url}
          videoId={config.primary_video_id}
          ctaText={config.countdown_cta_text}
          ctaUrl={config.countdown_cta_url}
        />
        <PreStreamPlaceholder />
      </section>
    );
  }

  // Error state
  if (phase === 'error') {
    return (
      <section className="w-full">
        <div className="w-full aspect-video bg-gray-900 flex items-center justify-center text-white">
          <div className="text-center">
            <p className="text-lg font-medium mb-2">La transmision no esta disponible</p>
            <p className="text-sm text-white/60">Intentalo de nuevo mas tarde</p>
          </div>
        </div>
      </section>
    );
  }

  // Live or post-stream: show player
  const showReplay = phase === 'post-stream' && config.enable_replay;
  const showPlayer = phase === 'live' || showReplay;

  if (!showPlayer) {
    return null;
  }

  return (
    <section className="w-full">
      {/* Sentinel: marks inline video position for IntersectionObserver */}
      <div ref={pip.sentinelRef} />

      <div
        className={
          showChat && chatRight
            ? 'grid grid-cols-1 md:grid-cols-[1fr_350px] gap-4'
            : 'flex flex-col gap-4'
        }
      >
        {/* Video container with PiP wrapper */}
        <PipPlayerWrapper
          isPip={pip.isPip}
          onDismiss={pip.dismiss}
          onRestore={pip.restore}
        >
          <div className="relative">
            <LiveStreamPlayer
              videoId={activeVideoId}
              autoplay={config.autoplay}
              onError={handlePlayerError}
              onStateChange={handlePlayerStateChange}
            />

            {/* Live badge */}
            {config.enable_live_badge && <LiveBadge isLive={phase === 'live'} />}

            {/* Failover overlay */}
            <FailoverOverlay
              message={config.failover_message || 'Cambiando transmision...'}
              isVisible={isFailingOver}
            />
          </div>
        </PipPlayerWrapper>

        {/* Chat: hidden when PiP is active */}
        {showChat && !pip.isPip && (
          <LiveChat videoId={activeVideoId} isLive={phase === 'live'} />
        )}
      </div>
    </section>
  );
}
