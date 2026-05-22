import { useEffect, useState } from 'react';
import { useSettingsStore } from '../../stores/settingsStore.js';

export function FlashLayer() {
  const _flashCount = useSettingsStore(s => s._flashCount);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (_flashCount === 0) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 250);
    return () => clearTimeout(t);
  }, [_flashCount]);

  if (!visible) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background: 'rgba(255,255,255,0.35)',
        zIndex:     5,
        animation:  'flash-pulse 250ms ease-out forwards',
      }}
    />
  );
}
