import { useEffect, useState } from 'react';
import { useMediaStore }    from '../../stores/mediaStore.js';
import { Button }           from '../shared/Button.jsx';
import { Slider }           from '../shared/Slider.jsx';
import { ColorPicker }      from '../shared/ColorPicker.jsx';

// ── Constants ─────────────────────────────────────────────────────────────────
const ACTION_TYPES = [
  // ── Background ──────────────────────────────────────────
  { value: 'SWAP_BG',         label: 'Swap Background'  },
  // ── Transitions ─────────────────────────────────────────
  { value: 'FADE_TO_BLACK',   label: 'Fade to Black'    },
  { value: 'FADE_FROM_BLACK', label: 'Fade from Black'  },
  { value: 'CUT_TO_BLACK',    label: 'Cut to Black'     },
  { value: 'CUT_FROM_BLACK',  label: 'Cut from Black'   },
  // ── Media ────────────────────────────────────────────────
  { value: 'PLAY_AUDIO',      label: 'Play Audio'       },
  // ── Text ────────────────────────────────────────────────
  { value: 'SET_LABEL',       label: 'Set Label'        },
  { value: 'SET_OVERLAY',     label: 'Set Overlay'      },
  // ── Logo ─────────────────────────────────────────────────
  { value: 'SWAP_LOGO',       label: 'Swap Logo'        },
  { value: 'SHOW_LOGO',       label: 'Show Logo'        },
  { value: 'HIDE_LOGO',       label: 'Hide Logo'        },
  // ── Solid BG ─────────────────────────────────────────────
  { value: 'SET_BG_COLOR',    label: 'Set BG Color'     },
  // ── Slideshow ────────────────────────────────────────────
  { value: 'SLIDESHOW_NEXT',  label: 'Slideshow → Next' },
  { value: 'SLIDESHOW_PREV',  label: 'Slideshow ← Prev' },
  // ── Timer ────────────────────────────────────────────────
  { value: 'TIMER_PLAY',      label: 'Timer Play'       },
  { value: 'TIMER_PAUSE',     label: 'Timer Pause'      },
  // ── Effects ──────────────────────────────────────────────
  { value: 'ZOOM_IN',         label: 'Zoom In (ease)'   },
  { value: 'TOGGLE_EFFECT',   label: 'Toggle Effect'    },
  { value: 'FLASH_SCREEN',    label: 'Flash Screen'     },
];

function defaultPayload(type) {
  switch (type) {
    case 'SWAP_BG':         return { assetId: null };
    case 'FADE_TO_BLACK':   return { duration: 1500, color: '#000000' };
    case 'FADE_FROM_BLACK': return { duration: 1500 };
    case 'CUT_TO_BLACK':    return { color: '#000000' };
    case 'CUT_FROM_BLACK':  return {};
    case 'PLAY_AUDIO':      return { assetId: null, volume: 80 };
    case 'SET_LABEL':       return { main: '', sub: '' };
    case 'SET_OVERLAY':     return { text: '', color: '#000000', opacity: 60 };
    case 'SWAP_LOGO':       return { assetId: null, position: 'top-right', size: 80 };
    case 'ZOOM_IN':         return { scale: 1.8, duration: 1500 };
    case 'SHOW_LOGO':       return {};
    case 'HIDE_LOGO':       return {};
    case 'SET_BG_COLOR':    return { color: '#181614' };
    case 'SLIDESHOW_NEXT':  return {};
    case 'SLIDESHOW_PREV':  return {};
    case 'TIMER_PLAY':      return {};
    case 'TIMER_PAUSE':     return {};
    case 'TOGGLE_EFFECT':   return { effect: 'vignette', enabled: true };
    case 'FLASH_SCREEN':    return { color: '#ffffff', duration: 500 };
    default:                return {};
  }
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function TextInput({ value, onChange, placeholder, className = '' }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`
        w-full px-2 py-1 rounded text-xs bg-surface-overlay border border-border-default
        text-text-primary placeholder:text-text-disabled focus:border-accent focus:outline-none
        ${className}
      `}
    />
  );
}

