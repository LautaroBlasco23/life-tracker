import type React from 'react';
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Playfair_Display } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { ThemeProvider } from '@/contexts/theme-context';
import { LanguageProvider } from '@/contexts/language-context';
import { ToastProvider } from '@/lib/toast';
import { Suspense } from 'react';
import './globals.css';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-brand',
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'Lifetracker',
  description: 'Lifetracker app',
  generator: 'lautaroblasco.com',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${playfair.variable} antialiased`}
    >
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/env-config.js" />
      </head>
      <body>
        <Suspense fallback={null}>
          <LanguageProvider>
            <ThemeProvider>
              {children}
              <ToastProvider />
            </ThemeProvider>
          </LanguageProvider>
        </Suspense>
        <Analytics />
      </body>
    </html>
  );
}
