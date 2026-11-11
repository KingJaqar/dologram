import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
/* Reanimated shared values are intentionally mutated by UI-thread worklets. */
/* eslint-disable react-hooks/immutability */
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { requireOptionalNativeModule } from 'expo';
import * as ImagePicker from 'expo-image-picker';
import { strings } from '@dologram/shared';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';
import { Icon } from './Icon';
import { PhotoViewer } from './PhotoViewer';
import { VideoPlayback } from './VideoPlayback';

export type MediaLibraryAsset = {
  id: string;
  uri: string;
  filename: string;
  mediaType: 'photo' | 'video';
  duration?: number;
};

type MediaTab = 'all' | 'photo' | 'video';
type Album = { id: string; title: string; assetCount: number };

export type MediaPickerPanelProps = {
  visible: boolean;
  maxSelection: number;
  onClose: () => void;
  onDone: (assets: MediaLibraryAsset[]) => void;
  onError: (message: string) => void;
};

const PAGE_SIZE = 80;
const PICKER_MIN_HEIGHT = 280;
const PICKER_MAX_HEIGHT = 620;
const PICKER_TRANSITION_DURATION = 240;
const PICKER_DRAG_THRESHOLD = 48;
const PICKER_SWIPE_VELOCITY = 900;

function pickerBounds(screenHeight: number) {
  const min = Math.min(340, Math.max(PICKER_MIN_HEIGHT, screenHeight * 0.34));
  const max = Math.min(PICKER_MAX_HEIGHT, Math.max(min + 80, screenHeight * 0.72));
  return { min, max, initial: Math.min(400, max) };
}

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

// Older development builds and Expo Go may not include this native module.
// Check before evaluating the package: its entry point throws when it is absent.
const MediaLibrary: typeof import('expo-media-library/legacy') | null =
  requireOptionalNativeModule('ExpoMediaLibrary')
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Must not evaluate the native entry point when unavailable.
    ? require('expo-media-library/legacy')
    : null;

