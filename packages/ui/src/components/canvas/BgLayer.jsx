import { useSettingsStore } from '../../stores/settingsStore.js';

export function BgLayer() {
  const bgColor = useSettingsStore(s => s.bgColor);
  // Always renders — acts as the base fallback behind all other layers.
  return <div className="absolute inset-0" style={{ background: bgColor }} />;
}
