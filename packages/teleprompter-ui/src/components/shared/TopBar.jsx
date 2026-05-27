import { useNavigate } from 'react-router-dom';
import { usePrompterStore } from '../../store/prompterStore.js';

export function TopBar({ rightSlot }) {
  const room      = usePrompterStore(s => s.room);
  const leaveRoom = usePrompterStore(s => s.leaveRoom);
  const navigate  = useNavigate();
  const code      = room?.code;

  function copyReadUrl() {
    const url = `${location.origin}/teleprompter/room/${code}/read`;
    navigator.clipboard.writeText(url).catch(() => {});
  }

  function handleLeave() {
    leaveRoom();
    navigate('/');
  }

  return (
    <header className="flex items-center justify-between px-4 h-10 bg-surface-raised border-b border-border-subtle shrink-0 select-none">
      <div className="flex items-center gap-2">
        <button onClick={handleLeave} title="Leave room"
          className="flex items-center justify-center w-6 h-6 rounded text-text-disabled hover:text-text-secondary hover:bg-surface-elevated transition-colors">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 3H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3" />
            <path d="M11 11l3-3-3-3" />
            <path d="M14 8H6" />
          </svg>
        </button>
        <span className="text-[11px] font-semibold text-text-primary tracking-wide">
          ShowStack <span className="text-text-muted font-normal">/ Teleprompter</span>
        </span>
        <a href="/"
          title="Back to Countdown"
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-text-muted hover:text-text-primary hover:bg-surface-elevated border border-transparent hover:border-border-subtle transition-colors">
          ← Countdown
        </a>
      </div>

      <div className="flex items-center gap-2">
        {code && (
          <button onClick={copyReadUrl} title="Copy reader URL"
            className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-elevated border border-border-subtle text-xs font-mono tracking-widest text-text-secondary hover:text-text-primary transition-colors">
            {code}
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="5" width="9" height="9" rx="1.5"/>
              <path d="M11 5V3a1.5 1.5 0 0 0-1.5-1.5H3A1.5 1.5 0 0 0 1.5 3v6.5A1.5 1.5 0 0 0 3 11H5"/>
            </svg>
          </button>
        )}
        {rightSlot}
      </div>
    </header>
  );
}
