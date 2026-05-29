import { useState } from 'react';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { useMediaStore }    from '../../stores/mediaStore.js';
import { SidebarSection }   from './SidebarSection.jsx';
import { Button }           from '../shared/Button.jsx';
import { Slider }           from '../shared/Slider.jsx';
import { openFilePicker } from '../../adapter/index.js';

const POSITIONS = [
  { value: 'top-left',      label: '↖' },
  { value: 'top-center',    label: '↑' },
  { value: 'top-right',     label: '↗' },
  { value: 'bottom-left',   label: '↙' },
  { value: 'bottom-center', label: '↓' },
  { value: 'bottom-right',  label: '↘' },
];

export function LogoPanel() {
  const logoAssetId  = useSettingsStore(s => s.logoAssetId);
  const logoPosition = useSettingsStore(s => s.logoPosition);
  const logoSize     = useSettingsStore(s => s.logoSize);
  const update       = useSettingsStore(s => s.update);
  const asset   = useMediaStore(s => s.assets[logoAssetId]);
  const [loading, setLoading] = useState(false);

  const uploadLogo = async () => {
    setLoading(true);
    try {
      const files = await openFilePicker({ accept: 'image/*', multiple: false });
      if (!files.length) return;
      const a = await useMediaStore.getState().upload(files[0]);
      update({ logoAssetId: a.id });
    } finally { setLoading(false); }
  };

  return (
    <SidebarSection title="Logo" defaultOpen={false}>
      <div className="flex gap-2">
        <Button size="sm" onClick={uploadLogo} disabled={loading} className="flex-1">
          {loading ? 'Uploading…' : asset ? 'Replace' : '+ Upload Logo'}
        </Button>
        {logoAssetId && (
          <Button size="sm" variant="danger" onClick={() => update({ logoAssetId: null })}>
            Remove
          </Button>
        )}
      </div>

      {asset && (
        <div className="h-12 rounded border border-border-default overflow-hidden bg-surface-elevated flex items-center justify-center">
          <img src={asset.thumbnailUrl ?? asset.url} alt="logo preview" className="max-h-full max-w-full object-contain" />
        </div>
      )}

      {/* Position grid */}
      <div>
        <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">Position</p>
        <div className="grid grid-cols-3 gap-1">
          {POSITIONS.map(p => (
            <button
              key={p.value}
              type="button"
              onClick={() => update({ logoPosition: p.value })}
              className={`
                py-2 text-base rounded border transition-colors
                ${logoPosition === p.value
                  ? 'border-accent text-accent bg-accent/10'
                  : 'border-border-default text-text-muted hover:border-border-strong'}
              `}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <Slider
        label="Size"
        value={logoSize}
        onChange={v => update({ logoSize: v })}
        min={20} max={240} step={4} unit="px"
      />
    </SidebarSection>
  );
}
