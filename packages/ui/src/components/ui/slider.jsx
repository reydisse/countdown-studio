import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '../../lib/utils.js';

export function Slider({ className, label, unit = '', ...props }) {
  const value = props.value ?? props.defaultValue;
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <div className="flex justify-between items-center">
          <span className="text-xs text-text-secondary">{label}</span>
          <span className="text-xs font-mono text-text-muted tabular-nums">
            {Array.isArray(value) ? value[0] : value}{unit}
          </span>
        </div>
      )}
      <SliderPrimitive.Root
        className="relative flex w-full touch-none select-none items-center"
        {...props}
      >
        <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-surface-overlay">
          <SliderPrimitive.Range className="absolute h-full bg-accent" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className={cn(
            'block h-3.5 w-3.5 rounded-full border-2 border-accent bg-surface-base shadow',
            'ring-offset-surface-base transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
            'disabled:pointer-events-none disabled:opacity-40'
          )}
        />
      </SliderPrimitive.Root>
    </div>
  );
}
