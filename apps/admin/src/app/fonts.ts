import localFont from 'next/font/local';

export const sans = localFont({
  src: [
    { path: './fonts/Inter_400Regular.ttf', weight: '400', style: 'normal' },
    { path: './fonts/Inter_500Medium.ttf', weight: '500', style: 'normal' },
    { path: './fonts/Inter_600SemiBold.ttf', weight: '600', style: 'normal' },
    { path: './fonts/Inter_700Bold.ttf', weight: '700', style: 'normal' },
  ],
  display: 'swap', variable: '--dg-font-sans', preload: false,
});
export const mono = localFont({
  src: './fonts/JetBrainsMono_400Regular.ttf', weight: '400', style: 'normal',
  display: 'swap', variable: '--dg-font-mono', preload: false,
});
