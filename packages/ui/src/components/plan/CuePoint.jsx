import { useState } from 'react';
import { useTimerStore } from '../../stores/timerStore.js';

const TYPE_META = {
  SWAP_BG:       { pill: 'border-accent/50 bg-accent/15 text-accent',                       icon: '◈', label: 'Swap BG'    },
  SWAP_LOGO:     { pill: 'border-accent/50 bg-accent/15 text-accent',                       icon: '⌘', label: 'Swap Logo'  },
  PLAY_AUDIO:    { pill: 'border-status-live/50 bg-status-live/15 text-status-live',        icon: '♫', label: 'Audio'      },
  SET_LABEL:     { pill: 'border-status-info/50 bg-status-info/15 text-status-info',        icon: 'T', label: 'Label'      },
  SET_OVERLAY:   { pill: 'border-status-info/50 bg-status-info/15 text-status-info',        icon: '◻', label: 'Overlay'    },
  TOGGLE_EFFECT: { pill: 'border-purple-400/50 bg-purple-400/15 text-purple-400',           icon: '✦', label: 'Effect'     },
  FLASH_SCREEN:  { pill: 'border-status-danger/50 bg-status-danger/15 text-status-danger',  icon: '⚡', label: 'Flash'     },
};
const FALLBACK       = { pill: 'border-border-default bg-surface-elevated text-text-secondary', icon: '●', label: 'Cue' };
const DRAG_THRESHOLD = 4; // px — below this = treat as click, not drag

function fmt(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

export function CuePoint({ cue, pxPerSec, onEdit, onDelete, onCommitMove }) {
  const total = useTimerStore(s => s.total);
  const meta  = TYPE_META[cue.actions?.[0]?.type] ?? FALLBACK;

  const [liveTriggerAt, setLiveTriggerAt] = useState(null);
  const [isDragging,    setIsDragging]    = useState(false);

  const displayAt = liveTriggerAt ?? cue.trigger_at;
  const leftPx    = total > 0 ? (total - displayAt) * pxPerSec : 0;

  const handlePointerDown = (e) => {
    e.stopPropagation();
    // No setPointerCapture — that routes events AWAY from the window listeners
    // and causes the pill to stick. Use local variables instead of state so
    // onUp reads the correct live values (no stale-closure issue).

    let moved         = false;
    let latestTrigger = cue.trigger_at;
    const startX      = e.clientX;
    const startAt     = cue.trigger_at;

    function onMove(ev) {
      const dx = ev.clientX - startX;
      if (Math.abs(dx) >= DRAG_THRESHOLD) {
        moved = true;
        const delta   = Math.round(-dx / pxPerSec);
        latestTrigger = Math.max(0, Math.min(total, startAt + delta));
        setIsDragging(true);
        setLiveTriggerAt(latestTrigger);
      }
    }

    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup',   onUp);
      setIsDragging(false);
      setLiveTriggerAt(null);

      if (moved && latestTrigger !== startAt) {
        onCommitMove(cue.id, latestTrigger);
      } else if (!moved) {
        onEdit(cue);
      }
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup',   onUp);
  };

  return (
    <div
      className="absolute top-1/2 -translate-y-1/2 group"
      style={{ left: leftPx, transform: 'translateX(-50%) translateY(-50%)', zIndex: 5 }}
    >
      {/* Tooltip */}
      <div className="
        absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2
        bg-surface-overlay border border-border-default text-text-primary
        text-[11px] px-2 py-1 rounded whitespace-nowrap pointer-events-none
        opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg
      ">
        <span className="font-semibold">{cue.label}</span>
        <span className="text-text-muted ml-1.5">@ {fmt(cue.trigger_at)}</span>
        {cue.actions?.length > 1 && (
          <span className="text-text-muted ml-1">+{cue.actions.length - 1} more</span>
        )}
        <span className="text-text-disabled ml-2 text-[10px]">drag · click to edit</span>
      </div>

      {/* Pill */}
      <div className="relative">
        <div
          onPointerDown={handlePointerDown}
          className={`
            flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium
            select-none whitespace-nowrap shadow-sm transition-all
            ${isDragging ? 'cursor-grabbing scale-110 shadow-lg opacity-80' : 'cursor-grab hover:scale-105'}
            ${meta.pill}
          `}
        >
          <span className="text-[10px]">{meta.icon}</span>
          <span className="max-w-[72px] truncate">{cue.label}</span>
        </div>

        {/* Quick-delete badge — always reachable, blocks pointer from starting a drag */}
        <button
          type="button"
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onDelete(cue.id); }}
          title="Delete cue"
          className="
            absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full
            bg-status-danger text-white leading-none
            flex items-center justify-center text-[9px]
            opacity-0 group-hover:opacity-100 transition-opacity
            hover:scale-110 z-10 cursor-pointer
          "
        >
          ✕
        </button>
      </div>

      {/* Stem */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 w-px h-3 bg-current opacity-40 pointer-events-none" />
    </div>
  );
}
