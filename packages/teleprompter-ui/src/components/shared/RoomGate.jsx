import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePrompterStore } from '../../store/prompterStore.js';

const API = import.meta.env.VITE_API_URL || '';

function formatCode(raw) {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return clean.length <= 2 ? clean : `${clean.slice(0, 2)}-${clean.slice(2, 6)}`;
}

function StackLogo() {
  return (
    <img src="/showstack-logo.svg" alt="ShowStack" style={{ height: 56, width: 'auto' }} />
  );
}

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
    if (!createName.trim()) { setCreateError('Name is required'); return; }
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface-base text-text-primary px-4">
      <div className="flex items-center gap-4 mb-10 select-none">
        <StackLogo size={44} />
        <div>
          <div className="text-lg font-semibold tracking-wide text-text-primary leading-none">SHOWSTACK</div>
          <div className="text-[10px] text-text-disabled tracking-[0.2em] uppercase mt-1">Teleprompter</div>
        </div>
      </div>

      <div className="w-full max-w-md border border-border-default rounded-xl overflow-hidden bg-surface-raised">
        <form onSubmit={handleCreate} className="p-6 border-b border-border-subtle">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent mb-4">New Room</p>
          <div className="flex gap-3 items-start">
            <div className="flex flex-col gap-1 flex-1">
              <input type="text" value={createName} onChange={e => { setCreateName(e.target.value); setCreateError(''); }}
                placeholder="e.g. Sunday Service" autoFocus
                className="bg-surface-elevated border border-border-default rounded-lg px-3.5 py-2.5 text-sm text-text-primary placeholder-text-disabled focus:outline-none focus:border-accent transition-colors" />
              {createError && <p className="text-xs text-status-danger">{createError}</p>}
            </div>
            <button type="submit" disabled={creating}
              className="bg-accent text-black font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-40 whitespace-nowrap">
              {creating ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>

        <form onSubmit={handleJoin} className="p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-disabled mb-4">Join Existing</p>
          <div className="flex gap-3 items-start">
            <div className="flex flex-col gap-1 flex-1">
              <input type="text" value={joinCode} onChange={e => { setJoinCode(formatCode(e.target.value)); setJoinError(''); }}
                placeholder="AB-1234" maxLength={7} spellCheck={false}
                className="bg-surface-elevated border border-border-default rounded-lg px-3.5 py-2.5 text-sm font-mono tracking-widest text-text-primary placeholder-text-disabled/40 focus:outline-none focus:border-accent transition-colors uppercase" />
              {joinError && <p className="text-xs text-status-danger">{joinError}</p>}
            </div>
            <button type="submit" disabled={joining || joinCode.length < 7}
              className="bg-surface-elevated border border-border-default text-text-primary font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-surface-overlay transition-colors disabled:opacity-40 whitespace-nowrap">
              {joining ? 'Joining…' : 'Join'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
