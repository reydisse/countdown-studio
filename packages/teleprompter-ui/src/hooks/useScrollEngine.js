import { useEffect, useRef } from 'react';
import { usePrompterStore } from '../store/prompterStore.js';

const SNAP_THRESHOLD_PX = 150;
const LERP_FACTOR       = 0.18;

// Reads scrollPosition from the store on every animation frame and lerps
// the container's scrollTop toward it. Avoids zustand subscribe selector
// issues across versions — getState() is always safe.
export function useScrollEngine(containerRef) {
  const rafRef = useRef(null);

  useEffect(() => {
    function loop() {
      const el = containerRef.current;
      if (el) {
        const target  = usePrompterStore.getState().scrollPosition;
        const current = el.scrollTop;
        const delta   = target - current;

        if (Math.abs(delta) > SNAP_THRESHOLD_PX) {
          el.scrollTop = target;
        } else if (Math.abs(delta) > 0.5) {
          el.scrollTop = current + delta * LERP_FACTOR;
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [containerRef]);
}
