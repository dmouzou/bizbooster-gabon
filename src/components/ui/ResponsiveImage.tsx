import React, { useState } from 'react';

const FALLBACK_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 250' width='400' height='250'%3E%3Crect width='100%25' height='100%25' fill='%23DCE3EA'/%3E%3Cpath d='M180 110l20 25 15-18 25 33h-80z' fill='%2394A3B8'/%3E%3Ccircle cx='185' cy='95' r='8' fill='%2394A3B8'/%3E%3C/svg%3E";

export interface ResponsiveImageProps {
  src?: string;
  thumbUrl?: string;
  mediumUrl?: string;
  dominantColor?: string;
  alt: string;
  className?: string;
  aspectRatio?: string;
  isPriority?: boolean;
  size?: 'thumb' | 'medium' | 'full';
  onClick?: (e: React.MouseEvent) => void;
}

export const ResponsiveImage: React.FC<ResponsiveImageProps> = ({
  src,
  thumbUrl,
  mediumUrl,
  dominantColor = '#DCE3EA',
  alt,
  className = '',
  aspectRatio = '16/10',
  isPriority = false,
  size = 'thumb',
  onClick,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Resolution selection: honor navigator.connection.saveData (Low data mode: thumbUrl everywhere)
  const isSaveData = typeof navigator !== 'undefined' && Boolean((navigator as any).connection?.saveData);

  let resolvedSrc = FALLBACK_SVG;
  if (!hasError) {
    if (isSaveData && thumbUrl) {
      resolvedSrc = thumbUrl;
    } else if (size === 'thumb' && thumbUrl) {
      resolvedSrc = thumbUrl;
    } else if (size === 'medium' && mediumUrl) {
      resolvedSrc = mediumUrl;
    } else if (src) {
      resolvedSrc = src;
    } else if (thumbUrl || mediumUrl) {
      resolvedSrc = (thumbUrl || mediumUrl)!;
    }
  }

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        aspectRatio,
        backgroundColor: dominantColor,
      }}
      onClick={onClick}
    >
      <img
        src={resolvedSrc}
        alt={alt}
        className={`w-full h-full object-contain transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        loading={isPriority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={isPriority ? 'high' : 'auto'}
        onLoad={() => setIsLoaded(true)}
        onError={() => {
          setHasError(true);
          setIsLoaded(true);
        }}
      />
    </div>
  );
};

