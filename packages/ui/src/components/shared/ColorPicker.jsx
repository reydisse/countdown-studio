import { useRef } from 'react';

export function ColorPicker({ value, onChange, label, className = '' }) {
  const inputRef = useRef(null);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {label && <span className="text-xs text-text-secondary shrink-0">{label}</span>}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="
          flex items-center gap-2 px-2 py-1 rounded
          bg-surface-elevated border border-border-default
          hover:border-border-strong transition-colors text-xs
        "
      >
        <span
          className="w-4 h-4 rounded-sm border border-border-strong shrink-0"
          style={{ background: value }}
        />
        <span className="font-mono text-text-secondary uppercase tracking-wider">
          {value}
        </span>
      </button>
      <input
        ref={inputRef}
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="sr-only"
        tabIndex={-1}
      />
    </div>
  );
}
