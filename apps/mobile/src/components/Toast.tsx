/** App-wide notification queue. One readable card per placement; no navigation-owned timers. */
import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { strings } from '@dologram/shared';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';
import { Icon } from './Icon';

export type ToastPlacement = 'top' | 'bottom';
export interface ToastOptions {
  message: string;
  variant?: 'success' | 'error' | 'info';
  placement?: ToastPlacement;
  /** Stable result ID for multiple handlers observing the same operation. */
  id?: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
  /** Only account transitions may finish across a session change. */
  surviveAccountChange?: boolean;
}
type Entry = ToastOptions & { key: number; createdAt: number };
interface ToastContextValue {
  showToast: (options: ToastOptions) => void;
  hideToast: (id?: string) => void;
  setScope: (accountId: string | null) => void;
}
const noop = () => {};
const ToastContext = createContext<ToastContextValue>({ showToast: noop, hideToast: noop, setScope: noop });
const HostContext = createContext<{ entries: Entry[]; hosts: string[]; register: (id: string) => () => void; dismiss: (key: number) => void; announce: (entry: Entry) => void }>({ entries: [], hosts: [], register: () => noop, dismiss: noop, announce: noop });
export function useToast() { return useContext(ToastContext); }

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const entriesRef = useRef<Entry[]>([]);
  const recent = useRef(new Map<string, number>());
  const sequence = useRef(0);
  const scope = useRef<string | null>(null);
  const generationRef = useRef(0);
  const [generation, setGeneration] = useState(0);
  const resultIds = useRef(new Set<string>());
  const announced = useRef(new Set<number>());
  const [hosts, setHosts] = useState<string[]>([]);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const publish = useCallback((next: Entry[]) => {
    entriesRef.current = next;
    if (alive.current) setEntries(next);
  }, []);
  const dismiss = useCallback((key: number) => publish(entriesRef.current.filter((entry) => entry.key !== key)), [publish]);
  const showToast = useCallback((options: ToastOptions) => {
    if (generation !== generationRef.current && !options.surviveAccountChange) return;
    if (!alive.current || !options.message.trim()) return;
    if (options.id && resultIds.current.has(options.id)) return;
    const now = Date.now();
    const identity = options.id ?? `${options.placement ?? 'bottom'}:${options.variant ?? 'info'}:${options.message}`;
    for (const [id, time] of recent.current) if (now - time > 2000) recent.current.delete(id);
    if (recent.current.has(identity) || entriesRef.current.some((entry) => options.id ? entry.id === options.id : entry.message === options.message && (entry.variant ?? 'info') === (options.variant ?? 'info') && (entry.placement ?? 'bottom') === (options.placement ?? 'bottom'))) return;
    recent.current.set(identity, now);
    if (options.id) {
      resultIds.current.add(options.id);
      if (resultIds.current.size > 256) resultIds.current.delete(resultIds.current.values().next().value!);
    }
    const placement = options.placement ?? 'bottom';
    const activeKeys = new Set((['top', 'bottom'] as const).map((lane) => entriesRef.current.find((entry) => (entry.placement ?? 'bottom') === lane)?.key));
    let next = entriesRef.current.filter((entry) => activeKeys.has(entry.key) || entry.variant === 'error' || entry.actionLabel || entry.durationMs === 0 || now - entry.createdAt < 30000);
    const lane = next.filter((entry) => (entry.placement ?? 'bottom') === placement);
    // Bound overflow to one active and five waiting cards per lane. Keep the active card,
    // prefer discarding an older waiting success, then the oldest waiting result.
    if (lane.length >= 6) {
      const victim = lane.slice(1).find((entry) => entry.variant !== 'error') ?? lane[1];
      next = next.filter((entry) => entry.key !== victim.key);
    }
    publish([...next, { ...options, placement, key: ++sequence.current, createdAt: now }]);
  }, [publish, generation]);
  const hideToast = useCallback((id?: string) => publish(id ? entriesRef.current.filter((entry) => entry.id !== id) : []), [publish]);
  const setScope = useCallback((accountId: string | null) => {
    if (scope.current === accountId) return;
    scope.current = accountId;
    generationRef.current += 1;
    setGeneration(generationRef.current);
    publish(entriesRef.current.filter((entry) => entry.surviveAccountChange));
  }, [publish]);
  const register = useCallback((id: string) => {
    setHosts((current) => [...current, id]);
    return () => setHosts((current) => current.filter((host) => host !== id));
  }, []);
  const announce = useCallback((entry: Entry) => {
    if (Platform.OS !== 'ios' || announced.current.has(entry.key)) return;
    announced.current.add(entry.key);
    if (announced.current.size > 64) announced.current.delete(announced.current.values().next().value!);
    AccessibilityInfo.announceForAccessibility(entry.message);
  }, []);
  const api = useMemo(() => ({ showToast, hideToast, setScope }), [showToast, hideToast, setScope]);
  const hostApi = useMemo(() => ({ entries, hosts, register, dismiss, announce }), [entries, hosts, register, dismiss, announce]);
  return <ToastContext.Provider value={api}><HostContext.Provider value={hostApi}>{children}<ToastViewport active={hosts.length === 0} /></HostContext.Provider></ToastContext.Provider>;
}

/** Native modals are separate windows: render in the frontmost modal, never behind its scrim. */
export function ToastModalHost({ visible }: { visible: boolean }) {
  const id = useId();
  const { register, hosts } = useContext(HostContext);
  useEffect(() => visible ? register(id) : undefined, [id, register, visible]);
  return visible && hosts[hosts.length - 1] === id ? <ToastViewport active /> : null;
}