function Select({ value, onChange, options, className = '' }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`
        px-2 py-1 rounded text-xs bg-surface-overlay border border-border-default
        text-text-primary focus:border-accent focus:outline-none cursor-pointer ${className}
      `}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function AssetMiniPicker({ value, assets, onChange }) {
  if (!assets.length) {
    return <p className="text-[11px] text-text-muted">No assets uploaded</p>;
  }
  return (
    <div className="grid grid-cols-4 gap-1">
      {assets.map(a => (
        <button
          key={a.id}
          type="button"
          onClick={() => onChange(a.id)}
          title={a.name}
          className={`aspect-square rounded overflow-hidden border-2 transition-colors
            ${value === a.id ? 'border-accent' : 'border-transparent hover:border-border-strong'}`}
        >
          {a.thumbnailUrl
            ? <img src={a.thumbnailUrl} className="w-full h-full object-cover" alt="" />
            : <div className="w-full h-full bg-surface-overlay flex items-center justify-center text-[8px] text-text-muted px-0.5 truncate">{a.name}</div>
          }
        </button>
      ))}
    </div>
  );
}

const LOGO_POS = [
  ['top-left','↖'],['top-center','↑'],['top-right','↗'],
  ['bottom-left','↙'],['bottom-center','↓'],['bottom-right','↘'],
];

