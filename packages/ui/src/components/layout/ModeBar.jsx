import { useTimerStore }  from '../../stores/timerStore.js';
import { useRoomStore }   from '../../stores/roomStore.js';

const STATUS_CONFIG = {
  running: { label: 'LIVE',   dot: 'bg-status-live',  pill: 'bg-status-live/15 text-status-live',  pulse: true  },
  paused:  { label: 'PAUSED', dot: 'bg-status-warn',  pill: 'bg-status-warn/15 text-status-warn',  pulse: false },
  stopped: { label: 'READY',  dot: 'bg-text-disabled', pill: 'bg-surface-overlay text-text-muted', pulse: false },
};

function BrandLogo({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="#0a0a0a" />
      <rect width="40" height="40" rx="10" stroke="#2a2a2a" strokeWidth="1" />
      <rect x="7" y="10" width="26" height="5" rx="2.5" fill="#e8a838" />
      <rect x="7" y="18" width="26" height="4" rx="2" fill="white" fillOpacity="0.6" />
      <rect x="7" y="26" width="18" height="4" rx="2" fill="white" fillOpacity="0.25" />
    </svg>
  );
}

function RoomBadge({ code }) {
  function copyShare() {
    const shareUrl = `${location.protocol}//${location.host}/join/${code}`;
    navigator.clipboard.writeText(shareUrl).catch(() => {});
  }

  return (
    <button
      type="button"
      onClick={copyShare}
      title="Copy share link"
      className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-elevated border border-border-subtle text-xs font-mono tracking-widest text-text-secondary hover:text-text-primary hover:border-border-default transition-colors select-none"
    >
      {code}
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="5" y="5" width="9" height="9" rx="1.5"/>
        <path d="M11 5V3a1.5 1.5 0 0 0-1.5-1.5H3A1.5 1.5 0 0 0 1.5 3v6.5A1.5 1.5 0 0 0 3 11H5"/>
      </svg>
    </button>
  );
}

export function ModeBar({ mode, onModeChange }) {
  const status    = useTimerStore(s => s.status);
  const code      = useRoomStore(s => s.room?.code);
  const leaveRoom = useRoomStore(s => s.leaveRoom);
  const cfg       = STATUS_CONFIG[status] ?? STATUS_CONFIG.stopped;

  return (
    <header className="flex items-center justify-between px-3 h-10 border-b border-border-subtle bg-surface-raised shrink-0">

      {/* ── Brand + leave ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 select-none">
        <button
          type="button"
          onClick={leaveRoom}
          title="Leave room"
          className="flex items-center justify-center w-6 h-6 rounded text-text-disabled hover:text-text-secondary hover:bg-surface-elevated transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 3H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3" />
            <path d="M11 11l3-3-3-3" />
            <path d="M14 8H6" />
          </svg>
        </button>
        <BrandLogo size={22} />
        <div className="flex flex-col leading-none">
          <span className="text-[11px] font-semibold text-text-primary tracking-wide">
            ShowStack
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

      {/* ── Right section: room code + status ──────────────────────────────── */}
      <div className="flex items-center gap-2">
        {code && <RoomBadge code={code} />}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-widest ${cfg.pill}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${cfg.pulse ? 'animate-pulse' : ''}`} />
          {cfg.label}
        </div>
      </div>

    </header>
  );
}
