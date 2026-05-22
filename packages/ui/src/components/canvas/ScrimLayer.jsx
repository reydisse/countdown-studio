import { useEffect, useState } from 'react';
import { useSettingsStore } from '../../stores/settingsStore.js';

// Black-out overlay driven by cue actions (FADE_TO_BLACK, FADE_FROM_BLACK, CUT_*).
// Uses local state + useEffect so the CSS transition triggers correctly even when
// the target opacity is set synchronously by a cue action.
export function ScrimLayer() {
  const targetOpacity = useSettingsStore(s => s._scrimOpacity);
  const scrimColor    = useSettingsStore(s => s._scrimColor    ?? '#000000');
  const scrimMs       = useSettingsStore(s => s._scrimTransition ?? 0);

  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    if (scrimMs === 0) {
      // Instant — no animation needed
      setOpacity(targetOpacity);
    } else {
      // One-frame delay lets the browser commit the current opacity before
      // we change it, so the CSS transition actually fires.
      const id = requestAnimationFrame(() => setOpacity(targetOpacity));
      return () => cancelAnimationFrame(id);
    }
  }, [targetOpacity, scrimMs]);

  // Only mount the DOM node when needed
  if (opacity === 0 && targetOpacity === 0) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background:  scrimColor,
        opacity,
        transition:  scrimMs > 0 ? `opacity ${scrimMs}ms ease-in-out` : 'none',
        zIndex:      15,
      }}
    />
  );
}
