import { useState, useEffect, useRef } from 'react';
import { createRoom, getRoom } from '../adapter/index.js';
import { useRoomStore } from '../stores/roomStore.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCode(raw) {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return clean.length <= 2 ? clean : `${clean.slice(0, 2)}-${clean.slice(2, 6)}`;
}

function redirectTeleprompter(room) {
  sessionStorage.setItem('showstack_prompter_room', room.code);
  window.location.href = '/teleprompter/';
}

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function CountdownIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="9" r="6" />
      <path d="M8 9V6" /><path d="M8 9l2.2 1.3" /><path d="M6 2.5h4" />
    </svg>
  );
}

function TeleprompterIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="2.5" width="13" height="9" rx="1.5" />
      <path d="M4.5 6h7M4.5 8.5h4.5" />
      <path d="M6 14l2-2.5 2 2.5" />
    </svg>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 cursor-pointer select-none w-fit">
      <div className={`relative w-9 h-5 rounded-full transition-colors duration-200
        ${checked ? 'bg-accent' : 'bg-surface-overlay'}`}>
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow transition-transform duration-200
          ${checked ? 'translate-x-4 bg-black' : 'bg-text-disabled'}`} />
      </div>
      <span className={`text-sm transition-colors ${checked ? 'text-text-primary' : 'text-text-muted'}`}>
        {label}
      </span>
    </button>
  );
}

// ── Animated showcase panel ───────────────────────────────────────────────────

const TICKER_TEXT = 'SUNDAY SERVICE  •  MAIN AUDITORIUM  •  BROADCAST PRODUCTION  •  SHOWSTACK LIVE  •  ON AIR  •  ';
const PROMPTER_LINES = [
  'Good morning and welcome to our service.',
  'We are so glad you could join us today.',
  'Please silence your phones and enjoy the worship.',
  'Our message today comes from the book of John.',
  '"In the beginning was the Word, and the Word was with God."',
  'Let us open our hearts and minds to receive.',
  'The grace of the Lord be with you all.',
  'We will begin our countdown in just a moment.',
];

const BAR_DURATIONS = [1.1, 0.8, 1.4, 0.9, 1.2, 0.75, 1.05, 1.3, 0.85, 1.15, 0.95, 1.25];
const BAR_DELAYS    = [0, 0.2, 0.05, 0.35, 0.15, 0.45, 0.1, 0.3, 0.25, 0.05, 0.4, 0.2];

function ShowcasePanel() {
  const [seconds, setSeconds] = useState(9 * 60 + 47);
  const [prompterLine, setPrompterLine] = useState(0);
  const [clients] = useState(3);

  useEffect(() => {
    const t = setInterval(() => {
      setSeconds(s => s <= 0 ? 9 * 60 + 59 : s - 1);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setPrompterLine(l => (l + 1) % PROMPTER_LINES.length);
    }, 3200);
    return () => clearInterval(t);
  }, []);

  const isUrgent = seconds <= 60;

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
        @keyframes prompterFade {
          0%   { opacity: 0; transform: translateY(6px); }
          12%  { opacity: 1; transform: translateY(0); }
          80%  { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-6px); }
        }
        @keyframes liveRing {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.6); }
          50%       { box-shadow: 0 0 0 6px rgba(239,68,68,0); }
        }
        @keyframes countGlow {
          0%, 100% { text-shadow: 0 0 40px rgba(232,168,56,0.4); }
          50%       { text-shadow: 0 0 80px rgba(232,168,56,0.7), 0 0 120px rgba(232,168,56,0.3); }
        }
        @keyframes urgentPulse {
          0%, 100% { color: #f5464a; text-shadow: 0 0 40px rgba(245,70,74,0.5); }
          50%       { color: #ff6b6e; text-shadow: 0 0 80px rgba(245,70,74,0.8); }
        }
        @keyframes signalPulse {
          0%, 100% { opacity: 0.3; }
          50%       { opacity: 1; }
        }
      `}</style>

      <div className="relative w-full h-full min-h-0 flex flex-col overflow-hidden select-none"
        style={{ background: 'linear-gradient(160deg, #0e0c0a 0%, #080604 60%, #0c0a08 100%)' }}>

        {/* Scan line */}
        <div className="pointer-events-none absolute left-0 right-0 h-px z-20"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(232,168,56,0.4), transparent)', animation: 'scanline 6s linear infinite' }} />

        {/* Ambient glow top */}
        <div className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(232,168,56,0.07) 0%, transparent 60%)' }} />

        {/* Corner brackets */}
        {[['top-3 left-3', 'border-t border-l'],['top-3 right-3', 'border-t border-r'],
          ['bottom-3 left-3', 'border-b border-l'],['bottom-3 right-3', 'border-b border-r']].map(([pos, borders]) => (
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
          <span className="text-[10px] font-mono text-text-disabled tracking-widest">
            {clients} CONNECTED
          </span>
        </div>

        {/* Main countdown */}
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 gap-3">
          <div className="text-[10px] font-semibold tracking-[0.3em] text-text-disabled uppercase mb-1">
            Session Timer
          </div>

          <div
            className="font-mono font-bold leading-none tabular-nums"
            style={{
              fontSize: 'clamp(52px, 8vw, 88px)',
              animation: isUrgent ? 'urgentPulse 0.8s ease-in-out infinite' : 'countGlow 2.5s ease-in-out infinite',
              color: isUrgent ? '#f5464a' : '#e8a838',
              letterSpacing: '-0.02em',
            }}
          >
            {fmtTime(seconds)}
          </div>

          {/* Progress bar */}
          <div className="w-full max-w-[240px] h-0.5 bg-white/5 rounded-full overflow-hidden mt-1">
            <div className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${(seconds / (10 * 60)) * 100}%`,
                background: isUrgent
                  ? 'linear-gradient(90deg, #f5464a, #ff8a8c)'
                  : 'linear-gradient(90deg, #c47d10, #f5c842)',
              }} />
          </div>
        </div>

        {/* Teleprompter strip */}
        <div className="mx-4 mb-3 rounded-lg overflow-hidden border border-white/5"
          style={{ background: 'rgba(255,255,255,0.03)' }}>
          <div className="px-3 pt-2 pb-1 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500/60" />
            <span className="text-[9px] tracking-[0.2em] text-text-disabled uppercase font-semibold">Teleprompter</span>
          </div>
          <div className="px-4 pb-3 h-10 flex items-center overflow-hidden">
            <p key={prompterLine}
              className="text-sm text-text-secondary leading-snug text-center w-full"
              style={{ animation: 'prompterFade 3.2s ease-in-out forwards', fontStyle: 'italic' }}>
              {PROMPTER_LINES[prompterLine]}
            </p>
          </div>
        </div>

        {/* Waveform bars */}
        <div className="flex items-end justify-center gap-0.5 px-6 pb-4 h-10 shrink-0">
          {BAR_DURATIONS.map((dur, i) => (
            <div key={i}
              className="w-1.5 rounded-t-sm origin-bottom"
              style={{
                height: '100%',
                background: `linear-gradient(to top, #e8a838, #f5c842aa)`,
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
              <span key={i} className="text-[9px] tracking-[0.18em] text-amber-600/70 uppercase font-medium px-4">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function RoomGate() {
  const setRoom = useRoomStore(s => s.setRoom);

  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const initialCode  = searchParams.get('join') ?? '';

  const [name,      setName]      = useState('');
  const [type,      setType]      = useState('countdown');
  const [permanent, setPermanent] = useState(false);
  const [creating,  setCreating]  = useState(false);
  const [createErr, setCreateErr] = useState('');

  const [code,    setCode]    = useState(formatCode(initialCode));
  const [joining, setJoining] = useState(false);
  const [joinErr, setJoinErr] = useState('');

  useEffect(() => {
    if (initialCode) {
      const url = new URL(window.location.href);
      url.searchParams.delete('join');
      window.history.replaceState(null, '', url.toString());
    }
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) { setCreateErr('Room name is required'); return; }
    setCreating(true);
    setCreateErr('');
    try {
      const room = await createRoom({ name: name.trim(), type, isPermanent: permanent });
      if (type === 'teleprompter') { redirectTeleprompter(room); return; }
      setRoom(room);
    } catch (err) {
      setCreateErr(err.message || 'Could not create room — is the server running?');
      setCreating(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!/^[A-Z]{2}-[0-9]{4}$/.test(trimmed)) {
      setJoinErr('Enter a valid code — e.g. AB-1234');
      return;
    }
    setJoining(true);
    setJoinErr('');
    try {
      const room = await getRoom(trimmed);
      if (room.type === 'teleprompter') { redirectTeleprompter(room); return; }
      setRoom(room);
    } catch (err) {
      setJoinErr(err.status === 404 ? 'Room not found' : (err.message || 'Could not join room'));
      setJoining(false);
    }
  }

  const TYPES = [
    { value: 'countdown',    label: 'Countdown',    Icon: CountdownIcon },
    { value: 'teleprompter', label: 'Teleprompter', Icon: TeleprompterIcon },
  ];

  return (
    <div className="h-screen flex bg-surface-base text-text-primary font-sans overflow-hidden">

      {/* ── Left: Showcase panel ─────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-1 min-w-0 p-5">
        <div className="w-full h-full rounded-2xl overflow-hidden" style={{ boxShadow: '0 0 0 1px rgba(232,168,56,0.12), 0 32px 64px rgba(0,0,0,0.6)' }}>
          <ShowcasePanel />
        </div>
      </div>

      {/* ── Right: Form ─────────────────────────────────────────────────── */}
      <div className="w-full lg:w-[400px] shrink-0 flex flex-col items-center justify-center overflow-y-auto px-6 py-10">

        {/* Logo */}
        <div className="mb-10 select-none">
          <img src="/showstack-logo.svg" alt="ShowStack" style={{ height: 48, width: 'auto' }} />
        </div>

        {/* Card */}
        <div className="w-full border border-border-default rounded-xl overflow-hidden bg-surface-raised">

          {/* Create */}
          <form onSubmit={handleCreate} className="p-6 border-b border-border-subtle">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent mb-5">
              New Room
            </p>

            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setCreateErr(''); }}
                placeholder="Room name — e.g. Sunday Service"
                autoFocus
                className="bg-surface-elevated border border-border-default rounded-lg px-3.5 py-2.5
                  text-sm text-text-primary placeholder-text-disabled
                  focus:outline-none focus:border-accent focus:bg-[#0d0d0d]
                  transition-colors"
              />

              <div className="flex gap-2">
                {TYPES.map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setType(value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium
                      transition-all duration-150 flex-1 justify-center
                      ${type === value
                        ? 'bg-accent/10 border-accent/50 text-accent'
                        : 'bg-surface-elevated border-border-subtle text-text-muted hover:border-border-default hover:text-text-secondary'
                      }`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3">
                <Toggle checked={permanent} onChange={setPermanent} label="Permanent room" />
                <button
                  type="submit"
                  disabled={creating}
                  className="flex items-center justify-center gap-2
                    bg-accent text-black font-semibold text-sm px-5 py-2.5 rounded-lg
                    hover:bg-accent-hover active:scale-[0.98] transition-all
                    disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
                >
                  {creating ? (
                    <>
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                      Creating…
                    </>
                  ) : 'Create Room'}
                </button>
              </div>
            </div>

            {createErr && <p className="text-xs text-status-danger mt-3">{createErr}</p>}
          </form>

          {/* Join */}
          <form onSubmit={handleJoin} className="p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-disabled mb-5">
              Join Existing
            </p>

            <div className="flex gap-3 items-start">
              <div className="flex flex-col gap-1 flex-1">
                <input
                  type="text"
                  value={code}
                  onChange={e => { setCode(formatCode(e.target.value)); setJoinErr(''); }}
                  placeholder="AB-1234"
                  maxLength={7}
                  spellCheck={false}
                  className="w-full text-center text-xl font-mono tracking-[0.3em]
                    bg-surface-elevated border border-border-default rounded-lg
                    px-4 py-3 text-text-primary placeholder-text-disabled/40
                    focus:outline-none focus:border-accent focus:bg-[#0d0d0d]
                    transition-colors uppercase"
                />
                {joinErr
                  ? <p className="text-xs text-status-danger text-center">{joinErr}</p>
                  : <p className="text-[10px] text-text-disabled text-center">Visible in the top bar of any room</p>
                }
              </div>

              <button
                type="submit"
                disabled={joining || code.length < 7}
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
