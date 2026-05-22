import { useSettingsStore } from '../../stores/settingsStore.js';

export function OverlayLayer() {
  const overlayEnabled = useSettingsStore(s => s.overlayEnabled);
  const overlayText    = useSettingsStore(s => s.overlayText);
  const font           = useSettingsStore(s => s.font);

  if (!overlayEnabled || !overlayText) return null;

  const fontFamily = {
    display: '"Bebas Neue", sans-serif',
    sans:    '"DM Sans", sans-serif',
    mono:    '"JetBrains Mono", monospace',
  }[font] ?? '"DM Sans", sans-serif';

  return (
    <div
      className="absolute inset-0 flex items-end justify-center pb-[8%]"
      style={{ zIndex: 4 }}
    >
      <div
        className="px-6 py-3 rounded text-white text-center max-w-[80%]"
        style={{
          fontFamily,
          fontSize:   'clamp(1rem, 3vw, 2.5rem)',
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          textShadow: '0 1px 3px rgba(0,0,0,0.6)',
        }}
      >
        {overlayText}
      </div>
    </div>
  );
}
