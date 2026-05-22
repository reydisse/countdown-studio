import { useSettingsStore } from '../../stores/settingsStore.js';
import { SidebarSection }   from './SidebarSection.jsx';
import { Switch }           from '../ui/switch.jsx';
import { Slider }           from '../ui/slider.jsx';
import { Label }            from '../ui/label.jsx';

function EffectRow({ label, checked, onCheckedChange, children }) {
  const id = `fx-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="cursor-pointer">{label}</Label>
        <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      </div>
      {checked && children}
    </div>
  );
}

export function EffectsPanel() {
  const vignetteEnabled    = useSettingsStore(s => s.vignetteEnabled);
  const vignetteIntensity  = useSettingsStore(s => s.vignetteIntensity);
  const scanlinesEnabled   = useSettingsStore(s => s.scanlinesEnabled);
  const scanlinesIntensity = useSettingsStore(s => s.scanlinesIntensity);
  const blinkSeparator     = useSettingsStore(s => s.blinkSeparator);
  const warnFlashEnabled   = useSettingsStore(s => s.warnFlashEnabled);
  const warnThreshold      = useSettingsStore(s => s.warnThreshold);
  const dangerThreshold    = useSettingsStore(s => s.dangerThreshold);
  const update             = useSettingsStore(s => s.update);

  return (
    <SidebarSection title="Effects" defaultOpen={false}>
      <EffectRow
        label="Vignette"
        checked={vignetteEnabled}
        onCheckedChange={v => update({ vignetteEnabled: v })}
      >
        <Slider
          label="Intensity" unit="%"
          value={[vignetteIntensity]} min={5} max={100}
          onValueChange={([v]) => update({ vignetteIntensity: v })}
        />
      </EffectRow>

      <EffectRow
        label="Scanlines"
        checked={scanlinesEnabled}
        onCheckedChange={v => update({ scanlinesEnabled: v })}
      >
        <Slider
          label="Intensity" unit="%"
          value={[scanlinesIntensity]} min={5} max={100}
          onValueChange={([v]) => update({ scanlinesIntensity: v })}
        />
      </EffectRow>

      <EffectRow
        label="Blink separator"
        checked={blinkSeparator}
        onCheckedChange={v => update({ blinkSeparator: v })}
      />

      <EffectRow
        label="Warn flash"
        checked={warnFlashEnabled}
        onCheckedChange={v => update({ warnFlashEnabled: v })}
      >
        <div className="space-y-2">
          <Slider
            label="Warn at" unit="s"
            value={[warnThreshold]} min={5} max={120} step={5}
            onValueChange={([v]) => update({ warnThreshold: v })}
          />
          <Slider
            label="Danger at" unit="s"
            value={[dangerThreshold]} min={3} max={30}
            onValueChange={([v]) => update({ dangerThreshold: v })}
          />
        </div>
      </EffectRow>
    </SidebarSection>
  );
}
