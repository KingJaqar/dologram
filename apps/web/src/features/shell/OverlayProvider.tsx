'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { Dialog } from '../../components/Dialog/Dialog';
import { SettingsDialog } from '../settings/SettingsDialog';
import { useOverlayHistory } from '../../lib/useOverlayHistory';

type OverlayKind = 'newChat' | 'newGroup' | 'forward' | 'folders' | 'settings' | 'media';
type OverlayState = { kind: 'none' | OverlayKind; props?: object };
const Context = createContext<{ state: OverlayState; open: (kind: OverlayKind, props?: object) => void } | null>(null);

export function OverlayProvider({ children }: { children: ReactNode }) {
  const newChat = useOverlayHistory('shell-newChat');
  const newGroup = useOverlayHistory('shell-newGroup');
  const forward = useOverlayHistory('shell-forward');
  const folders = useOverlayHistory('shell-folders');
  const settings = useOverlayHistory('shell-settings');
  const media = useOverlayHistory('shell-media');
  const handles = { newChat, newGroup, forward, folders, settings, media };
  const [payloads, setPayloads] = useState<Partial<Record<OverlayKind, object>>>({});
  const kind = (Object.keys(handles) as OverlayKind[]).reverse().find((key) => handles[key].open);
  const state: OverlayState = kind ? { kind, props: payloads[kind] } : { kind: 'none' };
  return <Context value={{ state, open: (next, props) => {
    setPayloads((current) => ({ ...current, [next]: props }));
    handles[next].show();
  } }}>
    {children}
    <Dialog overlay={newChat} title="New chat">{null}</Dialog>
    <Dialog overlay={newGroup} title="New group">{null}</Dialog>
    <Dialog overlay={settings} title="Settings"><SettingsDialog /></Dialog>
  </Context>;
}

export function useOverlay() {
  const value = useContext(Context);
  if (!value) throw new Error('OverlayProvider is required');
  return value;
}
