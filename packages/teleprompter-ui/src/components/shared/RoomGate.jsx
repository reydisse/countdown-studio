import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePrompterStore } from '../../store/prompterStore.js';

const API = import.meta.env.VITE_API_URL || '';

function formatCode(raw) {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return clean.length <= 2 ? clean : `${clean.slice(0, 2)}-${clean.slice(2, 6)}`;
}

// ── Showcase panel ────────────────────────────────────────────────────────────

const SCRIPT_LINES = [
  'Good morning and welcome to our service.',
  'We are so glad you could join us today.',
  'Please silence your phones and enjoy the worship.',
  'Our message today comes from the book of John.',
  '"In the beginning was the Word, and the Word was with God."',
  'Let us open our hearts and minds to receive.',
  'The grace of the Lord be with you all.',
  'Thank you for being here with us this morning.',
  'We will begin our service in just a moment.',
  'Please find your seats and make yourselves comfortable.',
];

const TICKER_TEXT = 'TELEPROMPTER  •  LIVE BROADCAST  •  SHOWSTACK  •  BROADCAST PRODUCTION  •  ON AIR  •  ';
const BAR_DURATIONS = [1.1, 0.8, 1.4, 0.9, 1.2, 0.75, 1.05, 1.3, 0.85, 1.15, 0.95, 1.25];
const BAR_DELAYS    = [0, 0.2, 0.05, 0.35, 0.15, 0.45, 0.1, 0.3, 0.25, 0.05, 0.4, 0.2];