export function MediaPickerPanel({ visible, maxSelection, onClose, onDone, onError }: MediaPickerPanelProps) {
  const theme = useTheme();
  const c = theme.colors;
  const { height } = useWindowDimensions();
  const bounds = useMemo(() => pickerBounds(height), [height]);
  const [tab, setTab] = useState<MediaTab>('all');
  const [album, setAlbum] = useState<Album | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(visible);
  const [assets, setAssets] = useState<MediaLibraryAsset[]>([]);
  const [selected, setSelected] = useState<MediaLibraryAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<MediaLibraryAsset | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [page, setPage] = useState<{ cursor: string; hasNext: boolean } | null>(null);
  const requestVersion = useRef(0);
  const loadingPage = useRef(false);
  const duration = theme.reduceMotion ? 0 : PICKER_TRANSITION_DURATION;
  const panelHeight = useSharedValue(bounds.initial);
  const panelOpacity = useSharedValue(visible ? 1 : 0);
  const panelTranslateY = useSharedValue(visible ? 0 : 10);
  const gestureStartHeight = useSharedValue(bounds.initial);
  const gestureStartY = useSharedValue(0);

  const transitionTiming = useCallback(() => {
    'worklet';
    return {
      duration,
      easing: Easing.out(Easing.cubic),
    };
  }, [duration]);

  const panelAnimatedStyle = useAnimatedStyle(() => ({
    height: panelHeight.value,
    opacity: panelOpacity.value,
    transform: [{ translateY: panelTranslateY.value }],
  }));

  const animateHeight = useCallback((target: number) => {
    const nextHeight = clamp(target, bounds.min, bounds.max);
    cancelAnimation(panelHeight);
    setExpanded(nextHeight >= (bounds.min + bounds.max) / 2);
    panelHeight.value = withTiming(nextHeight, transitionTiming());
  }, [bounds, panelHeight, transitionTiming]);

  useEffect(() => {
    cancelAnimation(panelHeight);
    cancelAnimation(panelOpacity);
    cancelAnimation(panelTranslateY);
    if (visible) {
      panelHeight.value = bounds.initial;
      panelOpacity.value = 0;
      panelTranslateY.value = 10;
      panelOpacity.value = withTiming(1, transitionTiming());
      panelTranslateY.value = withTiming(0, transitionTiming());
      const mountTimer = setTimeout(() => {
        setMounted(true);
        setExpanded(false);
      }, 0);
      return () => clearTimeout(mountTimer);
    }

    panelHeight.value = withTiming(0, {
      duration,
      easing: Easing.in(Easing.cubic),
    });
    panelOpacity.value = withTiming(0, { duration, easing: Easing.in(Easing.cubic) });
    panelTranslateY.value = withTiming(10, { duration, easing: Easing.in(Easing.cubic) });
    const exitTimer = setTimeout(() => setMounted(false), duration);
    return () => clearTimeout(exitTimer);
  }, [bounds.initial, duration, panelHeight, panelOpacity, panelTranslateY, transitionTiming, visible]);

  const panGesture = useMemo(() => Gesture.Pan()
    .minDistance(4)
    .activeOffsetY([-8, 8])
    .failOffsetX([-32, 32])
    .onBegin((event) => {
      cancelAnimation(panelHeight);
      gestureStartHeight.value = panelHeight.value;
      gestureStartY.value = event.absoluteY;
    })
    .onUpdate((event) => {
      // The gesture root moves as the panel grows. Window coordinates keep
      // that layout movement from feeding back into the finger's drag distance.
      panelHeight.value = clamp(
        gestureStartHeight.value - (event.absoluteY - gestureStartY.value),
        bounds.min,
        bounds.max,
      );
    })
    .onEnd((event) => {
      const midpoint = (bounds.min + bounds.max) / 2;
      const dragDistance = event.absoluteY - gestureStartY.value;
      const target = event.velocityY < -PICKER_SWIPE_VELOCITY
        ? bounds.max
        : event.velocityY > PICKER_SWIPE_VELOCITY
          ? bounds.min
          : dragDistance < -PICKER_DRAG_THRESHOLD
            ? bounds.max
            : dragDistance > PICKER_DRAG_THRESHOLD
              ? bounds.min
              : panelHeight.value >= midpoint ? bounds.max : bounds.min;
      panelHeight.value = withTiming(target, transitionTiming());
      runOnJS(setExpanded)(target >= midpoint);
    }), [bounds, gestureStartHeight, gestureStartY, panelHeight, transitionTiming]);

  const loadAssets = useCallback(async (nextTab: MediaTab, nextAlbum: Album | null, after?: string) => {
    if (!MediaLibrary) return;
    const library = MediaLibrary;
    const version = after ? requestVersion.current : ++requestVersion.current;
    if (after && loadingPage.current) return;
    loadingPage.current = true;
    setLoading(true);
    setPermissionDenied(false);
    setLoadFailed(false);
    try {
      if (!after) {
        setAssets([]);
        setPage(null);
        const permission = await library.requestPermissionsAsync(false, ['photo', 'video']);
        if (version !== requestVersion.current) return;
        if (!permission.granted) {
          setPermissionDenied(true);
          return;
        }
        // Album enumeration is optional; the recent gallery still works if it fails.
        const availableAlbums = await library.getAlbumsAsync({ includeSmartAlbums: true }).catch(() => []);
        if (version !== requestVersion.current) return;
        setAlbums(availableAlbums.filter((item) => item.assetCount > 0));
      }
      const result = await library.getAssetsAsync({
        first: PAGE_SIZE,
        after,
        album: nextAlbum?.id,
        mediaType: nextTab === 'all' ? [library.MediaType.photo, library.MediaType.video] : nextTab === 'photo' ? library.MediaType.photo : library.MediaType.video,
        sortBy: [library.SortBy.creationTime],
      });
      if (version !== requestVersion.current) return;
      const nextAssets: MediaLibraryAsset[] = result.assets
        .filter((asset) => asset.mediaType === 'photo' || asset.mediaType === 'video')
        .map((asset) => ({ id: asset.id, uri: asset.uri, filename: asset.filename, mediaType: asset.mediaType as 'photo' | 'video', duration: asset.duration ?? undefined }));
      setAssets((current) => after ? [...current, ...nextAssets.filter((asset) => !current.some((item) => item.id === asset.id))] : nextAssets);
      setPage({ cursor: result.endCursor, hasNext: result.hasNextPage });
    } catch {
      if (version === requestVersion.current) {
        setLoadFailed(true);
        onError(strings.media.pickerFailed);
      }
    } finally {
      if (version === requestVersion.current) {
        setLoading(false);
        loadingPage.current = false;
      }
    }
  }, [onError]);

  useEffect(() => {
    if (!visible) return;
    const task = setTimeout(() => void loadAssets(tab, album), 0);
    return () => {
      clearTimeout(task);
      requestVersion.current += 1;
      loadingPage.current = false;
    };
  }, [album, loadAssets, tab, visible]);

  useEffect(() => {
    if (!visible) {
      const task = setTimeout(() => {
        setSelected([]);
        setPermissionDenied(false);
        setMenuOpen(false);
        setPreviewAsset(null);
      }, 0);
      return () => clearTimeout(task);
    }
    return undefined;
  }, [visible]);

  const selectedIds = useMemo(() => new Set(selected.map((asset) => asset.id)), [selected]);

  const toggleAsset = (asset: MediaLibraryAsset) => {
    if (selectedIds.has(asset.id)) {
      setSelected((current) => current.filter((item) => item.id !== asset.id));
      return;
    }
    if (selected.length >= maxSelection) {
      onError(strings.media.tooMany);
      return;
    }
    setSelected((current) => [...current, asset]);
  };

  const finishSelection = async () => {
    if (!MediaLibrary) return;
    const library = MediaLibrary;
    setResolving(true);
    try {
      const hydrated = await Promise.all(selected.map(async (asset) => {
        try {
          const info = await library.getAssetInfoAsync(asset.id, { shouldDownloadFromNetwork: true });
          return { ...asset, uri: info.localUri ?? info.uri ?? asset.uri };
        } catch {
          return asset;
        }
      }));
      onDone(hydrated);
    } finally {
      setResolving(false);
    }
  };

  const openSystemPicker = async () => {
    const remaining = maxSelection - selected.length;
    if (remaining <= 0) {
      onError(strings.media.tooMany);
      return;
    }
    setResolving(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: tab === 'all' ? ['images', 'videos'] : tab === 'photo' ? ['images'] : ['videos'],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 1,
      });
      if (result.canceled) return;
      if (result.assets.length > remaining) {
        onError(strings.media.tooMany);
        return;
      }
      const picked: MediaLibraryAsset[] = result.assets.map((asset) => ({
        id: asset.assetId ?? asset.uri,
        uri: asset.uri,
        filename: asset.fileName ?? '',
        mediaType: asset.type === 'video' ? 'video' : 'photo',
        duration: asset.duration ?? undefined,
      }));
      // Native-library selections may need their local URI resolved before upload.
      const existing = await Promise.all(selected.map(async (asset) => {
        if (!MediaLibrary) return asset;
        const info = await MediaLibrary.getAssetInfoAsync(asset.id, { shouldDownloadFromNetwork: true });
        return { ...asset, uri: info.localUri ?? info.uri ?? asset.uri };
      }));
      onDone([...existing, ...picked.filter((asset) => !selectedIds.has(asset.id))]);
    } catch {
      onError(strings.media.pickerFailed);
    } finally {
      setResolving(false);
    }
  };

  if (!mounted) return null;

  const chooseSource = (nextTab: MediaTab, nextAlbum: Album | null = null) => {
    setTab(nextTab);
    setAlbum(nextAlbum);
    setMenuOpen(false);
  };
  const previewTitle = previewAsset?.mediaType === 'video' ? 'Video preview' : 'Photo preview';
  const previewLabel = previewAsset?.mediaType === 'video' ? 'video' : 'photo';
  const sourceTitle = album?.title ?? (tab === 'video' ? 'Videos' : tab === 'photo' ? 'Photos' : 'All photos');

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <Animated.View style={[styles.panel, { backgroundColor: c.bg.chat }, panelAnimatedStyle]} accessibilityLabel="Media picker">
        <GestureDetector gesture={panGesture}>
          <Pressable
            onPress={() => animateHeight(expanded ? bounds.min : bounds.max)}
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Collapse media picker' : 'Expand media picker'}
            accessibilityHint="Swipe up to expand or down to collapse"
            accessibilityState={{ expanded }}
            style={styles.handleTarget}
          >
            <View style={[styles.handle, { backgroundColor: c.text.muted }]} />
          </Pressable>
        </GestureDetector>
      <View style={styles.toolbar}>
        <Pressable onPress={() => setMenuOpen((value) => !value)} accessibilityRole="button" accessibilityLabel="Choose photo album" accessibilityState={{ expanded: menuOpen }} style={styles.sourceButton}>
          <Text numberOfLines={1} style={[textStyle(theme.typeTokens.titleSm), styles.sourceTitle, { color: c.text.primary }]}>{sourceTitle}</Text>
          <View style={{ transform: [{ rotate: menuOpen ? '-90deg' : '90deg' }] }}><Icon name="nav.forward" size="sm" color={c.text.primary} accessibilityLabel="" /></View>
        </Pressable>
        <Pressable onPress={() => void openSystemPicker()} disabled={resolving} accessibilityRole="button" accessibilityLabel="Open device gallery" style={[styles.toolbarButton, { backgroundColor: c.bg.surface }]}>
          <Icon name="action.gallery" size="sm" color={c.brand.primary} accessibilityLabel="" />
        </Pressable>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close media picker" style={styles.toolbarButton}>
          <Icon name="nav.close" size="sm" color={c.text.secondary} accessibilityLabel="" />
        </Pressable>
      </View>

      {menuOpen ? (
        <FlatList
          key="albums"
          data={[
            { key: 'all', title: 'All photos', tab: 'all' as const, album: null },
            { key: 'photo', title: 'Photos', tab: 'photo' as const, album: null },
            { key: 'video', title: 'Videos', tab: 'video' as const, album: null },
            ...albums.map((item) => ({ key: `album-${item.id}`, title: item.title, tab: 'all' as const, album: item })),
          ]}
          keyExtractor={(item) => item.key}
          accessibilityLabel="Photo albums"
          renderItem={({ item }) => {
            const active = item.album ? album?.id === item.album.id : !album && tab === item.tab;
            return <Pressable onPress={() => chooseSource(item.tab, item.album)} accessibilityRole="button" accessibilityLabel={item.title} accessibilityState={{ selected: active }} style={[styles.albumRow, active && { backgroundColor: c.bg.surface }]}>
              <Icon name={item.tab === 'video' ? 'media.video' : 'media.photo'} size="sm" color={active ? c.brand.primary : c.text.secondary} accessibilityLabel="" />
              <Text numberOfLines={1} style={[textStyle(theme.typeTokens.bodyLg), styles.sourceTitle, { color: active ? c.brand.primary : c.text.primary }]}>{item.title}</Text>
              {item.album ? <Text style={[textStyle(theme.typeTokens.bodySm), { color: c.text.muted }]}>{item.album.assetCount}</Text> : null}
            </Pressable>;
          }}
        />
      ) : !MediaLibrary ? (
        <View style={styles.center}>
          <Icon name="media.photo" size="lg" color={c.text.muted} accessibilityLabel="" />
          <Text style={[textStyle(theme.typeTokens.bodySm), styles.centerText, { color: c.text.secondary }]}>Your photos and videos, ready to share.</Text>
          <Pressable onPress={() => void openSystemPicker()} disabled={resolving} accessibilityRole="button" accessibilityLabel="Choose media from device" style={[styles.retry, { backgroundColor: c.brand.primary }]}>
            {resolving ? <ActivityIndicator color={c.bubble.outgoingText} /> : <Text style={[textStyle(theme.typeTokens.labelMd), { color: c.bubble.outgoingText }]}>Open gallery</Text>}
          </Pressable>
        </View>
      ) : loading && assets.length === 0 ? <View style={styles.center}><ActivityIndicator color={c.brand.primary} /></View> : permissionDenied || loadFailed && assets.length === 0 ? (
        <View style={styles.center}>
          <Icon name="media.photo" size="lg" color={c.text.muted} accessibilityLabel="" />
          <Text style={[textStyle(theme.typeTokens.bodySm), styles.centerText, { color: c.text.secondary }]}>{permissionDenied ? 'Allow access to your photos and videos to browse them here.' : strings.media.pickerFailed}</Text>
          <Pressable onPress={() => void loadAssets(tab, album)} accessibilityRole="button" accessibilityLabel={permissionDenied ? 'Allow photo access' : 'Retry loading gallery'} style={[styles.retry, { backgroundColor: c.brand.primary }]}>
            <Text style={[textStyle(theme.typeTokens.labelMd), { color: c.bubble.outgoingText }]}>{strings.common.retry}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          key="gallery"
          accessibilityLabel="Recent media"
          data={assets}
          extraData={selected}
          style={styles.gallery}
          keyExtractor={(asset) => asset.id}
          numColumns={4}
          contentContainerStyle={assets.length === 0 ? styles.emptyList : undefined}
          columnWrapperStyle={styles.row}
          onEndReached={() => { if (page?.hasNext && !loading && !loadFailed) void loadAssets(tab, album, page.cursor); }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loading ? <ActivityIndicator style={styles.pageSpinner} color={c.brand.primary} /> : loadFailed ? <Pressable onPress={() => void loadAssets(tab, album, page?.cursor)} accessibilityRole="button" accessibilityLabel="Retry loading more media" style={styles.albumRow}><Text style={{ color: c.brand.primary }}>{strings.common.retry}</Text></Pressable> : null}
          ListEmptyComponent={<Text style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary }]}>No {tab === 'video' ? 'videos' : 'photos'} yet.</Text>}
          renderItem={({ item }) => {
            const position = selected.findIndex((asset) => asset.id === item.id);
            return (
              <Pressable
                onPress={() => toggleAsset(item)}
                onLongPress={() => setPreviewAsset(item)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: position >= 0 }}
                accessibilityLabel={`${item.filename || (item.mediaType === 'photo' ? 'Image' : 'Video')}${position >= 0 ? `, selected ${position + 1}` : ''}`}
                accessibilityHint="Tap to select or deselect. Long press to preview."
                disabled={resolving}
                style={[styles.asset, { backgroundColor: c.bg.surface, borderColor: c.bg.chat }]}
              >
                <Image source={{ uri: item.uri }} style={styles.assetImage} resizeMode="cover" />
                {item.mediaType === 'video' ? (
                  <View style={[styles.videoBadge, { backgroundColor: c.scrim }]} pointerEvents="none">
                    <Icon name="action.play" size="xs" color={c.bubble.outgoingText} accessibilityLabel="" />
                    {item.duration !== undefined ? <Text style={[styles.duration, { color: c.bubble.outgoingText }]}>{formatDuration(item.duration)}</Text> : null}
                  </View>
                ) : null}
                {position >= 0 ? <View pointerEvents="none" style={styles.selection}><Icon name="status.sent" size="sm" color={c.brand.primary} accessibilityLabel="Selected" /></View> : null}
              </Pressable>
            );
          }}
        />
      )}

      {selected.length > 0 ? <View style={[styles.footer, { backgroundColor: c.bg.chat, borderTopColor: c.separator }]}>
        <Text accessibilityLiveRegion="polite" style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary }]}>{selected.length} / {maxSelection} selected</Text>
        <Pressable
          onPress={() => void finishSelection()}
          disabled={selected.length === 0 || resolving}
          accessibilityRole="button"
          accessibilityLabel="Add selected media"
          style={[styles.done, { backgroundColor: c.brand.primary }]}
        >
          {resolving ? <ActivityIndicator color={c.bubble.outgoingText} /> : <Text style={[textStyle(theme.typeTokens.labelMd), { color: c.bubble.outgoingText }]}>Add {selected.length === 1 ? 'attachment' : `${selected.length} items`}</Text>}
        </Pressable>
      </View> : null}

      <Modal
        visible={previewAsset !== null}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setPreviewAsset(null)}
        accessibilityViewIsModal
      >
        <View style={[styles.previewModal, { backgroundColor: c.bg.app }]} accessibilityLabel={previewTitle}>
          <View style={styles.previewHeader}>
            <Text style={[textStyle(theme.typeTokens.titleSm), { color: c.text.primary }]}>{previewTitle}</Text>
            <Pressable
              onPress={() => setPreviewAsset(null)}
              accessibilityRole="button"
              accessibilityLabel={`Close ${previewLabel} preview`}
              style={styles.previewClose}
            >
              <Icon name="nav.close" size="md" color={c.text.primary} accessibilityLabel="" />
            </Pressable>
          </View>
          <View style={styles.previewContent}>
            {previewAsset?.mediaType === 'photo' ? <PhotoViewer uri={previewAsset.uri} onError={() => onError(strings.common.couldNotLoad)} /> : null}
            {previewAsset?.mediaType === 'video' ? <VideoPlayback uri={previewAsset.uri} onError={() => onError(strings.common.couldNotLoad)} /> : null}
          </View>
        </View>
      </Modal>
      </Animated.View>
    </GestureHandlerRootView>
  );
}

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  gestureRoot: { width: '100%' },
  panel: { overflow: 'hidden' },
  handleTarget: { height: 28, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 36, height: 4, borderRadius: 2 },
  toolbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
  sourceButton: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
  sourceTitle: { flexShrink: 1 },
  toolbarButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  albumRow: { minHeight: 52, paddingHorizontal: 16, gap: 12, flexDirection: 'row', alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 8 },
  centerText: { textAlign: 'center' },
  retry: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18 },
  gallery: { flex: 1 },
  pageSpinner: { padding: 12 },
  emptyList: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  row: { gap: 0 },
  asset: { width: '25%', aspectRatio: 1, borderWidth: 0.5, overflow: 'hidden' },
  assetImage: { width: '100%', height: '100%' },
  videoBadge: { position: 'absolute', left: 4, bottom: 4, minHeight: 28, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 3 },
  duration: { fontSize: 11, fontWeight: '600' },
  selection: { position: 'absolute', top: 6, right: 6 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  done: { minWidth: 100, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, borderRadius: 24 },
  previewModal: { flex: 1 },
  previewHeader: { minHeight: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  previewContent: { flex: 1 },
});
