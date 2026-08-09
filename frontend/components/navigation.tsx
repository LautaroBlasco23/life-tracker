'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  User,
  Wallet,
  Clock,
  StickyNote,
  Menu,
  X,
  Users,
} from 'lucide-react';
import { useTranslations } from '@/contexts/language-context';
import { ThemeToggle } from '@/components/theme-toggle';

export function Navigation() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations('nav');

  const toggleMenu = useCallback(() => setIsOpen((prev) => !prev), []);
  const closeMenu = useCallback(() => setIsOpen(false), []);

  const navItems = [
    { href: '/activities', icon: Activity, label: t('activities') },
    { href: '/time', icon: Clock, label: t('time') },
    { href: '/notes', icon: StickyNote, label: t('notes') },
    { href: '/finance', icon: Wallet, label: t('finance') },
    { href: '/social', icon: Users, label: t('social') },
    { href: '/profile', icon: User, label: t('profile') },
  ];

  return (
    <>
      {/* Mobile: Top bar with hamburger menu */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-background/80 dark:bg-background/80 border-b border-border z-50 backdrop-blur-md">
        <div className="flex items-center justify-between h-full px-4">
          <button
            type="button"
            onClick={toggleMenu}
            className="flex items-center justify-center w-10 h-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label={isOpen ? t('closeMenu') : t('openMenu')}
            aria-expanded={isOpen}
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link
            href="/"
            className="font-brand text-xl tracking-wide text-foreground"
          >
            LifeTracker
          </Link>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link
              href="/profile"
              className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
                pathname === '/profile'
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
              aria-label={t('profile')}
            >
              <User className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile: Backdrop overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}

      {/* Mobile: Slide-down menu */}
      <nav
        className={`lg:hidden fixed top-16 left-0 right-0 z-50 bg-background/95 border-b border-border backdrop-blur-md transform transition-all duration-200 ease-out ${
          isOpen
            ? 'translate-y-0 opacity-100'
            : '-translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <ul className="flex flex-col py-2">
          {navItems
            .filter((item) => item.href !== '/profile')
            .map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={closeMenu}
                    className={`flex items-center gap-3 px-6 py-3 transition-colors ${
                      isActive
                        ? 'text-primary bg-primary/10'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                </li>
              );
            })}
        </ul>
      </nav>

      {/* Mobile: Spacer for fixed header */}
      <div className="lg:hidden h-16" />

      {/* Desktop: Left sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 bg-sidebar border-r border-sidebar-border z-50 flex-col">
        {/* Sidebar header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-sidebar-border">
          <Link
            href="/"
            className="font-brand text-xl tracking-wide text-sidebar-foreground hover:text-sidebar-primary transition-colors"
          >
            LifeTracker
          </Link>
          <ThemeToggle />
        </div>

        {/* Sidebar navigation */}
        <nav className="flex-1 py-6 px-3">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200 ${
                      isActive
                        ? 'text-sidebar-primary-foreground bg-sidebar-primary font-medium'
                        : 'text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent'
                    }`}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span className="text-sm">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Sidebar footer */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="text-xs text-sidebar-foreground/60 text-center">
            LifeTracker v1.0
          </div>
        </div>
      </aside>
    </>
  );
}
