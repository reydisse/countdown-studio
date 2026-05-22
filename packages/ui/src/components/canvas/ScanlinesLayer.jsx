import { useSettingsStore } from '../../stores/settingsStore.js';

export function ScanlinesLayer() {
  const scanlinesEnabled   = useSettingsStore(s => s.scanlinesEnabled);
  const scanlinesIntensity = useSettingsStore(s => s.scanlinesIntensity);

  if (!scanlinesEnabled) return null;

  const alpha = (scanlinesIntensity / 100) * 0.6;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: `repeating-linear-gradient(
          0deg,
          rgba(0,0,0,${alpha}) 0px, rgba(0,0,0,${alpha}) 1px,
          transparent 1px, transparent 3px
        )`,
        zIndex: 7,
      }}
    />
  );
}
