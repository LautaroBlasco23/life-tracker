'use client';
import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  );
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'inline-flex h-auto w-full items-center justify-center rounded-md p-1 gap-1',
        'bg-surface border border-border',
        className
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        'inline-flex flex-1 min-w-[45%] items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-all duration-200 ease-in-out',
        'border border-transparent',
        'text-muted-foreground',
        'hover:text-primary hover:border-primary/50 hover:shadow-[inset_0_0_20px_rgba(97,218,251,0.08)]',
        'data-[state=active]:bg-surface data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-[inset_0_0_20px_rgba(97,218,251,0.05)]',
        'disabled:pointer-events-none disabled:opacity-50',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none',
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('flex-1 outline-none', className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
