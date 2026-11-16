'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../Avatar/Avatar';
import { Icon } from '../Icon/Icon';
import { Menu } from '../Menu/Menu';
import { useSession } from '../../lib/session/SessionProvider';
import { useOverlay } from '../../features/shell/OverlayProvider';
import logo from '../../../assets/logo/dologram_web_logo.png';
import styles from './NavRail.module.css';

export function NavRail() {
  const { profile, session } = useSession();
  const { open } = useOverlay();
  const [menu, setMenu] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const query = matchMedia('(min-width: 768px)');
    const changed = () => { if (!query.matches) setMenu(false); };
    query.addEventListener('change', changed);
    return () => query.removeEventListener('change', changed);
  }, []);
  const choose = (kind: 'newChat' | 'newGroup') => { anchor.current?.focus(); open(kind); };
  return <nav aria-label="Main" className={styles.rail}>
    <Link href="/" aria-label="DoloGram, chats" data-tooltip="DoloGram, chats" className={styles.mark}><Image src={logo} alt="" width={32} height={32} className={styles.logo} unoptimized /></Link>
    <Link href="/" aria-label="Chats" aria-current="page" data-tooltip="Chats" className={styles.item}><Icon name="nav.chats" size="lg" /></Link>
    <button ref={anchor} type="button" aria-label="New" data-tooltip="New" className={styles.item} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((value) => !value)}><Icon name="nav.new" size="lg" /></button>
    <button type="button" aria-label="Profile and settings" data-tooltip="Profile and settings" className={`${styles.item} ${styles.profile}`} aria-haspopup="dialog" onClick={() => open('settings')}>
      <Avatar id={profile?.user_id ?? session?.user.id ?? ''} displayName={profile?.display_name ?? profile?.username ?? ''} size={24} />
    </button>
    <Menu open={menu} onClose={() => setMenu(false)} anchorRef={anchor} label="New" items={[
      { id: 'chat', label: 'New chat', onSelect: () => choose('newChat') },
      { id: 'group', label: 'New group', onSelect: () => choose('newGroup') },
    ]} />
  </nav>;
}
