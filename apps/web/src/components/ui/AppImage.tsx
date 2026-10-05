'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface AppImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  quality?: number;
  fill?: boolean;
  sizes?: string;
  onClick?: () => void;
  /** Shown when `src` fails to load. */
  fallbackSrc?: string;
}

/**
 * Wrapper around next/image adding a fallback on load failure.
 *
 * Remote hosts must be allow-listed in image-hosts.config.mjs. Anything not
 * listed there fails at runtime and falls back to the placeholder — which is
 * why the previous version bypassed next/image entirely for external URLs and
 * lost optimisation for every image on the site.
 */
/**
 * The `object-*` utilities out of the caller's className, for the <img>.
 *
 * In `fill` mode the caller's className goes on the wrapper div, where
 * object-fit and object-position mean nothing — and the image carried a
 * hardcoded `object-cover`. So every caller asking for anything else was
 * silently overridden: certificate badges asked for `object-contain` and were
 * cropped, and team photos asked for `object-top` so a portrait is anchored
 * at the head and were centred instead, cutting faces through the middle.
 *
 * It went unnoticed because the majority of callers ask for `object-cover`,
 * which is what they were being given regardless.
 *
 * Defaults to `object-cover` when the caller names no fit, so every existing
 * call site keeps the behaviour it has today.
 */
const OBJECT_FIT = /\bobject-(contain|cover|fill|none|scale-down)\b/;
const OBJECT_POSITION =
  /\bobject-(bottom|center|left-bottom|left-top|left|right-bottom|right-top|right|top)\b/;

function objectClasses(className: string): string {
  return [className.match(OBJECT_FIT)?.[0] ?? 'object-cover', className.match(OBJECT_POSITION)?.[0]]
    .filter(Boolean)
    .join(' ');
}

export default function AppImage({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  quality = 80,
  fill = false,
  sizes,
  onClick,
  fallbackSrc = '/assets/images/no_image.png',
}: AppImageProps) {
  const [failed, setFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Derived from the prop rather than copied into state. The previous version
  // seeded useState with `src`, which meant a component re-rendered with a
  // different image kept showing the first one — state initialisers run once.
  const imageSrc = failed ? fallbackSrc : src;

  // Reset when the image changes, so a new src is not judged by the last
  // one's outcome.
  useEffect(() => {
    setFailed(false);
    setIsLoading(true);
  }, [src]);

  const handleError = () => {
    setFailed(true);
    setIsLoading(false);
  };

  // The placeholder shows only while loading AND only on the client. A
  // server-rendered <img> ships with this class applied, and if the browser
  // has the image cached it can finish loading before React hydrates — the
  // onLoad handler then never fires and the picture pulses for ever. Gating
  // on mount means the markup starts settled and only animates for loads
  // that actually happen in front of the user.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const stateClasses = [
    mounted && isLoading ? 'bg-ts-surface-2 animate-pulse' : '',
    onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (fill) {
    return (
      <div
        className={`relative ${className}`}
        style={{ width: width ?? '100%', height: height ?? '100%' }}
      >
        <Image
          src={imageSrc}
          alt={alt}
          fill
          sizes={sizes ?? '100vw'}
          quality={quality}
          priority={priority}
          onError={handleError}
          onLoad={() => setIsLoading(false)}
          onClick={onClick}
          className={`absolute inset-0 w-full h-full ${objectClasses(className)} ${stateClasses}`}
        />
      </div>
    );
  }

  return (
    <Image
      src={imageSrc}
      alt={alt}
      width={width ?? 400}
      height={height ?? 300}
      sizes={sizes}
      quality={quality}
      priority={priority}
      onError={handleError}
      onLoad={() => setIsLoading(false)}
      onClick={onClick}
      className={`${className} ${stateClasses}`}
    />
  );
}
