import { useSettingsStore } from '../../stores/settingsStore.js';
import { useMediaStore }    from '../../stores/mediaStore.js';

export function VideoLayer() {
  const bgMode     = useSettingsStore(s => s.bgMode);
  const bgAssetId  = useSettingsStore(s => s.bgAssetId);
  const videoMuted = useSettingsStore(s => s.videoMuted);
  const videoLoop  = useSettingsStore(s => s.videoLoop);
  const asset = useMediaStore(s => s.assets[bgAssetId]);

  if (bgMode !== 'video' || !asset?.url) return null;

  return (
    <video
      key={asset.url}
      className="absolute inset-0 w-full h-full object-cover"
      src={asset.url}
      autoPlay
      muted={videoMuted}
      loop={videoLoop}
      playsInline
    />
  );
}
