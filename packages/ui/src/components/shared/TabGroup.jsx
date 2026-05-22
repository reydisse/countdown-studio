export function TabGroup({ tabs, value, onChange, className = '', size = 'md' }) {
  const pad = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm';

  return (
    <div className={`flex bg-surface-elevated rounded-lg p-0.5 gap-0.5 ${className}`}>
      {tabs.map(tab => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={`
            flex-1 ${pad} rounded-md font-medium transition-colors
            ${value === tab.value
              ? 'bg-surface-overlay text-text-primary'
              : 'text-text-muted hover:text-text-secondary'}
          `}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
