import { useSettingsStore } from '../../stores/settingsStore.js';

export function SlideDots() {
  const bgMode                = useSettingsStore(s => s.bgMode);
  const _slideshowActiveIndex = useSettingsStore(s => s._slideshowActiveIndex);
  const _slideshowCount       = useSettingsStore(s => s._slideshowCount);
  const _slideshowGoTo        = useSettingsStore(s => s._slideshowGoTo);

  if (bgMode !== 'slideshow' || _slideshowCount < 2) return null;

  return (
    <div
      className="absolute bottom-[3%] left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-auto"
      style={{ zIndex: 11 }}
    >
      {Array.from({ length: _slideshowCount }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => _slideshowGoTo?.(i)}
          title={`Slide ${i + 1}`}
          className={`
            rounded-full transition-all duration-200
            ${i === _slideshowActiveIndex
              ? 'w-4 h-2 bg-accent'
              : 'w-2 h-2 bg-white/40 hover:bg-white/70'}
          `}
        />
      ))}
    </div>
  );
}
