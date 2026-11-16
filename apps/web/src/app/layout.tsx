import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';
import localFont from 'next/font/local';
import { ThemeScript } from '../theme/ThemeScript';
import { BrowserClientStatus } from '../components/BrowserClientStatus';
import { ToastProvider } from '../components/Toast/Toast';
import { OverlayHistoryObserver } from '../lib/OverlayHistoryObserver';
import './globals.css';

const sans = localFont({
  src: [
    { path: '../theme/fonts/Inter_400Regular.ttf', weight: '400', style: 'normal' },
    { path: '../theme/fonts/Inter_500Medium.ttf', weight: '500', style: 'normal' },
    { path: '../theme/fonts/Inter_600SemiBold.ttf', weight: '600', style: 'normal' },
    { path: '../theme/fonts/Inter_700Bold.ttf', weight: '700', style: 'normal' },
    { path: '../theme/fonts/Inter_400Regular_Italic.ttf', weight: '400', style: 'italic' },
    { path: '../theme/fonts/Inter_500Medium_Italic.ttf', weight: '500', style: 'italic' },
    { path: '../theme/fonts/Inter_600SemiBold_Italic.ttf', weight: '600', style: 'italic' },
    { path: '../theme/fonts/Inter_700Bold_Italic.ttf', weight: '700', style: 'italic' },
  ],
  display: 'swap', variable: '--dg-font-sans',
});
const mono = localFont({ src: '../theme/fonts/JetBrainsMono_400Regular.ttf', weight: '400', display: 'swap', variable: '--dg-font-mono' });

export const metadata: Metadata = {
  title: 'DoloGram',
  applicationName: 'DoloGram',
  other: { 'dg-supabase-url': process.env.NEXT_PUBLIC_SUPABASE_URL || '' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning><head><ThemeScript /></head><body><ToastProvider><Suspense fallback={null}><OverlayHistoryObserver /></Suspense><BrowserClientStatus />{children}</ToastProvider></body></html>;
}
