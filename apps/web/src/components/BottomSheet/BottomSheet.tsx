'use client';

import { useContext, useEffect, useEffectEvent, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { OverlayHistory } from '../../lib/useOverlayHistory';
import { ModalPortalContext, useModal } from '../../lib/useModal';
import { IconButton } from '../IconButton/IconButton';
import styles from './BottomSheet.module.css';

export function BottomSheet({ overlay, title, children }: { overlay: OverlayHistory; title: string; children: ReactNode }) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const parent = useContext(ModalPortalContext);
  const [portal, setPortal] = useState<HTMLDivElement | null>(null);
  const close = useEffectEvent(overlay.close);
  useModal(ref, overlay.open, overlay.close);
  useEffect(() => {
    if (!overlay.open) return;
    const media = matchMedia('(min-width: 768px)');
    const resize = () => { if (media.matches) close(); };
    resize();
    media.addEventListener('change', resize);
    return () => media.removeEventListener('change', resize);
  }, [overlay.open]);
  if (!overlay.open) return null;
  return createPortal(<div ref={ref} className={styles.backdrop}>
    <button type="button" className={styles.scrim} aria-label={`Dismiss ${title}`} tabIndex={-1} onClick={overlay.close} />
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={styles.sheet}>
      <ModalPortalContext value={portal}>
        <div className={styles.handle} />
        <header className={styles.header}><h2 id={titleId}>{title}</h2><IconButton icon="nav.close" label={`Close ${title}`} onClick={overlay.close} /></header>
        {children}<div ref={setPortal} />
      </ModalPortalContext>
    </div>
  </div>, parent || document.body);
}
