import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils.js';

export const Accordion      = AccordionPrimitive.Root;
export const AccordionItem  = AccordionPrimitive.Item;

export function AccordionTrigger({ className, children, ...props }) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          'flex flex-1 items-center justify-between py-3 px-4 text-xs font-semibold uppercase tracking-widest text-text-secondary',
          'transition-all hover:bg-surface-elevated [&[data-state=open]>svg]:rotate-180',
          className
        )}
        {...props}
      >
        {children}
        <ChevronDown className="h-3.5 w-3.5 text-text-muted shrink-0 transition-transform duration-200" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

export function AccordionContent({ className, children, ...props }) {
  return (
    <AccordionPrimitive.Content
      className={cn(
        'overflow-hidden',
        'data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up',
        className
      )}
      {...props}
    >
      <div className="px-4 pb-4 space-y-3">{children}</div>
    </AccordionPrimitive.Content>
  );
}
