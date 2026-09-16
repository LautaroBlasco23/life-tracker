'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  User,
  Wallet,
  StickyNote,
  Menu,
  X,
  Users,
  HeartPulse,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslations } from '@shared/contexts/language-context';
import { ThemeToggle } from '@/components/theme-toggle';

type NavSubItem = {
  href: string;
  label: string;
};

type NavItem = {
  href: string;
  icon: LucideIcon;
  label: string;
  children?: NavSubItem[];
};

const isItemActive = (pathname: string, item: NavItem) =>
  pathname === item.href ||
  (item.children?.some((child) => child.href === pathname) ?? false);

export function Navigation() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations('nav');

  const toggleMenu = useCallback(() => setIsOpen((prev) => !prev), []);
  const closeMenu = useCallback(() => setIsOpen(false), []);

  const navItems: NavItem[] = [
    {
      href: '/activities',
      icon: Activity,
      label: t('activities'),
      children: [
        { href: '/activities', label: t('daily') },
        { href: '/routines', label: t('routines') },
        { href: '/time', label: t('time') },
      ],
    },
    { href: '/notes', icon: StickyNote, label: t('notes') },
    {
      href: '/finance/transactions',
      icon: Wallet,
      label: t('finance'),
      children: [
        { href: '/finance/transactions', label: t('transactions') },
        { href: '/finance/dashboard', label: t('dashboard') },
        { href: '/finance/bills', label: t('bills') },
      ],
    },
    {
      href: '/health/nutrition',
      icon: HeartPulse,
      label: t('health'),
      children: [
        { href: '/health/nutrition', label: t('nutrition') },
        { href: '/health/gym', label: t('gym') },
      ],
    },
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
              const isActive = isItemActive(pathname, item);
              return (
                <li key={item.href} className="flex flex-col">
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
                  {item.children && (
                    <ul>
                      {item.children.map((child) => (
                        <li key={child.label}>
                          <Link
                            href={child.href}
                            onClick={closeMenu}
                            className={`flex items-center py-2 pl-14 pr-6 transition-colors ${
                              pathname === child.href
                                ? 'text-primary'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            <span className="text-xs">{child.label}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
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
              const isActive = isItemActive(pathname, item);
              return (
                <li key={item.href} className="flex flex-col">
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
                  {item.children && (
                    <ul>
                      {item.children.map((child) => (
                        <li key={child.label}>
                          <Link
                            href={child.href}
                            className={`flex items-center py-1.5 pl-11 pr-3 transition-colors ${
                              pathname === child.href
                                ? 'text-sidebar-primary'
                                : 'text-sidebar-foreground/70 hover:text-sidebar-accent-foreground'
                            }`}
                          >
                            <span className="text-xs">{child.label}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
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
