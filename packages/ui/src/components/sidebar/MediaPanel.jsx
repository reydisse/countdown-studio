import { useEffect, useState } from 'react';
import { useMediaStore }  from '../../stores/mediaStore.js';
import { SidebarSection } from './SidebarSection.jsx';
import { Button }         from '../shared/Button.jsx';
import { openFilePicker } from '../../adapter/index.js';

// ── Single asset card ────────────────────────────────────────────────────────
function AssetCard({ asset, onDelete }) {
  const [confirming, setConfirming] = useState(false);

  const hasThumbnail = !!asset.thumbnailUrl;
  const isAudio      = asset.type === 'audio';

  // Friendly file-size label
  function fmtSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  return (
    <div className="group rounded-md overflow-hidden border border-border-default bg-surface-elevated flex flex-col">
      {/* Thumbnail */}
      <div className="relative aspect-video bg-surface-overlay">
        {hasThumbnail ? (
          <img
            src={asset.thumbnailUrl}
            alt={asset.name}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : asset.url && !isAudio ? (
          <img
            src={asset.url}
            alt={asset.name}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-muted">
            {isAudio
              ? <span className="text-2xl">♫</span>
              : <span className="text-2xl opacity-40">▶</span>}
          </div>
        )}

        {/* Type badge */}
        <span className="absolute top-0.5 left-0.5 text-[8px] uppercase tracking-wider
          bg-black/60 text-white/80 px-1 py-px rounded font-mono">
          {asset.type}
        </span>

        {/* Hover overlay: delete */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100
          transition-opacity flex items-center justify-center gap-1">
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="text-[10px] px-2 py-1 rounded bg-status-danger/80 hover:bg-status-danger text-white transition-colors"
            >
              Delete
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onDelete}
                className="text-[10px] px-2 py-1 rounded bg-status-danger text-white"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="text-[10px] px-2 py-1 rounded bg-surface-overlay text-text-secondary"
              >
                No
              </button>
            </>
          )}
        </div>
      </div>

      {/* Name + size */}
      <div className="px-1.5 py-1 min-w-0">
        <p className="text-[10px] text-text-secondary truncate leading-tight" title={asset.name}>
          {asset.name}
        </p>
        {asset.size > 0 && (
          <p className="text-[9px] text-text-muted">{fmtSize(asset.size)}</p>
        )}
      </div>
    </div>
  );
}

// ── Panel ────────────────────────────────────────────────────────────────────
const TYPE_LABELS = { image: 'Images', video: 'Videos', audio: 'Audio' };
const TYPE_ICONS  = { image: '🖼',     video: '▶',       audio: '♫'    };
const ACCEPT_MAP  = { image: 'image/*', video: 'video/*', audio: 'audio/*' };

export function MediaPanel() {
  const assetsById = useMediaStore(s => s.assets);
  const fetchAll   = useMediaStore(s => s.fetchAll);
  const removeAsset = useMediaStore(s => s.remove);
  const uploading  = useMediaStore(s => s.uploading);

  const [uploadingType, setUploadingType] = useState(null);

  // Populate store on first open
  useEffect(() => { fetchAll(); }, []);

  const all   = Object.values(assetsById);
  const types = ['image', 'video', 'audio'];
  const byType = Object.fromEntries(
    types.map(t => [t, all.filter(a => a.type === t)])
  );
  const total = all.length;

  async function handleUpload(type) {
    setUploadingType(type);
    try {
      const files = await openFilePicker({ accept: ACCEPT_MAP[type], multiple: true });
      for (const f of files) await useMediaStore.getState().upload(f);
    } finally {
      setUploadingType(null);
    }
  }

  return (
    <SidebarSection title="Media Library" defaultOpen={false}
      badge={total > 0 ? String(total) : undefined}>

      {/* Quick-upload buttons */}
      <div className="flex gap-1">
        {types.map(t => (
          <Button
            key={t}
            size="sm"
            className="flex-1 text-[10px]"
            disabled={!!uploadingType || uploading}
            onClick={() => handleUpload(t)}
          >
            {uploadingType === t ? '…' : `+ ${TYPE_ICONS[t]}`}
          </Button>
        ))}
      </div>

      {total === 0 && (
        <p className="text-xs text-text-muted text-center py-3">
          No media uploaded yet.
        </p>
      )}

      {/* Asset grids by type */}
      {types.map(type => {
        const items = byType[type];
        if (!items.length) return null;
        return (
          <div key={type} className="space-y-1.5">
            <p className="text-[10px] text-text-muted uppercase tracking-wider">
              {TYPE_ICONS[type]} {TYPE_LABELS[type]} ({items.length})
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {items.map(asset => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  onDelete={() => removeAsset(asset.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </SidebarSection>
  );
}
