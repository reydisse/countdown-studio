import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { BgLayer }          from './BgLayer.jsx';
import { VideoLayer }       from './VideoLayer.jsx';
import { SlideshowLayer }   from './SlideshowLayer.jsx';
import { ImageLayer }       from './ImageLayer.jsx';
import { OverlayLayer }     from './OverlayLayer.jsx';
import { FlashLayer }       from './FlashLayer.jsx';
import { VignetteLayer }    from './VignetteLayer.jsx';
import { ScanlinesLayer }   from './ScanlinesLayer.jsx';
import { LogoLayer }        from './LogoLayer.jsx';
import { CountdownDisplay } from './CountdownDisplay.jsx';
import { SlideDots }        from './SlideDots.jsx';
import { ScrimLayer }       from './ScrimLayer.jsx';

// ── Background zoom wrapper ───────────────────────────────────────────────────
// Wraps only background layers (not timer/overlay/logo) so ZOOM_IN creates a
// dynamic shot on the image/video while the timer stays sharp and unscaled.
// Uses Web Animations API — no CSS @keyframes, no stylesheet timing race.
export function BgZoom({ children }) {
  const _zoomCount    = useSettingsStore(s => s._zoomCount);
  const _zoomScale    = useSettingsStore(s => s._zoomScale    ?? 1.8);
  const _zoomDuration = useSettingsStore(s => s._zoomDuration ?? 2000);

  const divRef    = useRef(null);
  const prevCount = useRef(0);
  const animRef   = useRef(null);

  useEffect(() => {
    if (_zoomCount === 0 || _zoomCount === prevCount.current) return;
    prevCount.current = _zoomCount;

    const el = divRef.current;
    if (!el) return;

    // Cancel any in-progress zoom before starting a new one
    animRef.current?.cancel();

    animRef.current = el.animate(
      [
        { transform: `scale(${_zoomScale})` },
        { transform: 'scale(1)' },
      ],
      {
        duration: _zoomDuration,
        easing:   'cubic-bezier(0.16, 1, 0.3, 1)',
        fill:     'both',
      }
    );

    return () => animRef.current?.cancel();
  }, [_zoomCount, _zoomScale, _zoomDuration]);

  return (
    <div ref={divRef} className="absolute inset-0" style={{ transformOrigin: 'center center' }}>
      {children}
    </div>
  );
}

export function PreviewCanvas({ slideshowRef, className = '' }) {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-lg select-none ${className}`}
      style={{ aspectRatio: '16/9', containerType: 'size' }}
    >
      {/* Background zoom — only these four layers scale on ZOOM_IN */}
      <BgZoom>
        <BgLayer />
        <VideoLayer />
        <SlideshowLayer ref={slideshowRef} />
        <ImageLayer />
      </BgZoom>

      {/* These layers are NOT affected by ZOOM_IN — timer stays sharp */}
      <OverlayLayer />
      <FlashLayer />
      <VignetteLayer />
      <ScanlinesLayer />
      <LogoLayer />
      <CountdownDisplay />
      <SlideDots />
      <ScrimLayer />
    </div>
  );
}
