'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MoreHorizontal } from 'lucide-react';

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
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && onClick) {
      onClick();
    }
  };

  return (
    <div
      className={`relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors ${
        disabled
          ? 'pointer-events-none opacity-50'
          : variant === 'destructive'
            ? 'text-red-600 focus:bg-red-50 focus:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50'
            : 'focus:bg-accent focus:text-accent-foreground hover:bg-accent'
      }`}
      onClick={handleClick}
    >
      {children}
    </div>
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
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative" data-dropdown>
      <button
        ref={triggerRef}
        onClick={handleTriggerClick}
        className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8"
      >
        <MoreHorizontal className="h-4 w-4" />
        <span className="sr-only">Open menu</span>
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className={`absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 ${
            align === 'end' ? 'right-0' : 'left-0'
          }`}
          style={{ top: '100%', marginTop: '4px' }}
        >
          <div onClick={() => setIsOpen(false)}>{children}</div>
        </div>
      )}
    </div>
  );
}
