import { useEffect, useRef } from 'react';
import { usePrompterStore } from '../store/prompterStore.js';

// px per server tick (50ms) — must match RoomPrompter SPEED_PX map
const SPEED_PX      = { 1:1, 2:2, 3:3, 4:4, 5:5, 6:7, 7:9, 8:11, 9:13, 10:15 };
const SERVER_TICK_MS = 50;
const SNAP_THRESHOLD = 200; // snap instead of lerp when this far off
const LERP_FACTOR    = 0.22;

export function useScrollEngine(containerRef) {
  const rafRef  = useRef(null);
  const lastRef = useRef(performance.now());

  useEffect(() => {
    function loop() {
      const now = performance.now();
      const dt  = now - lastRef.current;
      lastRef.current = now;

      const el = containerRef.current;
      if (el) {
        const { scrollPosition, isPlaying, speed } = usePrompterStore.getState();

        if (isPlaying) {
          // Advance locally at 60fps — same rate as the server tick
          const pxPerMs   = (SPEED_PX[speed] ?? 3) / SERVER_TICK_MS;
          const localNext = el.scrollTop + pxPerMs * dt;
          const drift     = scrollPosition - localNext;

          if (Math.abs(drift) > SNAP_THRESHOLD) {
            // Big drift (seek, resume after pause) — snap to server
            el.scrollTop = scrollPosition;
          } else {
            // Smooth local advance, gently blend toward server position
            el.scrollTop = localNext + drift * 0.05;
          }
        } else {
          // Paused / stopped — follow server position for seeks
          const delta = scrollPosition - el.scrollTop;
          if (Math.abs(delta) > SNAP_THRESHOLD) {
            el.scrollTop = scrollPosition;
          } else if (Math.abs(delta) > 0.5) {
            el.scrollTop = el.scrollTop + delta * LERP_FACTOR;
          }
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [containerRef]);
}