function ShowcasePanel() {
  const [lineIdx, setLineIdx] = useState(0);
  const [scroll, setScroll]   = useState(0);
  const [speed]               = useState(2);

  useEffect(() => {
    const t = setInterval(() => {
      setLineIdx(i => (i + 1) % SCRIPT_LINES.length);
    }, 3200);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let raf;
    function tick() {
      setScroll(s => s + speed * 0.4);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speed]);

  return (
    <>
      <style>{`
        @keyframes ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes scanline {
          0%   { top: 0%;   opacity: 0; }
          4%   { opacity: 0.5; }
          96%  { opacity: 0.5; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes bars {
          0%, 100% { transform: scaleY(0.2); }
          50%       { transform: scaleY(1); }
        }
        @keyframes liveRing {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.6); }
          50%       { box-shadow: 0 0 0 6px rgba(239,68,68,0); }
        }
        @keyframes signalPulse {
          0%, 100% { opacity: 0.3; }
          50%       { opacity: 1; }
        }
        @keyframes focusLinePulse {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 0.9; }
        }
        @keyframes prompterFade {
          0%   { opacity: 0; transform: translateY(6px); }
          12%  { opacity: 1; transform: translateY(0); }
          80%  { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-6px); }
        }
      `}</style>

      <div className="relative w-full h-full min-h-0 flex flex-col overflow-hidden select-none"
        style={{ background: 'linear-gradient(160deg, #0e0c0a 0%, #080604 60%, #0c0a08 100%)' }}>

        {/* Scan line */}
        <div className="pointer-events-none absolute left-0 right-0 h-px z-20"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(232,168,56,0.4), transparent)', animation: 'scanline 6s linear infinite' }} />

        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(232,168,56,0.07) 0%, transparent 60%)' }} />

        {/* Corner brackets */}
        {[['top-3 left-3','border-t border-l'],['top-3 right-3','border-t border-r'],
          ['bottom-3 left-3','border-b border-l'],['bottom-3 right-3','border-b border-r']].map(([pos, borders]) => (
          <div key={pos} className={`absolute ${pos} w-5 h-5 ${borders} border-amber-600/40`} />
        ))}

        {/* Top bar */}
        <div className="flex items-center justify-between px-6 pt-6 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500"
              style={{ animation: 'liveRing 1.4s ease-in-out infinite' }} />
            <span className="text-[10px] font-bold tracking-[0.25em] text-red-400 uppercase">On Air</span>
          </div>
          <div className="flex items-center gap-1.5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="w-1 rounded-sm bg-amber-500/60"
                style={{ height: `${8 + i * 4}px`, animation: `signalPulse ${0.8 + i * 0.2}s ease-in-out infinite`, animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          <span className="text-[10px] font-mono text-text-disabled tracking-widest">TELEPROMPTER</span>
        </div>

        {/* Scrolling script — main feature */}
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-8 relative overflow-hidden">

          {/* Focus line */}
          <div className="absolute left-0 right-0 pointer-events-none z-10"
            style={{
              top: '50%', height: '2px',
              background: 'linear-gradient(90deg, transparent, rgba(232,168,56,0.5), transparent)',
              animation: 'focusLinePulse 2s ease-in-out infinite',
            }} />
          <div className="absolute left-0 right-0 pointer-events-none z-10"
            style={{ top: 'calc(50% - 28px)', bottom: 'calc(50% - 28px - 2px)', background: 'rgba(232,168,56,0.03)', borderTop: '1px solid rgba(232,168,56,0.12)', borderBottom: '1px solid rgba(232,168,56,0.12)' }} />

          {/* Fade masks */}
          <div className="absolute inset-x-0 top-0 h-16 pointer-events-none z-10"
            style={{ background: 'linear-gradient(to bottom, #080604, transparent)' }} />
          <div className="absolute inset-x-0 bottom-0 h-16 pointer-events-none z-10"
            style={{ background: 'linear-gradient(to top, #080604, transparent)' }} />

          {/* Script lines */}
          <div className="w-full text-center flex flex-col gap-6">
            {[-2, -1, 0, 1, 2].map(offset => {
              const idx = ((lineIdx + offset) % SCRIPT_LINES.length + SCRIPT_LINES.length) % SCRIPT_LINES.length;
              const isActive = offset === 0;
              return (
                <p key={`${lineIdx}-${offset}`}
                  className="leading-snug transition-all duration-700"
                  style={{
                    fontSize: isActive ? '1.05rem' : '0.82rem',
                    color: isActive ? '#f5c842' : offset === -1 || offset === 1 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                    fontStyle: 'italic',
                    fontWeight: isActive ? 500 : 400,
                    textShadow: isActive ? '0 0 40px rgba(232,168,56,0.5)' : 'none',
                  }}>
                  {SCRIPT_LINES[idx]}
                </p>
              );
            })}
          </div>

          {/* Speed indicator */}
          <div className="absolute bottom-4 right-4 flex items-center gap-1.5">
            <span className="text-[9px] tracking-[0.2em] text-text-disabled uppercase">Speed</span>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="w-1 rounded-sm"
                style={{ height: 8, background: i < speed ? '#e8a838' : 'rgba(255,255,255,0.1)' }} />
            ))}
          </div>
        </div>

        {/* Waveform bars */}
        <div className="flex items-end justify-center gap-0.5 px-6 pb-4 h-10 shrink-0">
          {BAR_DURATIONS.map((dur, i) => (
            <div key={i} className="w-1.5 rounded-t-sm origin-bottom"
              style={{
                height: '100%',
                background: 'linear-gradient(to top, #e8a838, #f5c842aa)',
                animation: `bars ${dur}s ease-in-out infinite`,
                animationDelay: `${BAR_DELAYS[i]}s`,
              }} />
          ))}
        </div>

        {/* Ticker tape */}
        <div className="shrink-0 overflow-hidden border-t border-white/5 py-2"
          style={{ background: 'rgba(232,168,56,0.04)' }}>
          <div className="flex whitespace-nowrap"
            style={{ animation: 'ticker 22s linear infinite' }}>
            {[TICKER_TEXT, TICKER_TEXT].map((t, i) => (
              <span key={i} className="text-[9px] tracking-[0.18em] text-amber-600/70 uppercase font-medium px-4">{t}</span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function RoomGate() {
  const setRoom  = usePrompterStore(s => s.setRoom);
  const navigate = useNavigate();

  const [createName,  setCreateName]  = useState('');
  const [creating,    setCreating]    = useState(false);
  const [createError, setCreateError] = useState('');

  const [joinCode,  setJoinCode]  = useState('');
  const [joining,   setJoining]   = useState(false);
  const [joinError, setJoinError] = useState('');

  async function handleCreate(e) {
    e.preventDefault();
    if (!createName.trim()) { setCreateError('Room name is required'); return; }
    setCreating(true);
    setCreateError('');
    try {
      const res = await fetch(`${API}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: createName.trim(), type: 'teleprompter' }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Could not create room');
      const room = await res.json();
      setRoom(room);
      navigate(`/room/${room.code}`);
    } catch (err) {
      setCreateError(err.message);
      setCreating(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!/^[A-Z]{2}-[0-9]{4}$/.test(code)) { setJoinError('Enter a valid code (e.g. AB-1234)'); return; }
    setJoining(true);
    setJoinError('');
    try {
      const res = await fetch(`${API}/api/rooms/${code}`);
      if (!res.ok) throw Object.assign(new Error('Room not found'), { status: res.status });
      const room = await res.json();
      setRoom(room);
      navigate(`/room/${room.code}`);
    } catch (err) {
      setJoinError(err.status === 404 ? 'Room not found' : err.message);
      setJoining(false);
    }
  }

  return (
    <div className="h-screen flex bg-surface-base text-text-primary font-sans overflow-hidden">

      {/* ── Left: Showcase panel ────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-1 min-w-0 p-5">
        <div className="w-full h-full rounded-2xl overflow-hidden"
          style={{ boxShadow: '0 0 0 1px rgba(232,168,56,0.12), 0 32px 64px rgba(0,0,0,0.6)' }}>
          <ShowcasePanel />
        </div>
      </div>

      {/* ── Right: Form ─────────────────────────────────────────────────── */}
      <div className="w-full lg:w-[400px] shrink-0 flex flex-col items-center justify-center overflow-y-auto px-6 py-10">

        {/* Logo */}
        <div className="mb-3 select-none">
          <img src="/showstack-logo.svg" alt="ShowStack" style={{ height: 48, width: 'auto' }} />
        </div>
        <p className="text-[10px] text-text-disabled tracking-[0.25em] uppercase mb-10">Teleprompter</p>

        {/* Card */}
        <div className="w-full border border-border-default rounded-xl overflow-hidden bg-surface-raised">

          {/* Create */}
          <form onSubmit={handleCreate} className="p-6 border-b border-border-subtle">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent mb-5">New Room</p>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={createName}
                onChange={e => { setCreateName(e.target.value); setCreateError(''); }}
                placeholder="Room name — e.g. Sunday Service"
                autoFocus
                className="bg-surface-elevated border border-border-default rounded-lg px-3.5 py-2.5
                  text-sm text-text-primary placeholder-text-disabled
                  focus:outline-none focus:border-accent focus:bg-[#0d0d0d] transition-colors"
              />
              <button
                type="submit"
                disabled={creating}
                className="flex items-center justify-center gap-2
                  bg-accent text-black font-semibold text-sm px-5 py-2.5 rounded-lg
                  hover:bg-accent-hover active:scale-[0.98] transition-all
                  disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {creating ? (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                    Creating…
                  </>
                ) : 'Create Room'}
              </button>
            </div>
            {createError && <p className="text-xs text-status-danger mt-3">{createError}</p>}
          </form>

          {/* Join */}
          <form onSubmit={handleJoin} className="p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-disabled mb-5">Join Existing</p>
            <div className="flex gap-3 items-start">
              <div className="flex flex-col gap-1 flex-1">
                <input
                  type="text"
                  value={joinCode}
                  onChange={e => { setJoinCode(formatCode(e.target.value)); setJoinError(''); }}
                  placeholder="AB-1234"
                  maxLength={7}
                  spellCheck={false}
                  className="w-full text-center text-xl font-mono tracking-[0.3em]
                    bg-surface-elevated border border-border-default rounded-lg
                    px-4 py-3 text-text-primary placeholder-text-disabled/40
                    focus:outline-none focus:border-accent focus:bg-[#0d0d0d]
                    transition-colors uppercase"
                />
                {joinError
                  ? <p className="text-xs text-status-danger text-center">{joinError}</p>
                  : <p className="text-[10px] text-text-disabled text-center">Visible in the top bar of any room</p>
                }
              </div>
              <button
                type="submit"
                disabled={joining || joinCode.length < 7}
                className="flex items-center justify-center gap-2
                  bg-surface-elevated border border-border-default
                  text-text-primary font-semibold text-sm px-5 py-3 rounded-lg
                  hover:bg-surface-overlay hover:border-border-strong
                  active:scale-[0.98] transition-all
                  disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {joining ? (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-text-disabled/40 border-t-text-primary animate-spin" />
                    Joining…
                  </>
                ) : 'Join Room'}
              </button>
            </div>
          </form>
        </div>

        <p className="mt-6 text-[11px] text-text-disabled tracking-wide select-none text-center">
          Rooms expire after 30 minutes of inactivity unless marked permanent.
        </p>
      </div>
    </div>
  );
}
