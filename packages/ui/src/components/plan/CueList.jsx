import { useRef, useState } from 'react';
import { useTimerStore } from '../../stores/timerStore.js';

// ── Colour coding matches CuePoint ───────────────────────────────────────────
const TYPE_COLOR = {
  SWAP_BG:        'bg-accent',
  SWAP_LOGO:      'bg-accent',
  FADE_TO_BLACK:  'bg-text-muted',
  FADE_FROM_BLACK:'bg-text-muted',
  CUT_TO_BLACK:   'bg-text-muted',
  CUT_FROM_BLACK: 'bg-text-muted',
  PLAY_AUDIO:     'bg-status-live',
  SET_LABEL:      'bg-status-info',
  SET_OVERLAY:    'bg-status-info',
  TOGGLE_EFFECT:  'bg-purple-400',
  FLASH_SCREEN:   'bg-status-danger',
};

function fmtMM(secs) {
  const m = Math.floor(Math.abs(secs) / 60);
  const s = Math.abs(secs) % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// Accepts "MM:SS", "M:SS", or a plain integer (seconds)
function parseInput(raw) {
  const str = String(raw).trim();
  if (!str) return -1;
  if (str.includes(':')) {
    const parts = str.split(':');
    const m = parseInt(parts[0], 10) || 0;
    const s = parseInt(parts[1], 10) || 0;
    return m * 60 + s;
  }
  const n = parseInt(str, 10);
  return isNaN(n) ? -1 : n;
}

// ── Single editable cue row ───────────────────────────────────────────────────
function CueRow({ cue, onEdit, onDelete, onUpdateTime }) {
  const [editing, setEditing] = useState(false);
  const [raw,     setRaw]     = useState(fmtMM(cue.trigger_at));
  const inputRef              = useRef(null);

  const barColor = TYPE_COLOR[cue.actions?.[0]?.type] ?? 'bg-text-muted';

  function commit() {
    const secs = parseInput(raw);
    if (secs >= 0) onUpdateTime(secs);
    else setRaw(fmtMM(cue.trigger_at)); // revert on invalid
    setEditing(false);
  }

  function startEdit() {
    setRaw(fmtMM(cue.trigger_at));
    setEditing(true);
    // focus after render
    setTimeout(() => inputRef.current?.select(), 0);
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border-subtle hover:bg-surface-elevated group transition-colors">
      {/* Type colour bar */}
      <div className={`w-1 h-5 rounded-full shrink-0 ${barColor}`} />

      {/* Trigger time — click to edit inline */}
      {editing ? (
        <input
          ref={inputRef}
          value={raw}
          onChange={e => setRaw(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter')  commit();
            if (e.key === 'Escape') { setRaw(fmtMM(cue.trigger_at)); setEditing(false); }
          }}
          className="
            w-[4.5rem] px-1.5 py-0.5 rounded text-xs font-mono text-center
            bg-surface-overlay border border-accent text-text-primary
            focus:outline-none shrink-0
          "
          placeholder="MM:SS"
          autoFocus
        />
      ) : (
        <button
          type="button"
          onClick={startEdit}
          title="Click to change trigger time"
          className="
            w-[4.5rem] px-1.5 py-0.5 rounded text-xs font-mono text-center shrink-0
            text-accent hover:bg-accent/10 transition-colors
          "
        >
          {fmtMM(cue.trigger_at)}
        </button>
      )}

      {/* Label */}
      <span className="flex-1 text-xs text-text-primary truncate min-w-0" title={cue.label}>
        {cue.label}
      </span>

      {/* Actions count badge */}
      {cue.actions?.length > 0 && (
        <span className="text-[10px] text-text-muted shrink-0 tabular-nums">
          {cue.actions.length}✦
        </span>
      )}

      {/* Row controls — visible on hover */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          type="button"
          onClick={() => onEdit(cue)}
          className="text-[10px] px-1.5 py-0.5 rounded bg-surface-overlay hover:bg-surface-overlay text-text-secondary hover:text-text-primary transition-colors"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(cue.id)}
          className="text-[10px] px-1 py-0.5 rounded text-status-danger/70 hover:text-status-danger hover:bg-status-danger/10 transition-colors"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// ── Main CueList ──────────────────────────────────────────────────────────────
export function CueList({ cues, onEdit, onDelete, onUpdateTime, onCreate }) {
  const total = useTimerStore(s => s.total);

  const [timeInput,  setTimeInput]  = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [error,      setError]      = useState('');

  const sorted = [...cues].sort((a, b) => b.trigger_at - a.trigger_at);

  function handleAdd() {
    const secs = parseInput(timeInput);
    if (secs < 0) { setError('Enter MM:SS or seconds'); return; }
    if (total > 0 && secs > total) { setError(`Max ${fmtMM(total)}`); return; }
    setError('');
    onCreate(secs, labelInput.trim() || 'New Cue');
    setTimeInput('');
    setLabelInput('');
  }

  return (
    <div className="flex flex-col min-h-0 border-t border-border-subtle bg-surface-raised">

      {/* ── Quick-add bar ─────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-surface-elevated border-b border-border-subtle">
        <div className="flex flex-col">
          <input
            type="text"
            value={timeInput}
            onChange={e => { setTimeInput(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="MM:SS"
            className="
              w-[4.5rem] px-2 py-1 rounded text-xs font-mono text-center
              bg-surface-overlay border border-border-default
              text-text-primary placeholder:text-text-disabled
              focus:border-accent focus:outline-none
            "
          />
          {error && <span className="text-[9px] text-status-danger mt-0.5">{error}</span>}
        </div>

        <input
          type="text"
          value={labelInput}
          onChange={e => setLabelInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Cue label (optional)"
          className="
            flex-1 px-2 py-1 rounded text-xs
            bg-surface-overlay border border-border-default
            text-text-primary placeholder:text-text-disabled
            focus:border-accent focus:outline-none
          "
        />

        <button
          type="button"
          onClick={handleAdd}
          className="
            shrink-0 px-3 py-1 rounded text-xs font-medium
            bg-accent text-surface-base hover:bg-accent-hover transition-colors
          "
        >
          + Add
        </button>
      </div>

      {/* ── Cue rows (sorted by time descending — start at top) ────────────── */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <p className="text-xs text-text-muted text-center py-6">
            No cues yet — type a time above or click the timeline.
          </p>
        ) : (
          <>
            {/* Column header */}
            <div className="flex items-center gap-2 px-3 py-1 bg-surface-base border-b border-border-subtle">
              <div className="w-1 shrink-0" />
              <span className="w-[4.5rem] text-[9px] text-text-muted uppercase tracking-wider shrink-0">Time</span>
              <span className="flex-1 text-[9px] text-text-muted uppercase tracking-wider">Label</span>
              <span className="text-[9px] text-text-muted uppercase tracking-wider mr-16">Act.</span>
            </div>
            {sorted.map(cue => (
              <CueRow
                key={cue.id}
                cue={cue}
                onEdit={onEdit}
                onDelete={onDelete}
                onUpdateTime={secs => onUpdateTime(cue.id, secs)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
