// Renders a visual preview for any asset type.
// Server thumbnails (thumbnailUrl) are preferred when present; otherwise
// images render the full asset and videos show their first frame via a
// muted <video preload="metadata"> — no playback, just the poster frame.
export function AssetThumb({ asset, className = 'w-full h-full object-cover' }) {
  if (!asset) return <div className="w-full h-full bg-surface-overlay" />;

  const src = asset.thumbnailUrl || asset.url;

  if (asset.type === 'video' && !asset.thumbnailUrl && asset.url) {
    return (
      <video
        src={`${asset.url}#t=0.1`}
        className={className}
        preload="metadata"
        muted
        playsInline
        tabIndex={-1}
        aria-hidden
      />
    );
  }

  if (asset.type !== 'audio' && src) {
    return <img src={src} className={className} alt={asset.name ?? ''} draggable={false} />;
  }

  return (
    <div className="w-full h-full bg-surface-overlay flex items-center justify-center text-text-muted">
      <span className="text-xl">{asset.type === 'audio' ? '♫' : '▶'}</span>
    </div>
  );
}
