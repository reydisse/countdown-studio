import { useState } from 'react';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { useMediaStore }    from '../../stores/mediaStore.js';
import { SidebarSection }   from './SidebarSection.jsx';
import { TabGroup }         from '../shared/TabGroup.jsx';
import { Button }           from '../shared/Button.jsx';
import { ColorPicker }      from '../shared/ColorPicker.jsx';
import { Slider }           from '../shared/Slider.jsx';
import { AssetThumb }       from '../shared/AssetThumb.jsx';
import { openFilePicker } from '../../adapter/index.js';
import { useShallow }      from 'zustand/react/shallow';

const TABS = [
  { value: 'color',     label: 'Theme'     },
  { value: 'image',     label: 'Image'     },
  { value: 'video',     label: 'Video'     },
  { value: 'slideshow', label: 'Slideshow' },
];

const TRANSITIONS = [
  { value: 'fade',      label: 'Fade'       },
  { value: 'zoom',      label: 'Zoom'       },
  { value: 'slide',     label: 'Slide'      },
  { value: 'cut',       label: 'Cut'        },
  { value: 'kenburns',  label: 'Ken Burns'  },
  { value: 'crossfade', label: 'Crossfade'  },
];

const THEME_COLORS = ['#181614','#0a0a0a','#1a1a2e','#0d1b2a','#1b0000','#0d1f0d'];

function AssetPicker({ type, value, onChange }) {
  const assetsById = useMediaStore(s => s.assets);            // stable ref
  const assets     = Object.values(assetsById).filter(a => a.type === type); // filter in render

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {assets.map(a => (
        <button
          key={a.id}
          type="button"
          onClick={() => onChange(a.id)}
          className={`
            aspect-video rounded overflow-hidden border-2 transition-colors
            ${value === a.id ? 'border-accent' : 'border-transparent hover:border-border-strong'}
          `}
        >
          <AssetThumb asset={a} className="w-full h-full object-cover pointer-events-none" />
        </button>
      ))}
    </div>
  );
}

async function pickAndUpload(accept, onDone) {
  const files = await openFilePicker({ accept, multiple: false });
  if (!files.length) return;
  const asset = await useMediaStore.getState().upload(files[0]);
  onDone(asset.id);
}

