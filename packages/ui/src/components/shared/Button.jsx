const VARIANTS = {
  primary:   'bg-accent text-surface-base hover:bg-accent-hover active:opacity-80',
  secondary: 'bg-surface-elevated text-text-primary hover:bg-surface-overlay border border-border-default',
  ghost:     'text-text-secondary hover:text-text-primary hover:bg-surface-elevated',
  danger:    'bg-status-danger/15 text-status-danger hover:bg-status-danger/25',
};

const SIZES = {
  sm: 'px-2 py-1 text-xs rounded',
  md: 'px-3 py-1.5 text-sm rounded-md',
  lg: 'px-4 py-2 text-sm rounded-md',
};

export function Button({
  children, onClick, variant = 'secondary', size = 'md',
  className = '', disabled = false, title, type = 'button', ...rest
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        inline-flex items-center justify-center gap-1.5 font-medium
        transition-colors duration-100 select-none
        disabled:opacity-40 disabled:cursor-not-allowed
        ${VARIANTS[variant]} ${SIZES[size]} ${className}
      `}
      {...rest}
    >
      {children}
    </button>
  );
}
