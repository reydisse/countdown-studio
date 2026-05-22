import { useState } from 'react';
import { useTimerStore }    from '../../stores/timerStore.js';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { SidebarSection }   from './SidebarSection.jsx';
import { Button }           from '../shared/Button.jsx';
import { TabGroup }         from '../shared/TabGroup.jsx';

const END_OPTS = [
  { value: 'hold',    label: 'Hold'    },
  { value: 'fadeout', label: 'Fade Out' },
  { value: 'loop',    label: 'Loop'    },
];

const PRESETS = [
  { label: '5m',  s: 300  },
  { label: '10m', s: 600  },
  { label: '15m', s: 900  },
  { label: '20m', s: 1200 },
  { label: '30m', s: 1800 },
  { label: '1h',  s: 3600 },
];

function toHMS(secs) {
  return {
    h: Math.floor(secs / 3600),
    m: Math.floor((secs % 3600) / 60),
    s: secs % 60,
  };
}

function fromHMS(h, m, s) {
  return (Number(h) * 3600) + (Number(m) * 60) + Number(s);
}

function NumInput({ value, onChange, max = 59, label }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] text-text-muted uppercase tracking-wider">{label}</span>
      <input
        type="number"
        min={0}
        max={max}
        value={String(value).padStart(2, '0')}
        onChange={e => onChange(Math.min(max, Math.max(0, Number(e.target.value))))}
        className="
          w-14 text-center py-2 rounded-md text-lg font-display
          bg-surface-elevated border border-border-default
          text-text-primary focus:border-accent focus:outline-none
          [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none
        "
      />
    </div>
  );
}

export function TimerPanel() {
  const total       = useTimerStore(s => s.total);
  const setTime     = useTimerStore(s => s.setTime);
  const labelMain   = useSettingsStore(s => s.labelMain);
  const labelSub    = useSettingsStore(s => s.labelSub);
  const endBehavior = useSettingsStore(s => s.endBehavior);
  const update      = useSettingsStore(s => s.update);

  const { h, m, s } = toHMS(total);
  const [lh, setH] = useState(h);
  const [lm, setM] = useState(m);
  const [ls, setS] = useState(s);

  const apply = () => setTime(fromHMS(lh, lm, ls));

  return (
    <SidebarSection title="Timer" defaultOpen>
      {/* Time inputs */}
      <div className="flex items-end justify-center gap-1.5">
        <NumInput value={lh} onChange={setH} max={23} label="HH" />
        <span className="text-2xl text-text-muted pb-2 font-display">:</span>
        <NumInput value={lm} onChange={setM} max={59} label="MM" />
        <span className="text-2xl text-text-muted pb-2 font-display">:</span>
        <NumInput value={ls} onChange={setS} max={59} label="SS" />
      </div>

      <Button variant="primary" size="md" className="w-full" onClick={apply}>
        Set Time
      </Button>

      {/* Presets */}
      <div>
        <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">Presets</p>
        <div className="grid grid-cols-3 gap-1">
          {PRESETS.map(p => (
            <Button
              key={p.s}
              size="sm"
              onClick={() => { setTime(p.s); const { h, m, s } = toHMS(p.s); setH(h); setM(m); setS(s); }}
              className="font-mono"
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Labels */}
      <div className="space-y-2 pt-1 border-t border-border-subtle">
        <p className="text-[10px] text-text-muted uppercase tracking-wider">Labels</p>
        <input
          type="text"
          placeholder="Main label (e.g. Session starts in)"
          value={labelMain}
          onChange={e => update({ labelMain: e.target.value })}
          className="
            w-full px-2.5 py-1.5 rounded-md text-sm
            bg-surface-elevated border border-border-default
            text-text-primary placeholder:text-text-disabled
            focus:border-accent focus:outline-none
          "
        />
        <input
          type="text"
          placeholder="Sub label (e.g. Room A)"
          value={labelSub}
          onChange={e => update({ labelSub: e.target.value })}
          className="
            w-full px-2.5 py-1.5 rounded-md text-sm
            bg-surface-elevated border border-border-default
            text-text-primary placeholder:text-text-disabled
            focus:border-accent focus:outline-none
          "
        />
      </div>

      {/* End controls */}
      <div className="space-y-2 pt-1 border-t border-border-subtle">
        <p className="text-[10px] text-text-muted uppercase tracking-wider">When timer ends</p>
        <TabGroup
          tabs={END_OPTS}
          value={endBehavior ?? 'hold'}
          onChange={v => update({ endBehavior: v })}
          size="sm"
        />
        {endBehavior === 'fadeout' && (
          <p className="text-[10px] text-text-muted">Output fades to black over 1.5 s.</p>
        )}
        {endBehavior === 'loop' && (
          <p className="text-[10px] text-text-muted">Timer resets and restarts automatically.</p>
        )}
      </div>
    </SidebarSection>
  );
}
