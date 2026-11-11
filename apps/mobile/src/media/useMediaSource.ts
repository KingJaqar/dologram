import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { config, createMediaSignedUrl, mediaBucket, strings } from '@dologram/shared';
import { supabase } from '../lib/supabase';
import type { ChatAttachment } from './model';

type SourceState = { uri: string | null; error: string | null; loading: boolean; mime?: string; sizeBytes?: number };

/** One expiry timer, coalesced requests, no automatic failure retry, and no persisted signed URLs. */
export function useMediaSource(attachment: ChatAttachment) {
  const { localUri, storagePath, mediaType } = attachment;
  const [state, setState] = useState<SourceState>({ uri: localUri ?? null, error: null, loading: !localUri });
  const retryRef = useRef<() => Promise<void>>(async () => {});
  const failRef = useRef<() => void>(() => {});

  useEffect(() => {
    let alive = true;
    let pending = false;
    let expiresAt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      if (pending || !alive) return;
      pending = true;
      if (timer) clearTimeout(timer);
      setState((current) => ({ ...current, error: null, loading: !current.uri }));
      try {
        if (localUri) {
          if (alive) setState({ uri: localUri, error: null, loading: false });
          return;
        }
        if (!storagePath) throw new Error(strings.media.unavailable);
        const issuedAt = Date.now();
        const signed = await createMediaSignedUrl(supabase, mediaType, storagePath);
        if (signed.error || !signed.data) throw new Error(strings.common.couldNotLoad);
        // The actual schema stores no MIME/size; Storage is the source of this metadata.
        const info = mediaType === 'file' || mediaType === 'video'
          ? await supabase.storage.from(mediaBucket(mediaType)).info(storagePath) : null;
        if (info?.error) throw new Error(strings.common.couldNotLoad);
        if (!alive) return;
        expiresAt = issuedAt + config.media.signedUrlSeconds * 1000;
        setState({ uri: signed.data, error: null, loading: false, mime: info?.data?.contentType, sizeBytes: info?.data?.size });
        timer = setTimeout(() => { if (AppState.currentState === 'active') void load(); }, Math.max(1, expiresAt - Date.now()));
      } catch {
        if (alive) setState((current) => ({ ...current, error: strings.common.couldNotLoad, loading: false }));
      } finally { pending = false; }
    }
    retryRef.current = load;
    failRef.current = () => {
      if (timer) clearTimeout(timer);
      if (alive) setState((current) => ({ ...current, error: strings.common.couldNotLoad, loading: false }));
    };
    void Promise.resolve().then(load);
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' && !localUri && Date.now() >= expiresAt) void load();
    });
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      subscription.remove();
      retryRef.current = async () => {};
      failRef.current = () => {};
    };
  }, [localUri, mediaType, storagePath]);

  return { ...state, mime: attachment.mime ?? state.mime, sizeBytes: attachment.sizeBytes ?? state.sizeBytes,
    retry: useCallback(() => { void retryRef.current(); }, []),
    fail: useCallback(() => failRef.current(), []),
  };
}
