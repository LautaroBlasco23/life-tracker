'use client';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface TimeInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * Time field that opens the browser's time selector when clicking anywhere on
 * the input (not just the small indicator icon, which we hide — in dark theme
 * it was invisible against the background).
 */
export function TimeInput({ id, value, onChange, className }: TimeInputProps) {
  return (
    <Input
      id={id}
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => {
        const input = e.currentTarget;
        if (typeof input.showPicker === 'function') {
          try {
            input.showPicker();
          } catch {
            // Some browsers reject showPicker without user activation; the
            // native segments remain usable.
          }
        }
      }}
      className={cn(
        'text-foreground cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden',
        className
      )}
    />
  );
}
