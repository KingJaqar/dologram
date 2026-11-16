'use client';

import Link from 'next/link';
import { BottomSheet } from '../BottomSheet/BottomSheet';
import { Button } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import { useOverlayHistory } from '../../lib/useOverlayHistory';
import { useOverlay } from '../../features/shell/OverlayProvider';
import styles from './TabBar.module.css';

export function TabBar({ onChats }: { onChats: () => void }) {
  const sheet = useOverlayHistory('shell-new-sheet');
  const { open } = useOverlay();
  return <>
    <nav aria-label="Chat tabs" className={styles.bar}>
      <Link href="/" aria-label="Chats" aria-current="page" title="Chats" onClick={(event) => { event.preventDefault(); onChats(); }}><Icon name="nav.chats" size="lg" /></Link>
      <button type="button" aria-label="New" title="New" aria-haspopup="dialog" aria-expanded={sheet.open} onClick={sheet.show}><Icon name="nav.new" size="lg" /></button>
      <button type="button" aria-label="Profile and settings" title="Profile and settings" aria-haspopup="dialog" onClick={() => open('settings')}><Icon name="nav.settings" size="lg" /></button>
    </nav>
    <BottomSheet overlay={sheet} title="New">
      <div className={styles.choices}><Button variant="text" onClick={() => open('newChat')}>New chat</Button><Button variant="text" onClick={() => open('newGroup')}>New group</Button></div>
    </BottomSheet>
  </>;
}
