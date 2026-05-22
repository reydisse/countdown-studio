import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '../../lib/utils.js';

export function Label({ className, ...props }) {
  return (
    <LabelPrimitive.Root
      className={cn('text-xs font-medium text-text-secondary leading-none peer-disabled:opacity-40', className)}
      {...props}
    />
  );
}
