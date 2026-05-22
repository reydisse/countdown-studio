import { useSettingsStore } from '../../stores/settingsStore.js';
import { SidebarSection }   from './SidebarSection.jsx';
import { ColorPicker }      from '../shared/ColorPicker.jsx';
import { Slider }           from '../shared/Slider.jsx';

const FONTS = [
  { value: 'display', label: 'Bebas Neue', sample: 'DISPLAY' },
  { value: 'sans',    label: 'DM Sans',    sample: 'Sans'    },
  { value: 'mono',    label: 'JetBrains',  sample: '00:00'   },
];

const FONT_FAMILY = {
  display: '"Bebas Neue", sans-serif',
  sans:    '"DM Sans", sans-serif',
  mono:    '"JetBrains Mono", monospace',
};

export function TypographyPanel() {
  const font      = useSettingsStore(s => s.font);
  const textColor = useSettingsStore(s => s.textColor);
  const textSize  = useSettingsStore(s => s.textSize);
  const update    = useSettingsStore(s => s.update);

  return (
    <SidebarSection title="Typography" defaultOpen={false}>
      {/* Font presets */}
      <div>
        <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">Font</p>
        <div className="space-y-1">
          {FONTS.map(f => (
            <button
              key={f.value}
              type="button"
              onClick={() => update({ font: f.value })}
              className={`
                w-full flex items-center justify-between px-3 py-2.5 rounded border text-left
                transition-colors
                ${font === f.value
                  ? 'border-accent bg-accent/10'
                  : 'border-border-default hover:border-border-strong'}
              `}
            >
              <span className="text-xs text-text-secondary">{f.label}</span>
              <span
                className={`text-lg leading-none ${font === f.value ? 'text-accent' : 'text-text-primary'}`}
                style={{ fontFamily: FONT_FAMILY[f.value] }}
              >
                {f.sample}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Color */}
      <ColorPicker
        label="Color"
        value={textColor}
        onChange={v => update({ textColor: v })}
      />

      {/* Quick color presets */}
      <div className="flex gap-1.5">
        {['#f0ede8','#e8a838','#34d48a','#f5464a','#38bdf8','#ffffff'].map(c => (
          <button
            key={c}
            type="button"
            onClick={() => update({ textColor: c })}
            className={`w-6 h-6 rounded border-2 transition-colors ${textColor === c ? 'border-accent' : 'border-transparent hover:border-border-strong'}`}
            style={{ background: c }}
          />
        ))}
      </div>

      {/* Size */}
      <Slider
        label="Size"
        value={textSize}
        onChange={v => update({ textSize: v })}
        min={50} max={150} step={5} unit="%"
      />
    </SidebarSection>
  );
}
