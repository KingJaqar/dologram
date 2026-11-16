import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { iconNames, type IconName, type LucideIconName } from '@dologram/shared/src/theme/icons';

/** Browser-only semantic names. The shared map stays mobile-compatible (W-P02-S02). */
const browserSemantics = { 'theme.system': 'monitor', 'theme.light': 'sun', 'theme.dark': 'moon' } as const;
export type BrowserIconName = keyof typeof browserSemantics;
export type BrowserLucideName = (typeof browserSemantics)[BrowserIconName];
export type WebIconName = IconName | BrowserIconName;
export const webIconNames: Record<WebIconName, LucideIconName | BrowserLucideName> = { ...iconNames, ...browserSemantics };
export const browserIcons: Record<BrowserLucideName, LucideIcon> = { monitor: Monitor, sun: Sun, moon: Moon };

export function isBrowserLucideName(name: LucideIconName | BrowserLucideName): name is BrowserLucideName {
  return Object.hasOwn(browserIcons, name);
}
