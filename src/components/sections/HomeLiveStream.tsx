/**
 * Bloque de transmisión en vivo embebido en el home.
 *
 * Reutiliza la pila de livestream de las páginas /[slug] (player de YouTube,
 * countdown, chat, failover y PiP). Se muestra solo cuando existe una página
 * livestream activa; se controla desde el dashboard sin necesidad de deploy.
 */
'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { LiveStreamSkeleton } from '@/app/[slug]/components/livestream';
import type { MultimediaPage } from '@/services/multimedia-pages.service';
import { posthogUtils } from '@/lib/posthogClient';

const LiveStreamSection = dynamic(
  () => import('@/app/[slug]/components/livestream/LiveStreamSection'),
  { ssr: false, loading: () => <LiveStreamSkeleton /> },
);

interface HomeLiveStreamProps {
  page: MultimediaPage;
}

export default function HomeLiveStream({ page }: HomeLiveStreamProps) {
  const config = page.livestream_config;

  useEffect(() => {
    if (!config) return;
    const start = new Date(config.scheduled_start).getTime();
    posthogUtils.capture('home_livestream_shown', {
      page_slug: page.slug,
      video_id: config.primary_video_id,
      phase: Number.isNaN(start) || Date.now() >= start ? 'live' : 'pre-stream',
    });
  }, [config, page.slug]);

  if (!config) return null;

  const handleExpandClick = () => {
    posthogUtils.capture('home_livestream_expand_click', {
      page_slug: page.slug,
      video_id: config.primary_video_id,
    });
  };

  return (
    <section
      id="live"
      aria-label="Transmisión en vivo"
      className="w-full bg-white mt-6 md:mt-8 lg:mt-12"
    >
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8" style={{ maxWidth: '1440px' }}>
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">{page.title}</h2>
          <Link
            href={`/${page.slug}`}
            onClick={handleExpandClick}
            className="text-sm font-medium text-gray-700 underline underline-offset-4 hover:text-black whitespace-nowrap"
          >
            Ver en pantalla completa
          </Link>
        </div>

        <LiveStreamSection config={config} slug={page.slug} inlinePathname="/" />
      </div>
    </section>
  );
}
