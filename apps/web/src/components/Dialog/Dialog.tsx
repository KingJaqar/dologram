'use client';

import { useContext, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { OverlayHistory } from '../../lib/useOverlayHistory';
import { ModalPortalContext, useModal } from '../../lib/useModal';
import { IconButton } from '../IconButton/IconButton';
import styles from './Dialog.module.css';

export interface DialogProps { overlay: OverlayHistory; title: string; children: ReactNode; variant?: 'form' | 'confirm'; footer?: ReactNode }
export function Dialog({ overlay, title, children, variant = 'form', footer }: DialogProps) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const parent = useContext(ModalPortalContext);
  const [portal, setPortal] = useState<HTMLDivElement | null>(null);
  useModal(ref, overlay.open, overlay.close, true);
  if (!overlay.open) return null;
  return createPortal(<dialog ref={ref} className={styles.dialog} data-variant={variant} aria-labelledby={titleId} aria-modal="true" tabIndex={-1}
    onCancel={(event) => { event.preventDefault(); event.stopPropagation(); overlay.close(); }}>
    <ModalPortalContext value={portal}>
      <header className={styles.header}><h2 id={titleId}>{title}</h2><IconButton icon="nav.close" label={`Close ${title}`} onClick={overlay.close} /></header>
      <div className={styles.content}>{children}</div>
      {footer && <footer className={styles.footer}>{footer}</footer>}
      <div ref={setPortal} />
    </ModalPortalContext>
  </dialog>, parent || document.body);
}