function MiniPositionGrid({ value, onChange }) {
  return (
    <div className="inline-grid grid-cols-3 gap-0.5">
      {LOGO_POS.map(([pos, icon]) => (
        <button
          key={pos}
          type="button"
          onClick={() => onChange(pos)}
          className={`w-7 h-7 text-sm rounded border transition-colors
            ${value === pos ? 'border-accent text-accent bg-accent/10' : 'border-border-default text-text-muted hover:border-border-strong'}`}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

// ── Per-type payload fields ───────────────────────────────────────────────────
function PayloadFields({ type, payload, onChange, allAssets }) {
  const set = (key, val) => onChange({ ...payload, [key]: val });

  switch (type) {
    case 'FADE_TO_BLACK':
      return (
        <div className="space-y-2">
          <ColorPicker label="Color" value={payload.color ?? '#000000'} onChange={v => set('color', v)} />
          <Slider label="Duration" value={payload.duration ?? 1500} onChange={v => set('duration', v)} min={100} max={8000} step={100} unit="ms" />
        </div>
      );
    case 'FADE_FROM_BLACK':
      return (
        <Slider label="Duration" value={payload.duration ?? 1500} onChange={v => set('duration', v)} min={100} max={8000} step={100} unit="ms" />
      );
    case 'CUT_TO_BLACK':
      return <ColorPicker label="Color" value={payload.color ?? '#000000'} onChange={v => set('color', v)} />;
    case 'CUT_FROM_BLACK':
      return <p className="text-[11px] text-text-muted">Instantly reveals the scene — no options.</p>;
    case 'SHOW_LOGO':
    case 'HIDE_LOGO':
    case 'SLIDESHOW_NEXT':
    case 'SLIDESHOW_PREV':
    case 'TIMER_PLAY':
    case 'TIMER_PAUSE':
      return <p className="text-[11px] text-text-muted">No additional options.</p>;
    case 'SET_BG_COLOR':
      return <ColorPicker label="Color" value={payload.color ?? '#181614'} onChange={v => set('color', v)} />;
    case 'ZOOM_IN':
      return (
        <div className="space-y-2">
          <Slider
            label="Start scale"
            value={Math.round((payload.scale ?? 1.8) * 10) / 10}
            onChange={v => set('scale', v)}
            min={1.1} max={4.0} step={0.1}
            unit="×"
          />
          <Slider
            label="Duration"
            value={payload.duration ?? 1500}
            onChange={v => set('duration', v)}
            min={200} max={30000} step={200}
            unit="ms"
          />
        </div>
      );
    case 'SWAP_BG':
      return (
        <AssetMiniPicker
          value={payload.assetId}
          onChange={id => set('assetId', id)}
          assets={allAssets.filter(a => a.type === 'image' || a.type === 'video')}
        />
      );

    case 'PLAY_AUDIO':
      return (
        <div className="space-y-2">
          <AssetMiniPicker
            value={payload.assetId}
            onChange={id => set('assetId', id)}
            assets={allAssets.filter(a => a.type === 'audio')}
          />
          <Slider label="Volume" value={payload.volume ?? 80} onChange={v => set('volume', v)} unit="%" />
        </div>
      );

    case 'SET_LABEL':
      return (
        <div className="space-y-1.5">
          <TextInput placeholder="Main label" value={payload.main ?? ''} onChange={v => set('main', v)} />
          <TextInput placeholder="Sub label"  value={payload.sub  ?? ''} onChange={v => set('sub',  v)} />
        </div>
      );

    case 'SET_OVERLAY':
      return (
        <div className="space-y-2">
          <TextInput placeholder="Overlay text" value={payload.text ?? ''} onChange={v => set('text', v)} />
          <ColorPicker label="Color" value={payload.color ?? '#000000'} onChange={v => set('color', v)} />
          <Slider label="Opacity" value={payload.opacity ?? 60} onChange={v => set('opacity', v)} unit="%" />
        </div>
      );

    case 'SWAP_LOGO':
      return (
        <div className="space-y-2">
          <AssetMiniPicker
            value={payload.assetId}
            onChange={id => set('assetId', id)}
            assets={allAssets.filter(a => a.type === 'image')}
          />
          <MiniPositionGrid value={payload.position ?? 'top-right'} onChange={v => set('position', v)} />
          <Slider label="Size" value={payload.size ?? 80} onChange={v => set('size', v)} min={20} max={240} step={4} unit="px" />
        </div>
      );

    case 'TOGGLE_EFFECT':
      return (
        <div className="flex items-center gap-2">
          <Select
            value={payload.effect ?? 'vignette'}
            onChange={v => set('effect', v)}
            options={[
              { value: 'vignette',   label: 'Vignette'    },
              { value: 'scanlines',  label: 'Scanlines'   },
              { value: 'blink',      label: 'Blink Sep.'  },
              { value: 'flash',      label: 'Warn Flash'  },
            ]}
            className="flex-1"
          />
          <label className="flex items-center gap-1 text-xs text-text-secondary cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={payload.enabled ?? true}
              onChange={e => set('enabled', e.target.checked)}
              className="accent-accent"
            />
            On
          </label>
        </div>
      );

    case 'FLASH_SCREEN':
      return (
        <div className="space-y-2">
          <ColorPicker label="Color" value={payload.color ?? '#ffffff'} onChange={v => set('color', v)} />
          <Slider label="Duration" value={payload.duration ?? 500} onChange={v => set('duration', v)} min={50} max={5000} step={50} unit="ms" />
        </div>
      );

    default: return null;
  }
}

// ── Trigger time MM:SS input ──────────────────────────────────────────────────
function TriggerInput({ value, onChange }) {
  const toStr = (s) => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
  const [raw, setRaw] = useState(() => toStr(value));

  useEffect(() => { setRaw(toStr(value)); }, [value]);

  const commit = () => {
    const [mm = '0', ss = '0'] = raw.split(':');
    const secs = (parseInt(mm, 10) || 0) * 60 + (parseInt(ss, 10) || 0);
    onChange(secs);
  };

  return (
    <input
      type="text"
      value={raw}
      onChange={e => setRaw(e.target.value)}
      onBlur={commit}
      onKeyDown={e => e.key === 'Enter' && commit()}
      placeholder="MM:SS"
      className="
        w-20 px-2 py-1 rounded text-sm font-mono text-center
        bg-surface-overlay border border-border-default
        text-text-primary focus:border-accent focus:outline-none
      "
    />
  );
}

// ── Main editor ───────────────────────────────────────────────────────────────
export function CueEditor({ cue, onSave, onDelete, onClose, saving = false }) {
  const assetsById = useMediaStore(s => s.assets);            // stable ref
  const allAssets  = Object.values(assetsById);               // transform in render

  const [label,     setLabel]     = useState(cue?.label     ?? '');
  const [triggerAt, setTriggerAt] = useState(cue?.trigger_at ?? 0);
  const [actions,   setActions]   = useState(cue?.actions   ?? []);

  // Reset form when cue changes
  useEffect(() => {
    if (!cue) return;
    setLabel(cue.label);
    setTriggerAt(cue.trigger_at);
    setActions(cue.actions ?? []);
  }, [cue?.id]);

  const addAction = () =>
    setActions(prev => [...prev, { type: 'SET_LABEL', payload: defaultPayload('SET_LABEL') }]);

  const removeAction = (idx) =>
    setActions(prev => prev.filter((_, i) => i !== idx));

  const updateActionType = (idx, type) =>
    setActions(prev => prev.map((a, i) => i === idx ? { type, payload: defaultPayload(type) } : a));

  const updateActionPayload = (idx, payload) =>
    setActions(prev => prev.map((a, i) => i === idx ? { ...a, payload } : a));

  const handleSave = () =>
    onSave(cue.id, { label, trigger_at: triggerAt, actions });

  if (!cue) return null;

  return (
    <div className="
      absolute right-0 inset-y-0 w-80 z-20 flex flex-col
      bg-surface-raised border-l border-border-subtle shadow-2xl
      animate-slide-from-right
    ">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="text-text-muted hover:text-text-primary transition-colors mr-1"
          title="Close"
        >
          ✕
        </button>
        <input
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Cue label…"
          className="
            flex-1 bg-transparent text-sm font-semibold text-text-primary
            border-b border-transparent focus:border-accent focus:outline-none pb-0.5
          "
        />
        <TriggerInput value={triggerAt} onChange={setTriggerAt} />
      </div>

      {/* Actions list — scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <p className="text-[10px] text-text-muted uppercase tracking-widest">Actions</p>

        {actions.length === 0 && (
          <p className="text-xs text-text-muted text-center py-4">
            No actions yet — add one below.
          </p>
        )}

        {actions.map((action, idx) => (
          <div
            key={idx}
            className="rounded-md border border-border-default bg-surface-elevated p-3 space-y-2"
          >
            {/* Type row */}
            <div className="flex items-center gap-2">
              <Select
                value={action.type}
                onChange={type => updateActionType(idx, type)}
                options={ACTION_TYPES}
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => removeAction(idx)}
                className="text-text-muted hover:text-status-danger transition-colors text-lg leading-none shrink-0"
                title="Remove action"
              >
                ✕
              </button>
            </div>

            {/* Dynamic payload fields */}
            <PayloadFields
              type={action.type}
              payload={action.payload ?? {}}
              onChange={payload => updateActionPayload(idx, payload)}
              allAssets={allAssets}
            />
          </div>
        ))}

        <Button
          variant="ghost"
          size="sm"
          onClick={addAction}
          className="w-full border border-dashed border-border-default hover:border-accent"
        >
          + Add Action
        </Button>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-border-subtle shrink-0">
        <Button
          variant="danger"
          size="sm"
          onClick={() => onDelete(cue.id)}
          disabled={saving}
        >
          Delete
        </Button>
        <div className="flex-1" />
        <Button
          variant="primary"
          size="md"
          onClick={handleSave}
          disabled={saving || !label.trim()}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
