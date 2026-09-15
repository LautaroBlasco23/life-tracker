'use client';

import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem as RadixDropdownMenuItem,
} from '@/components/ui/dropdown-menu';

interface DropdownMenuItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
}

export function DropdownMenuItem({
  children,
  onClick,
  variant = 'default',
  disabled = false,
}: DropdownMenuItemProps) {
  return (
    <RadixDropdownMenuItem
      variant={variant}
      disabled={disabled}
      onSelect={(event) => {
        event.preventDefault();
        onClick?.();
      }}
    >
      {children}
    </RadixDropdownMenuItem>
  );
}

interface EntityDropdownProps {
  children: React.ReactNode;
  align?: 'start' | 'end';
}

export function EntityDropdown({
  children,
  align = 'end',
}: EntityDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8">
        <MoreHorizontal className="h-4 w-4" />
        <span className="sr-only">Open menu</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}
