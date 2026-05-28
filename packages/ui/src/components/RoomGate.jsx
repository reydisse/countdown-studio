import { useState, useEffect } from 'react';
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

// ── Icons ─────────────────────────────────────────────────────────────────────

function StackLogo() {
  return (
    <img src="/showstack-logo.svg" alt="ShowStack" style={{ height: 56, width: 'auto' }} />
  );
}

function CountdownIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="9" r="6" />
      <path d="M8 9V6" />
      <path d="M8 9l2.2 1.3" />
      <path d="M6 2.5h4" />
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
      className="flex items-center gap-3 cursor-pointer select-none group w-fit">
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface-base text-text-primary font-sans">

      {/* Subtle ambient glow */}
      <div className="pointer-events-none fixed inset-0"
        style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 40%, rgba(232,168,56,0.05) 0%, transparent 70%)' }} />

      <div className="relative z-10 flex flex-col items-center w-full max-w-xl px-4">

        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 mb-10 select-none">
          <StackLogo size={44} />
          <div>
            <div className="text-xl font-display tracking-widest text-text-primary leading-none">
              SHOWSTACK
            </div>
            <div className="text-[10px] text-text-disabled tracking-[0.2em] uppercase mt-1">
              Broadcast Suite · by Faithfire
            </div>
          </div>
        </div>

        {/* ── Card ──────────────────────────────────────────────────── */}
        <div className="w-full border border-border-default rounded-xl overflow-hidden bg-surface-raised">

          {/* ── Create ────────────────────────────────────────────── */}
          <form onSubmit={handleCreate} className="p-6 border-b border-border-subtle">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent mb-5">
              New Room
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-end">

              {/* Name + type */}
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

                <Toggle checked={permanent} onChange={setPermanent} label="Permanent room" />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={creating}
                className="flex items-center justify-center gap-2 self-end
                  bg-accent text-black font-semibold text-sm px-5 py-2.5 rounded-lg
                  hover:bg-accent-hover active:scale-[0.98] transition-all
                  disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {creating ? (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                    Creating…
                  </>
                ) : 'Create Room'}
              </button>
            </div>

            {createErr && (
              <p className="text-xs text-status-danger mt-3">{createErr}</p>
            )}
          </form>

          {/* ── Join ──────────────────────────────────────────────── */}
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
                    px-4 py-3
                    text-text-primary placeholder-text-disabled/40
                    focus:outline-none focus:border-accent focus:bg-[#0d0d0d]
                    transition-colors uppercase"
                />
                {joinErr
                  ? <p className="text-xs text-status-danger text-center">{joinErr}</p>
                  : <p className="text-[10px] text-text-disabled text-center">
                      Visible in the top bar of any room
                    </p>
                }
              </div>

              <button
                type="submit"
                disabled={joining || code.length < 7}
                className="flex items-center justify-center gap-2 mt-0
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

        {/* Footer */}
        <p className="mt-6 text-[11px] text-text-disabled tracking-wide select-none text-center">
          Rooms expire after 30 minutes of inactivity unless marked permanent.
        </p>

      </div>
    </div>
  );
}
