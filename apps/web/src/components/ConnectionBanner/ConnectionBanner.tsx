'use client';

import { useEffect, useState } from 'react';
import { strings } from '@dologram/shared/src/strings';
import { Icon } from '../Icon/Icon';
import styles from './ConnectionBanner.module.css';

/**
 * CMP-13 on web: only the "No connection" row exists (D-12, D-19). It follows the browser's own
 * online state, so it also appears when a request fails while the browser still reports online.
 */
export function ConnectionBanner() {
  // The server cannot know the browser state, so the banner starts hidden and follows events.
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online ? null : (
    <div role="status" className={styles.banner}>
      <Icon name="conn.offline" size="sm" />
      <span>{strings.chatList.offlineBanner}</span>
    </div>
  );
}
