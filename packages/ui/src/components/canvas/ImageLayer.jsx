import { useSettingsStore } from '../../stores/settingsStore.js';
import { useMediaStore }    from '../../stores/mediaStore.js';

export function ImageLayer() {
  const bgMode    = useSettingsStore(s => s.bgMode);
  const bgAssetId = useSettingsStore(s => s.bgAssetId);
  const imageSize = useSettingsStore(s => s.imageSize);
  const asset = useMediaStore(s => s.assets[bgAssetId]);

  if (bgMode !== 'image' || !asset?.url) return null;

  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundImage:    `url(${asset.url})`,
        backgroundSize:     imageSize,
        backgroundPosition: 'center',
        backgroundRepeat:   'no-repeat',
      }}
    />
  );
}
