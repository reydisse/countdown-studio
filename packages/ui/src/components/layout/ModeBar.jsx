import { useTimerStore } from '../../stores/timerStore.js';

const STATUS_CONFIG = {
  running: { label: 'LIVE',   dot: 'bg-status-live',  pill: 'bg-status-live/15 text-status-live',  pulse: true  },
  paused:  { label: 'PAUSED', dot: 'bg-status-warn',  pill: 'bg-status-warn/15 text-status-warn',  pulse: false },
  stopped: { label: 'READY',  dot: 'bg-text-disabled', pill: 'bg-surface-overlay text-text-muted', pulse: false },
};

function BrandLogo({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#181614"/>
      <circle cx="16" cy="16" r="11" stroke="#2c2825" strokeWidth="2.5"/>
      <circle cx="16" cy="16" r="11" stroke="#e8a838" strokeWidth="2.5"
        strokeDasharray="55.3 13.8" strokeLinecap="round"
        transform="rotate(-90 16 16)"/>
      <line x1="16" y1="16" x2="16" y2="7" stroke="#f0ede8" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="16" cy="16" r="2.2" fill="#e8a838"/>
    </svg>
  );
}

export function ModeBar({ mode, onModeChange }) {
  const status = useTimerStore(s => s.status);
  const cfg    = STATUS_CONFIG[status] ?? STATUS_CONFIG.stopped;

  return (
    <header className="flex items-center justify-between px-3 h-10 border-b border-border-subtle bg-surface-raised shrink-0">

      {/* ── Brand ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 select-none">
        <BrandLogo size={22} />
        <div className="flex flex-col leading-none">
          <span className="text-[11px] font-semibold text-text-primary tracking-wide">
            Countdown Studio
          </span>
          <span className="text-[9px] text-text-muted tracking-widest uppercase">
            by Faithfire
          </span>
        </div>
      </div>

      {/* ── Mode tabs ──────────────────────────────────────────────────────── */}
      <div className="flex gap-0.5">
        {['design', 'plan'].map(m => (
          <button
            key={m}
            type="button"
            onClick={() => onModeChange(m)}
            className={`
              px-3 py-1 rounded text-xs font-semibold uppercase tracking-widest
              transition-colors capitalize
              ${mode === m
                ? 'bg-surface-elevated text-text-primary'
                : 'text-text-muted hover:text-text-secondary'}
            `}
          >
            {m}
          </button>
        ))}
      </div>

      {/* ── Status pill ────────────────────────────────────────────────────── */}
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-widest ${cfg.pill}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${cfg.pulse ? 'animate-pulse' : ''}`} />
        {cfg.label}
      </div>

    </header>
  );
}
