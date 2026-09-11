"use client";

import { X } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import type { CampaignData } from "./types";
import {
  trackInWebNotificationShown,
  trackInWebNotificationClicked,
  storeInWebCampaignRedirect,
  trackInWebCampaignRedirect,
} from "@/lib/posthogClient";
import { useAuthContext } from "@/features/auth/context";
import { normalizeCampaignUrl } from "@/lib/campaignUrl";

interface InWebCampaignDisplayProps {
  campaign: CampaignData | null;
  onClose: () => void;
}

// Componente para el contenido (imagen o HTML)
function CampaignContent({
  campaign,
  onClick,
}: {
  campaign: CampaignData;
  onClick: () => void;
}) {
  const hasLink = !!campaign.content_url;
  return (
    <div
      className={`w-full max-w-full ${hasLink ? "cursor-pointer" : ""}`}
      onClick={onClick}
      role={hasLink ? "button" : undefined}
      tabIndex={hasLink ? 0 : undefined}
    >
      {campaign.content_type === "html" && campaign.html_content ? (
        <div
          className="rounded-lg overflow-hidden [&>*]:max-w-full [&_img]:max-w-full [&_img]:h-auto"
          dangerouslySetInnerHTML={{ __html: campaign.html_content }}
        />
      ) : campaign.image_url ? (
        <img
          src={campaign.image_url} 
          alt={campaign.campaign_name || "Campaña"}
          className="w-full h-auto object-contain"
        />
      ) : null}
    </div>
  );
}

// Componente Modal (Popup)
function ModalDisplay({
  campaign,
  onClose,
  onClick,
}: {
  campaign: CampaignData;
  onClose: () => void;
  onClick: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/30" />

      <div
        className="relative z-10 max-w-md w-full animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 rounded-full p-2 hover:bg-white/10 transition-colors border-2 border-white/50 hover:border-white"
          aria-label="Cerrar"
        >
          <X className="h-6 w-6 text-white" />
        </button>

        <div className="rounded-lg overflow-hidden shadow-2xl">
          <CampaignContent campaign={campaign} onClick={onClick} />
        </div>
      </div>
    </div>
  );
}

