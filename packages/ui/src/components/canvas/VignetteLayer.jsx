import { useSettingsStore } from '../../stores/settingsStore.js';

export function VignetteLayer() {
  const vignetteEnabled   = useSettingsStore(s => s.vignetteEnabled);
  const vignetteIntensity = useSettingsStore(s => s.vignetteIntensity);

  if (!vignetteEnabled) return null;

  const alpha = (vignetteIntensity / 100) * 0.85;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background: `radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,${alpha}) 100%)`,
        zIndex: 6,
      }}
    />
  );
}
