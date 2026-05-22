import { useSettingsStore } from '../../stores/settingsStore.js';
import { useMediaStore }    from '../../stores/mediaStore.js';

const POSITION_CLASSES = {
  'top-left':      'top-[4%] left-[3%]',
  'top-center':    'top-[4%] left-1/2 -translate-x-1/2',
  'top-right':     'top-[4%] right-[3%]',
  'bottom-left':   'bottom-[4%] left-[3%]',
  'bottom-center': 'bottom-[4%] left-1/2 -translate-x-1/2',
  'bottom-right':  'bottom-[4%] right-[3%]',
};

export function LogoLayer() {
  const logoAssetId  = useSettingsStore(s => s.logoAssetId);
  const logoPosition = useSettingsStore(s => s.logoPosition);
  const logoSize     = useSettingsStore(s => s.logoSize);
  const logoVisible  = useSettingsStore(s => s.logoVisible ?? true);
  const asset = useMediaStore(s => s.assets[logoAssetId]);

  if (!logoAssetId || !asset?.url || !logoVisible) return null;

  const posClass = POSITION_CLASSES[logoPosition] ?? POSITION_CLASSES['top-right'];

  return (
    <div
      className={`absolute pointer-events-none ${posClass}`}
      style={{ zIndex: 8 }}
    >
      <img
        src={asset.url}
        alt="logo"
        style={{ width: logoSize, height: 'auto', maxHeight: logoSize * 1.5 }}
        className="object-contain drop-shadow-lg"
        draggable={false}
      />
    </div>
  );
}
