export function Slider({ value, onChange, min = 0, max = 100, step = 1, label, unit = '', disabled = false }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex justify-between items-center">
          <span className="text-xs text-text-secondary">{label}</span>
          <span className="text-xs font-mono text-text-muted tabular-nums">{value}{unit}</span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
        className="
          w-full h-1 rounded-full appearance-none cursor-pointer
          bg-surface-overlay accent-accent
          disabled:opacity-40 disabled:cursor-not-allowed
        "
      />
    </div>
  );
}