// Componente Slider (Toast)
function SliderDisplay({
  campaign,
  onClose,
  onClick,
}: {
  campaign: CampaignData;
  onClose: () => void;
  onClick: () => void;
}) {
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'up' | 'left' | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef<number | null>(null);
  const SWIPE_THRESHOLD = 50; // Minimum distance in pixels to trigger swipe
  const VELOCITY_THRESHOLD = 0.3; // Minimum velocity (px/ms) to trigger swipe
  const DIRECTION_THRESHOLD = 20; // Minimum movement to determine direction

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
    setIsDragging(true);
    setSwipeDirection(null);
    setTranslateX(0);
    setTranslateY(0);
    // Prevent default to stop any potential scrolling when starting to interact with slider
    e.stopPropagation();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - touchStartX.current;
    const deltaY = currentY - touchStartY.current;

    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // CRITICAL: Check for ANY upward movement (even 1px) FIRST
    // This prevents ANY X-axis movement when there's upward component
    if (deltaY < 0) {
      // Any upward movement detected - immediately lock X to 0
      if (swipeDirection !== 'up') {
        setSwipeDirection('up');
      }
      setTranslateX(0); // ALWAYS lock X to 0 when moving up
      setTranslateY(deltaY);
      e.preventDefault();
      e.stopPropagation();
      return; // Exit early to prevent any other logic from running
    }

    // Only process left swipe if there's NO upward movement
    if (deltaX < 0 && absDeltaX > DIRECTION_THRESHOLD && absDeltaX > absDeltaY * 1.2) {
      if (!swipeDirection || swipeDirection !== 'left') {
        setSwipeDirection('left');
      }
      setTranslateY(0);
      setTranslateX(deltaX);
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // If direction is already 'left', continue left swipe
    if (swipeDirection === 'left' && deltaX < 0) {
      setTranslateX(deltaX);
      setTranslateY(0);
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchStartY.current === null || touchStartTime.current === null) {
      setIsDragging(false);
      setSwipeDirection(null);
      return;
    }

    const deltaX = translateX;
    const deltaY = translateY;
    const deltaTime = Date.now() - touchStartTime.current;
    const velocityX = Math.abs(deltaX) / deltaTime;
    const velocityY = Math.abs(deltaY) / deltaTime;

    // Determine which direction to close based on the swipe direction
    const shouldCloseUp = swipeDirection === 'up' && (deltaY < -SWIPE_THRESHOLD || (deltaY < 0 && velocityY > VELOCITY_THRESHOLD));
    const shouldCloseLeft = swipeDirection === 'left' && (deltaX < -SWIPE_THRESHOLD || (deltaX < 0 && velocityX > VELOCITY_THRESHOLD));

    if (shouldCloseUp) {
      // Animate straight up
      setTranslateY(-window.innerHeight);
      setTranslateX(0);
      setTimeout(() => {
        onClose();
      }, 200);
    } else if (shouldCloseLeft) {
      // Animate straight left
      setTranslateX(-window.innerWidth);
      setTranslateY(0);
      setTimeout(() => {
        onClose();
      }, 200);
    } else {
      // Snap back to original position
      setTranslateX(0);
      setTranslateY(0);
    }

    // Reset
    touchStartX.current = null;
    touchStartY.current = null;
    touchStartTime.current = null;
    setIsDragging(false);
    setSwipeDirection(null);
  };

  // Apply transform when dragging or dismissing
  // ALWAYS force translateX to 0 if there's ANY upward movement OR if direction is 'up'
  const finalTranslateX = (swipeDirection === 'up' || translateY < 0) ? 0 : translateX;
  const hasTransform = finalTranslateX !== 0 || translateY !== 0;
  const transformStyle = hasTransform
    ? { transform: `translate(calc(-50% + ${finalTranslateX}px), ${translateY}px)` }
    : undefined;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slideDownVertical {
          from {
            transform: translate(-50%, -100%);
            opacity: 0;
          }
          to {
            transform: translate(-50%, 0);
            opacity: 1;
          }
        }
      `}} />
      <div 
        className="fixed top-24 md:top-32 left-1/2 z-[999999] w-[calc(100%-1rem)] max-w-md md:w-[calc(100%-2rem)] md:max-w-lg"
        style={{
          transform: transformStyle?.transform || undefined,
          transition: hasTransform ? 'transform 0.2s ease-out' : undefined,
          animation: !hasTransform ? 'slideDownVertical 0.5s ease-out forwards' : undefined,
          touchAction: isDragging ? 'none' : 'pan-y', // Prevent scrolling when dragging
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
      <div className="relative z-10 w-full max-w-full">
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 rounded-full p-2 hover:bg-white/10 transition-colors z-20 cursor-pointer"
          aria-label="Cerrar"
        >
          <div className="relative">
            <X 
              className="h-6 w-6 absolute" 
              stroke="black"
              strokeWidth={5}
              style={{ 
                strokeLinecap: 'round',
                strokeLinejoin: 'round'
              }}
            />
            <X 
              className="h-6 w-6 relative text-white" 
              stroke="white"
              strokeWidth={2}
              style={{ 
                strokeLinecap: 'round',
                strokeLinejoin: 'round'
              }}
            />
          </div>
        </button>

        <div className="rounded-lg overflow-hidden shadow-lg max-h-40 animate-in zoom-in-95 duration-300 w-full">
          <CampaignContent campaign={campaign} onClick={onClick} />
        </div>
      </div>
    </div>
    </>
  );
}

export function InWebCampaignDisplay({
  campaign,
  onClose,
}: InWebCampaignDisplayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const { user } = useAuthContext();

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const handleContentClick = () => {
    if (!campaign) return;
    
    // Track click event
    trackInWebNotificationClicked(campaign, user?.id);
    
    // Normalizar SIEMPRE: una URL guardada sin "/" inicial ("productos/…") se
    // resolvería relativa a la página actual → /productos/productos/… → 404.
    const destination = normalizeCampaignUrl(campaign.content_url);
    if (destination) {
      // Store redirect info for cross-page tracking before opening new tab
      storeInWebCampaignRedirect(campaign, user?.id);

      // Track redirect event
      trackInWebCampaignRedirect(campaign, user?.id);

      // Open the destination URL
      window.open(destination, "_blank");
    }
  };

  useEffect(() => {
    if (campaign) {
      setIsVisible(true);
      // Track shown event when campaign becomes visible
      trackInWebNotificationShown(campaign, user?.id);

      if (campaign.ttl && campaign.ttl > 0) {
        const timer = setTimeout(() => {
          setIsVisible(false);
          setTimeout(onClose, 300);
        }, campaign.ttl * 1000); //tiempo que se va mostrar el model/slider
        return () => clearTimeout(timer);
      }
    }
  }, [campaign, onClose, user?.id]);

  if (!campaign || !isVisible) return null;

  const hasContent =
    (campaign.content_type === "html" && campaign.html_content) ||
    campaign.image_url;

  if (!hasContent) return null;

  const isModal = campaign.display_style === "modal";
  //pop-up o slider 
  return isModal ? (
    <ModalDisplay
      campaign={campaign}
      onClose={handleClose}
      onClick={handleContentClick}
    />
  ) : (
    <SliderDisplay
      campaign={campaign}
      onClose={handleClose}
      onClick={handleContentClick}
    />
  );
}
