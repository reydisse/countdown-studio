import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils.js';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors',
  {
    variants: {
      variant: {
        default:     'border-transparent bg-accent/15 text-accent',
        secondary:   'border-border-default bg-surface-elevated text-text-muted',
        destructive: 'border-transparent bg-status-danger/15 text-status-danger',
        live:        'border-transparent bg-status-live/15 text-status-live',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
