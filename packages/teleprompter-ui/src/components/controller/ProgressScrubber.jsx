import { useCallback, useEffect, useRef } from 'react';
import { usePrompterStore } from '../../store/prompterStore.js';

// px per server tick (50ms) — must match RoomPrompter SPEED_PX map
const SPEED_PX       = { 1:1, 2:2, 3:3, 4:4, 5:5, 6:7, 7:9, 8:11, 9:13, 10:15 };
const SERVER_TICK_MS = 50;
const NUDGE_SECONDS  = 5;

// Press-and-hold continuous scrub
const HOLD_DELAY_MS     = 250;  // hold this long before a tap becomes a continuous scrub
const HOLD_INTERVAL_MS  = 50;   // scrub step rate (matches server tick rate)
const SCRUB_PX_PER_SEC  = 500;  // continuous scrub speed, independent of playback speed

export function ProgressScrubber() {
  const { scrollPosition, totalHeight, speed, seekTo } = usePrompterStore();
  const trackRef = useRef(null);

  // one hold-state per nudge button (left/back, right/forward)
  const holdStates = useRef({ '-1': {}, '1': {} });

  useEffect(() => {
    const states = holdStates.current;
    return () => {
      for (const s of Object.values(states)) {
        clearTimeout(s.delayTimer);
        clearInterval(s.interval);
        if (s.release) {
          window.removeEventListener('mouseup', s.release);
          window.removeEventListener('touchend', s.release);
          window.removeEventListener('touchcancel', s.release);
        }
      }
    };
  }, []);

  const fraction = totalHeight > 0 ? Math.max(0, Math.min(1, scrollPosition / totalHeight)) : 0;

  const seekFromClientX = useCallback((clientX) => {
    if (!totalHeight) return;
    const rect = trackRef.current.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    seekTo(Math.round(frac * totalHeight));
  }, [totalHeight, seekTo]);

  const handlePointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    seekFromClientX(e.clientX);
  };
  const handlePointerMove = (e) => {
    if (e.buttons !== 1) return;
    seekFromClientX(e.clientX);
  };

  function nudge(seconds) {
    const pxPerSec = (SPEED_PX[speed] ?? 3) * (1000 / SERVER_TICK_MS);
    const { scrollPosition: pos, totalHeight: total } = usePrompterStore.getState();
    const target = Math.max(0, Math.min(total || Infinity, pos + seconds * pxPerSec));
    seekTo(Math.round(target));
  }

  // Tap → ±NUDGE_SECONDS jump. Hold → smooth continuous scrub until released.
  function startHold(direction) {
    const s = holdStates.current[direction];
    if (s.delayTimer || s.interval) return; // already held
    s.scrubbing = false;
    s.delayTimer = setTimeout(() => {
      s.scrubbing = true;
      s.pos = usePrompterStore.getState().scrollPosition;
      const step = direction * SCRUB_PX_PER_SEC * (HOLD_INTERVAL_MS / 1000);
      s.interval = setInterval(() => {
        const { totalHeight: total, seekTo: seek } = usePrompterStore.getState();
        const max = total > 0 ? total : Infinity;
        s.pos = Math.max(0, Math.min(max, s.pos + step));
        usePrompterStore.setState({ scrollPosition: s.pos });
        seek(Math.round(s.pos));
      }, HOLD_INTERVAL_MS);
    }, HOLD_DELAY_MS);

    const release = () => endHold(direction);
    s.release = release;
    window.addEventListener('mouseup', release);
    window.addEventListener('touchend', release);
    window.addEventListener('touchcancel', release);
  }

  function endHold(direction) {
    const s = holdStates.current[direction];
    clearTimeout(s.delayTimer);
    s.delayTimer = null;
    if (s.interval) {
      clearInterval(s.interval);
      s.interval = null;
    }
    if (s.release) {
      window.removeEventListener('mouseup', s.release);
      window.removeEventListener('touchend', s.release);
      window.removeEventListener('touchcancel', s.release);
      s.release = null;
    }
    if (!s.scrubbing) {
      nudge(direction * NUDGE_SECONDS);
    }
    s.scrubbing = false;
  }

  return (
    <div className="flex flex-col gap-2 p-3 bg-surface-elevated rounded-lg border border-border-subtle">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">Position</span>
        <span className="text-xs font-mono text-text-secondary">{Math.round(fraction * 100)}%</span>
      </div>

      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        className="relative h-2.5 rounded-full bg-surface-base border border-border-default cursor-pointer"
        style={{ touchAction: 'none' }}
        title="Drag to scrub the script"
      >
        <div className="absolute inset-y-0 left-0 rounded-full bg-accent/50 pointer-events-none" style={{ width: `${fraction * 100}%` }} />
        <div
          className="absolute top-1/2 w-3 h-3 -mt-1.5 rounded-full bg-accent border border-black/20 pointer-events-none"
          style={{ left: `calc(${fraction * 100}% - 6px)` }}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          onMouseDown={() => startHold(-1)}
          onTouchStart={(e) => { e.preventDefault(); startHold(-1); }}
          disabled={!totalHeight}
          style={{ touchAction: 'none' }}
          className="flex-1 py-1.5 rounded text-xs font-medium bg-surface-base border border-border-default text-text-secondary hover:text-text-primary hover:border-accent disabled:opacity-40 transition-colors select-none">
          ◀ {NUDGE_SECONDS}s
        </button>
        <button onClick={() => seekTo(0)} disabled={!totalHeight}
          className="flex-1 py-1.5 rounded text-xs font-medium bg-surface-base border border-border-default text-text-secondary hover:text-text-primary hover:border-accent disabled:opacity-40 transition-colors">
          Start
        </button>
        <button
          onMouseDown={() => startHold(1)}
          onTouchStart={(e) => { e.preventDefault(); startHold(1); }}
          disabled={!totalHeight}
          style={{ touchAction: 'none' }}
          className="flex-1 py-1.5 rounded text-xs font-medium bg-surface-base border border-border-default text-text-secondary hover:text-text-primary hover:border-accent disabled:opacity-40 transition-colors select-none">
          {NUDGE_SECONDS}s ▶
        </button>
      </div>
    </div>
  );
}
