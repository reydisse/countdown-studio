import { useCallback, useEffect, useRef, useState } from 'react';
import { useTimerStore }    from '../../stores/timerStore.js';
import { useCueStore }      from '../../stores/cueStore.js';
import { CuePoint }         from './CuePoint.jsx';

function fmt(secs) {
  if (secs <= 0) return '0:00';
  const h  = Math.floor(secs / 3600);
  const m  = Math.floor((secs % 3600) / 60);
  const s  = secs % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

function markerStep(total) {
  if (total <= 120)  return 10;
  if (total <= 600)  return 30;
  if (total <= 1800) return 60;
  return 300;
}

const RULER_H  = 28;  // px
const TRACK_H  = 72;  // px — cue pills live here

export function Timeline({ cues, onCueEdit, onCueDelete, onCueCreate, onCommitMove, className = 'border-t border-border-subtle' }) {
  const remaining = useTimerStore(s => s.remaining);
  const total     = useTimerStore(s => s.total);

  const scrubAt       = useCueStore(s => s.scrubAt);
  const scrubTo       = useCueStore(s => s.scrubTo);
  const endScrub      = useCueStore(s => s.endScrub);
  const playFromScrub = useCueStore(s => s.playFromScrub);

  const outerRef   = useRef(null);
  const [outerW, setOuterW] = useState(900);

  // Resize observer keeps outerW in sync
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setOuterW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Leaving plan mode always returns the preview to live state
  useEffect(() => () => useCueStore.getState().endScrub(), []);

  // Adaptive px/sec: always fill the outer width, max 24px/s
  const pxPerSec  = total > 0 ? Math.min(24, outerW / total) : 1;
  const innerW    = total > 0 ? Math.max(outerW, total * pxPerSec) : outerW;

  // Playhead position
  const elapsed      = total - remaining;
  const playheadLeft = total > 0 ? elapsed * pxPerSec : 0;

  // Ruler markers
  const step    = markerStep(total);
  const markers = [];
  if (total > 0) {
    for (let elap = 0; elap <= total; elap += step) {
      markers.push({ elap, rem: total - elap, x: elap * pxPerSec });
    }
  }

  // Pointer x → remaining-seconds at that position
  const remAtPointer = useCallback((clientX) => {
    const rect = outerRef.current.getBoundingClientRect();
    const x    = clientX - rect.left + outerRef.current.scrollLeft;
    return Math.max(0, Math.min(total, Math.round(total - x / pxPerSec)));
  }, [total, pxPerSec]);

  // Drag on the ruler → scrub the preview to that point in the plan
  const handleRulerDown = useCallback((e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    scrubTo(remAtPointer(e.clientX));
  }, [remAtPointer, scrubTo]);

  const handleRulerMove = useCallback((e) => {
    if (e.buttons !== 1) return;
    scrubTo(remAtPointer(e.clientX));
  }, [remAtPointer, scrubTo]);

  // Click on track background → create cue
  const handleTrackClick = useCallback((e) => {
    if (e.target !== e.currentTarget && !e.target.classList.contains('timeline-bg')) return;
    const rect = outerRef.current.getBoundingClientRect();
    const scrollLeft = outerRef.current.scrollLeft;
    const x   = e.clientX - rect.left + scrollLeft;
    const rem = Math.max(0, Math.min(total, Math.round(total - x / pxPerSec)));
    onCueCreate(rem);
  }, [total, pxPerSec, onCueCreate]);

  if (total === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted text-sm border-t border-border-subtle">
        Set a timer duration to enable the cue timeline.
      </div>
    );
  }

  return (
    <div
      ref={outerRef}
      className={`flex-1 overflow-x-auto overflow-y-hidden bg-surface-raised select-none ${className}`}
      style={{ minHeight: RULER_H + TRACK_H + 16 }}
    >
      {/* Inner content — wider than viewport when needed */}
      <div className="relative" style={{ width: innerW, height: RULER_H + TRACK_H + 16 }}>

        {/* ── Ruler — drag to scrub the preview ─────────────────────── */}
        <div
          className="absolute top-0 left-0 right-0 bg-surface-elevated border-b border-border-subtle cursor-ew-resize"
          style={{ height: RULER_H, touchAction: 'none' }}
          onPointerDown={handleRulerDown}
          onPointerMove={handleRulerMove}
          title="Drag to preview the plan at any point"
        >
          {markers.map(({ elap, rem, x }) => (
            <div
              key={elap}
              className="absolute flex flex-col items-center pointer-events-none"
              style={{ left: x, top: 0, transform: 'translateX(-50%)' }}
            >
              <div className="w-px bg-border-default" style={{ height: RULER_H * 0.4 }} />
              <span className="text-[10px] text-text-muted font-mono mt-0.5">{fmt(rem)}</span>
            </div>
          ))}
        </div>

        {/* ── Cue track ─────────────────────────────────────────────── */}
        <div
          className="timeline-bg absolute left-0 right-0 cursor-crosshair"
          style={{ top: RULER_H, height: TRACK_H + 16 }}
          onClick={handleTrackClick}
        >
          {/* Subtle row tint */}
          <div className="timeline-bg absolute inset-0 bg-surface-base/30 pointer-events-none" />

          {/* Grid lines every marker */}
          {markers.map(({ elap, x }) => (
            <div
              key={elap}
              className="absolute top-0 bottom-0 w-px bg-border-subtle pointer-events-none"
              style={{ left: x }}
            />
          ))}

          {/* Cue pills */}
          {cues.map(cue => (
            <CuePoint
              key={cue.id}
              cue={cue}
              pxPerSec={pxPerSec}
              onEdit={onCueEdit}
              onDelete={onCueDelete}
              onCommitMove={onCommitMove}
            />
          ))}
        </div>

        {/* ── Playhead (live) ───────────────────────────────────────── */}
        <div
          className="absolute top-0 pointer-events-none z-10"
          style={{ left: playheadLeft, height: RULER_H + TRACK_H + 16 }}
        >
          <div className="w-px h-full bg-accent/70" />
          {/* Arrow head */}
          <div
            className="absolute -left-[5px] bg-accent"
            style={{
              top: RULER_H - 6,
              width: 0, height: 0,
              borderLeft:  '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop:   '6px solid #e8a838',
            }}
          />
        </div>

        {/* ── Scrub playhead (preview) ──────────────────────────────── */}
        {scrubAt !== null && (
          <div
            className="absolute top-0 pointer-events-none z-20"
            style={{ left: (total - scrubAt) * pxPerSec, height: RULER_H + TRACK_H + 16 }}
          >
            <div className="w-px h-full" style={{ background: '#4aa3f5' }} />
            <div
              className="absolute -left-[5px]"
              style={{
                top: RULER_H - 6,
                width: 0, height: 0,
                borderLeft:  '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop:   '6px solid #4aa3f5',
              }}
            />
          </div>
        )}

      </div>

      {/* ── Preview pills — play from here / exit scrub ─────────────── */}
      {scrubAt !== null && (
        <div className="sticky left-0 bottom-1 z-30 flex justify-end gap-1.5 pr-2 -mt-7 pointer-events-none">
          <button
            type="button"
            onClick={playFromScrub}
            className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full
              text-[11px] font-mono shadow-lg border transition-colors
              bg-accent border-accent text-black hover:brightness-110"
            title="Start the live timer from this point"
          >
            ▶ Play from {fmt(scrubAt)}
          </button>
          <button
            type="button"
            onClick={endScrub}
            className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full
              text-[11px] font-mono shadow-lg border transition-colors
              bg-surface-overlay border-border-strong hover:border-accent"
            style={{ color: '#4aa3f5' }}
            title="Return the preview to live state"
          >
            back to live ✕
          </button>
        </div>
      )}
    </div>
  );
}