export function BackgroundPanel() {
  const bgMode              = useSettingsStore(s => s.bgMode);
  const bgColor             = useSettingsStore(s => s.bgColor);
  const bgAssetId           = useSettingsStore(s => s.bgAssetId);
  const imageSize           = useSettingsStore(s => s.imageSize);
  const videoMuted          = useSettingsStore(s => s.videoMuted);
  const videoLoop           = useSettingsStore(s => s.videoLoop);
  const slideshowAssetIds   = useSettingsStore(useShallow(s => s.slideshowAssetIds));
  const slideshowTransition = useSettingsStore(s => s.slideshowTransition);
  const slideshowInterval   = useSettingsStore(s => s.slideshowInterval);
  const update              = useSettingsStore(s => s.update);

  const assets   = useMediaStore(s => s.assets);
  const [loading,  setLoading]  = useState(false);
  const [dragSrc,  setDragSrc]  = useState(null);   // index being dragged
  const [dragOver, setDragOver] = useState(null);   // index currently hovered

  const uploadMedia = async (accept, field) => {
    setLoading(true);
    try { await pickAndUpload(accept, id => update({ [field]: id })); }
    finally { setLoading(false); }
  };

  const addToSlideshow = async () => {
    setLoading(true);
    try {
      await pickAndUpload('image/*', id =>
        update({ slideshowAssetIds: [...slideshowAssetIds, id] })
      );
    } finally { setLoading(false); }
  };

  const removeFromSlideshow = (id) =>
    update({ slideshowAssetIds: slideshowAssetIds.filter(x => x !== id) });

  return (
    <SidebarSection title="Background" defaultOpen>
      <TabGroup
        tabs={TABS}
        value={bgMode}
        onChange={v => update({ bgMode: v })}
        size="sm"
      />

      {/* ── Theme ────────────────────────────────────────────────── */}
      {bgMode === 'color' && (
        <div className="space-y-3">
          <ColorPicker
            label="Color"
            value={bgColor}
            onChange={v => update({ bgColor: v })}
          />
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">Presets</p>
            <div className="flex gap-1.5 flex-wrap">
              {THEME_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => update({ bgColor: c })}
                  className={`w-7 h-7 rounded border-2 transition-colors ${bgColor === c ? 'border-accent' : 'border-transparent hover:border-border-strong'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Image ────────────────────────────────────────────────── */}
      {bgMode === 'image' && (
        <div className="space-y-3">
          <Button size="sm" onClick={() => uploadMedia('image/*', 'bgAssetId')} disabled={loading} className="w-full">
            {loading ? 'Uploading…' : '+ Upload Image'}
          </Button>
          <AssetPicker type="image" value={bgAssetId} onChange={id => update({ bgAssetId: id })} />
          <div className="flex gap-2">
            {['cover','contain'].map(v => (
              <button
                key={v}
                type="button"
                onClick={() => update({ imageSize: v })}
                className={`flex-1 py-1 text-xs rounded border transition-colors capitalize
                  ${imageSize === v ? 'border-accent text-accent bg-accent/10' : 'border-border-default text-text-muted hover:border-border-strong'}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Video ────────────────────────────────────────────────── */}
      {bgMode === 'video' && (
        <div className="space-y-3">
          <Button size="sm" onClick={() => uploadMedia('video/*', 'bgAssetId')} disabled={loading} className="w-full">
            {loading ? 'Uploading…' : '+ Upload Video'}
          </Button>
          <AssetPicker type="video" value={bgAssetId} onChange={id => update({ bgAssetId: id })} />
          <div className="flex gap-3">
            <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
              <input type="checkbox" checked={videoMuted} onChange={e => update({ videoMuted: e.target.checked })} className="accent-accent" />
              Muted
            </label>
            <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
              <input type="checkbox" checked={videoLoop} onChange={e => update({ videoLoop: e.target.checked })} className="accent-accent" />
              Loop
            </label>
          </div>
        </div>
      )}

      {/* ── Slideshow ────────────────────────────────────────────── */}
      {bgMode === 'slideshow' && (
        <div className="space-y-3">
          <Button size="sm" onClick={addToSlideshow} disabled={loading} className="w-full">
            {loading ? 'Uploading…' : '+ Add Image'}
          </Button>

          {slideshowAssetIds.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5">
              {slideshowAssetIds.map((id, i) => {
                const a = assets[id];
                const isOver = dragOver === i && dragSrc !== i;
                return (
                  <div
                    key={id}
                    draggable
                    onDragStart={e => {
                      setDragSrc(i);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={e => { e.preventDefault(); setDragOver(i); }}
                    onDrop={e => {
                      e.preventDefault();
                      if (dragSrc === null || dragSrc === i) return;
                      const next = [...slideshowAssetIds];
                      const [moved] = next.splice(dragSrc, 1);
                      next.splice(i, 0, moved);
                      update({ slideshowAssetIds: next });
                      setDragSrc(null); setDragOver(null);
                    }}
                    onDragEnd={() => { setDragSrc(null); setDragOver(null); }}
                    className={`
                      relative group aspect-video rounded overflow-hidden border cursor-grab
                      transition-all duration-100
                      ${isOver     ? 'border-accent ring-1 ring-accent scale-105' : 'border-border-default'}
                      ${dragSrc === i ? 'opacity-40 scale-95' : ''}
                    `}
                  >
                    <AssetThumb asset={a} className="w-full h-full object-cover pointer-events-none" />
                    {/* Remove on hover */}
                    <button
                      type="button"
                      onClick={() => removeFromSlideshow(id)}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs"
                    >
                      ✕
                    </button>
                    {/* Slide number */}
                    <span className="absolute bottom-0.5 left-0.5 text-[9px] text-white/70 bg-black/50 px-1 rounded pointer-events-none">
                      {i + 1}
                    </span>
                    {/* Drag handle hint */}
                    <span className="absolute top-0.5 right-0.5 text-[10px] text-white/50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                      ⠿
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">Transition</p>
            <div className="grid grid-cols-3 gap-1">
              {TRANSITIONS.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => update({ slideshowTransition: t.value })}
                  className={`py-1 text-xs rounded border transition-colors
                    ${slideshowTransition === t.value
                      ? 'border-accent text-accent bg-accent/10'
                      : 'border-border-default text-text-muted hover:border-border-strong'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <Slider
            label="Interval"
            value={Math.round(slideshowInterval / 1000)}
            onChange={v => update({ slideshowInterval: v * 1000 })}
            min={2} max={60} step={1} unit="s"
          />
        </div>
      )}
    </SidebarSection>
  );
}
