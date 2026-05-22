import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils.js';

export function SidebarSection({ title, children, defaultOpen = true, badge }) {
  return (
    <AccordionPrimitive.Root
      type="single"
      defaultValue={defaultOpen ? 'item' : undefined}
      collapsible
    >
      <AccordionPrimitive.Item
        value="item"
        className="border-l-2 border-transparent data-[state=open]:border-accent transition-colors"
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <AccordionPrimitive.Header className="flex">
          <AccordionPrimitive.Trigger
            className={cn(
              'flex flex-1 items-center justify-between px-4 py-3',
              'text-left text-xs font-semibold uppercase tracking-widest text-text-secondary',
              'hover:bg-surface-elevated transition-colors',
              '[&[data-state=open]>div>svg]:rotate-180'
            )}
          >
            {title}
            <div className="flex items-center gap-2">
              {badge && (
                <span className="text-[10px] font-mono bg-accent/15 text-accent px-1.5 py-0.5 rounded">
                  {badge}
                </span>
              )}
              <ChevronDown className="h-3.5 w-3.5 text-text-muted shrink-0 transition-transform duration-200" />
            </div>
          </AccordionPrimitive.Trigger>
        </AccordionPrimitive.Header>

        {/* ── Content — animated height ────────────────────────────────── */}
        <AccordionPrimitive.Content className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
          <div className="px-4 pb-4 space-y-3">
            {children}
          </div>
        </AccordionPrimitive.Content>
      </AccordionPrimitive.Item>
    </AccordionPrimitive.Root>
  );
}
