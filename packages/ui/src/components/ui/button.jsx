import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils.js';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-40 select-none',
  {
    variants: {
      variant: {
        default:     'bg-accent text-surface-base shadow-sm hover:bg-accent-hover',
        secondary:   'bg-surface-elevated text-text-primary border border-border-default hover:bg-surface-overlay',
        ghost:       'text-text-secondary hover:text-text-primary hover:bg-surface-elevated',
        destructive: 'bg-status-danger/15 text-status-danger hover:bg-status-danger/25',
        outline:     'border border-border-default bg-transparent text-text-secondary hover:bg-surface-elevated hover:text-text-primary',
      },
      size: {
        default: 'h-8 px-3 py-1.5',
        sm:      'h-7 rounded px-2.5 text-xs',
        lg:      'h-9 rounded-md px-5',
        icon:    'h-8 w-8',
        'icon-sm': 'h-6 w-6 rounded',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'default' },
  }
);

export function Button({ className, variant, size, children, ...props }) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {children}
    </button>
  );
}
