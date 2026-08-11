'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  FilterForm,
  type FilterField,
  type FilterValue,
} from '@/components/ui/filterModal/filterModal';
import { useTranslations } from '@/contexts/language-context';

interface FilterSidebarProps<T extends Record<string, FilterValue>> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFilter: T;
  onApplyFilter: (filter: T) => void;
  fields: FilterField[];
  title?: string;
}

/**
 * Slide-in filters drawer. On desktop it sits right beside the page
 * navigation sidebar (lg:left-64); on mobile it slides from the screen edge.
 * Closes smoothly on Apply, backdrop click, or Escape.
 */
export function FilterSidebar<T extends Record<string, FilterValue>>({
  open,
  onOpenChange,
  currentFilter,
  onApplyFilter,
  fields,
  title,
}: FilterSidebarProps<T>) {
  const t = useTranslations('filterModal');
  const tCommon = useTranslations('common');

  const close = () => onOpenChange(false);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/40 transition-opacity duration-300',
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={close}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title ?? t('filter')}
        className={cn(
          'fixed top-0 bottom-0 left-0 z-50 flex w-80 max-w-[85vw] flex-col bg-card border-r border-border shadow-xl transition-transform duration-300 ease-out lg:left-64',
          open
            ? 'translate-x-0 pointer-events-auto'
            : '-translate-x-full pointer-events-none lg:-translate-x-[calc(100%_+_16rem)]'
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <h2 className="text-base font-semibold">{title ?? t('filter')}</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={close}
            aria-label={tCommon('close')}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <FilterForm
          currentFilter={currentFilter}
          onApplyFilter={onApplyFilter}
          onClose={close}
          fields={fields}
        />
      </aside>
    </>
  );
}
