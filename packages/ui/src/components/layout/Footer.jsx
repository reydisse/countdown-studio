import { useTimerStore }    from '../../stores/timerStore.js';
import { useSettingsStore } from '../../stores/settingsStore.js';

function fmt(secs) {
  if (secs < 0) secs = 0;
  const h  = Math.floor(secs / 3600);
  const m  = Math.floor((secs % 3600) / 60);
  const s  = secs % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const STATUS_BADGE = {
  running: 'bg-status-live/15 text-status-live',
  paused:  'bg-status-warn/15 text-status-warn',
  stopped: 'bg-surface-overlay text-text-muted',
};

function IconBtn({ onClick, title, disabled = false, children, active = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        w-8 h-8 flex items-center justify-center rounded transition-colors
        disabled:opacity-30 disabled:cursor-not-allowed
        ${active
          ? 'bg-accent text-surface-base hover:bg-accent-hover'
          : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'}
      `}
    >
      {children}
    </button>
  );
}

export function Footer({ slideshowRef }) {
  const remaining = useTimerStore(s => s.remaining);
  const status    = useTimerStore(s => s.status);
  const play      = useTimerStore(s => s.play);
  const pause     = useTimerStore(s => s.pause);
  const stop      = useTimerStore(s => s.stop);
  const reset     = useTimerStore(s => s.reset);
  const bgMode = useSettingsStore(s => s.bgMode);

  const isRunning  = status === 'running';
  const isSlidesh  = bgMode === 'slideshow';

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  return (
    <footer className="
      h-11 shrink-0 flex items-center justify-between gap-3 px-4
      bg-surface-raised border-t border-border-subtle
    ">
      {/* Left: timer readout + badge */}
      <div className="flex items-center gap-2 min-w-[9rem]">
        <span className="text-lg font-display text-text-primary tabular-nums leading-none">
          {fmt(remaining)}
        </span>
        <span className={`text-[10px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded-full ${STATUS_BADGE[status]}`}>
          {status}
        </span>
      </div>

      {/* Center: slide + transport controls */}
      <div className="flex items-center gap-1">
        {isSlidesh && (
          <>
            <IconBtn title="Previous slide" onClick={() => slideshowRef?.current?.prev()}>
              {/* ◀ */}
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M3.5 2a.5.5 0 0 1 .5.5v4.293L11.146 0.646A.5.5 0 0 1 12 1v14a.5.5 0 0 1-.854.354L4.5 9.207V13.5a.5.5 0 0 1-1 0v-11a.5.5 0 0 1 .5-.5z"/>
              </svg>
            </IconBtn>
            <IconBtn title="Next slide" onClick={() => slideshowRef?.current?.next()}>
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M12.5 2a.5.5 0 0 0-.5.5v4.293L4.854 0.646A.5.5 0 0 0 4 1v14a.5.5 0 0 0 .854.354L11.5 9.207V13.5a.5.5 0 0 0 1 0v-11a.5.5 0 0 0-.5-.5z"/>
              </svg>
            </IconBtn>
            <div className="w-px h-5 bg-border-default mx-1" />
          </>
        )}

        {/* Play / Pause */}
        <IconBtn
          title={isRunning ? 'Pause' : 'Play'}
          onClick={isRunning ? pause : play}
          active={isRunning}
          disabled={status === 'stopped' && remaining === 0}
        >
          {isRunning ? (
            /* ‖ pause */
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <rect x="3" y="2" width="3.5" height="12" rx="1"/>
              <rect x="9.5" y="2" width="3.5" height="12" rx="1"/>
            </svg>
          ) : (
            /* ▶ play */
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <path d="M3 2.5a.5.5 0 0 1 .763-.424l9 5.5a.5.5 0 0 1 0 .848l-9 5.5A.5.5 0 0 1 3 13.5z"/>
            </svg>
          )}
        </IconBtn>

        {/* Stop */}
        <IconBtn title="Stop" onClick={stop} disabled={status === 'stopped'}>
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/>
          </svg>
        </IconBtn>

        {/* Reset */}
        <IconBtn title="Reset" onClick={reset}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M1.5 4.5A6.5 6.5 0 1 1 3.9 2.7M1.5 1v3.5H5"/>
          </svg>
        </IconBtn>
      </div>

      {/* Right: fullscreen */}
      <div className="flex items-center justify-end min-w-[9rem]">
        <IconBtn title="Toggle fullscreen" onClick={toggleFullscreen}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
            <path strokeLinecap="round" d="M1.5 5.5V2h3.5M10.5 2H14v3.5M14 10.5V14h-3.5M5.5 14H2v-3.5"/>
          </svg>
        </IconBtn>
      </div>
    </footer>
  );
}