function ToastViewport({ active }: { active: boolean }) {
  const { entries, dismiss } = useContext(HostContext);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (event) => setKeyboardTop(event.endCoordinates.screenY));
    const change = Keyboard.addListener('keyboardDidChangeFrame', (event) => setKeyboardTop(event.endCoordinates.screenY));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardTop(null));
    return () => { show.remove(); change.remove(); hide.remove(); };
  }, []);
  if (!active) return null;
  const top = insets.top + 64;
  // Reserve tab bar/composer space even on routes without a bottom bar. On Android with
  // adjustResize the window already ends above the keyboard, so this does not double its height.
  const bottom = Math.max(insets.bottom + 80, keyboardTop === null ? 0 : height - keyboardTop + 80);
  const available = height - top - bottom - 16;
  if (available < 64) return null; // Defer while a tall keyboard leaves no unobstructed space.
  const both = available >= 144;
  const maxHeight = both ? (available - 16) / 2 : available;
  const preferred = entries.find((entry) => entry.variant === 'error')?.placement ?? entries[0]?.placement;
  return <>{(['top', 'bottom'] as const).map((placement) => {
    if (!both && preferred !== placement) return null;
    const entry = entries.find((item) => (item.placement ?? 'bottom') === placement);
    return entry ? <View key={placement} testID={`toast-${placement}`} pointerEvents="box-none" style={[styles.portal, { left: Math.max(16, insets.left + 8), right: Math.max(16, insets.right + 8), [placement]: placement === 'top' ? top : bottom, zIndex: theme.z.toast }]}><ToastCard key={entry.key} entry={entry} maxHeight={maxHeight} onDismiss={() => dismiss(entry.key)} /></View> : null;
  })}</>;
}

function ToastCard({ entry, onDismiss, maxHeight }: { entry: Entry; onDismiss: () => void; maxHeight: number }) {
  const theme = useTheme();
  const { announce } = useContext(HostContext);
  const c = theme.colors;
  const opacity = useRef(new Animated.Value(theme.reduceMotion ? 1 : 0)).current;
  const [reader, setReader] = useState(true); // no timeout until accessibility preference resolves
  const [paused, setPaused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((value) => { if (active) setReader(value); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setReader);
    const app = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => { active = false; sub.remove(); app.remove(); };
  }, []);
  useEffect(() => {
    const animation = Animated.timing(opacity, { toValue: 1, duration: theme.reduceMotion ? 0 : theme.motion.duration.fast, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [opacity, theme.reduceMotion, theme.motion.duration.fast]);
  useEffect(() => {
    announce(entry);
  }, [announce, entry]);
  useEffect(() => {
    if (reader || paused || !foreground || entry.durationMs === 0 || entry.actionLabel) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const duration = Math.max(entry.variant === 'error' ? 9000 : 4000, entry.durationMs ?? 0);
    const recommended = Platform.OS === 'android' ? AccessibilityInfo.getRecommendedTimeoutMillis(duration) : Promise.resolve(duration);
    void recommended.then((ms) => { if (active) timer = setTimeout(() => dismissRef.current(), ms); }).catch(() => { if (active) timer = setTimeout(() => dismissRef.current(), duration); });
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [entry, foreground, paused, reader]);
  const error = entry.variant === 'error';
  const foregroundColor = error ? c.error.text : c.text.primary;
  return <Animated.View onAccessibilityEscape={onDismiss} style={[styles.toast, { maxHeight, opacity, borderRadius: theme.radius.lg, backgroundColor: error ? c.error.bg : c.bg.elevated, borderColor: error ? c.error.text : c.separator, shadowColor: c.shadow }]}>
    <View style={styles.icon}><Icon name={error ? 'status.failed' : entry.variant === 'success' ? 'status.sent' : 'action.unmute'} size="md" color={foregroundColor} accessibilityLabel="" /></View>
    <ScrollView style={styles.body} contentContainerStyle={styles.copy} onTouchStart={() => setPaused(true)} onTouchEnd={() => setPaused(false)}>
      <Text accessibilityLiveRegion="polite" style={[textStyle(theme.typeTokens.bodyMd), { color: foregroundColor }]}>{entry.message}</Text>
      {entry.actionLabel ? <Pressable accessibilityRole="button" accessibilityLabel={entry.actionLabel} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)} onPress={() => { onDismiss(); entry.onAction?.(); }} style={styles.action}><Text style={[textStyle(theme.typeTokens.labelLg), { color: foregroundColor, textDecorationLine: 'underline' }]}>{entry.actionLabel}</Text></Pressable> : null}
    </ScrollView>
    <Pressable accessibilityRole="button" accessibilityLabel={strings.toasts.dismiss} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)} onPress={onDismiss} style={styles.dismiss}><Icon name="action.close" size="sm" color={foregroundColor} accessibilityLabel="" /></Pressable>
  </Animated.View>;
}
const styles = StyleSheet.create({
  portal: { position: 'absolute', alignItems: 'center' },
  toast: { width: '100%', maxWidth: 440, flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, padding: 4, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.16, shadowRadius: 12, elevation: 6 },
  icon: { padding: 12 },
  body: { flex: 1 },
  copy: { paddingVertical: 12 },
  dismiss: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  action: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
});
