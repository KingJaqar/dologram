'use client';

import { useContext, useId, useLayoutEffect, useRef, useEffectEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { ModalPortalContext } from '../../lib/useModal';
import { useDelayedFlag } from '../../lib/useDelayedFlag';
import { Icon } from '../Icon/Icon';
import styles from './Menu.module.css';

export interface MenuItem { id: string; label: string; onSelect: () => void; disabledReason?: string; danger?: boolean; loading?: boolean }
export interface MenuProps { open: boolean; onClose: () => void; anchorRef: RefObject<HTMLElement | null>; label: string; items: readonly MenuItem[] }
export function Menu({ open, onClose, anchorRef, label, items }: MenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const portal = useContext(ModalPortalContext);
  const id = useId();
  const dismiss = useEffectEvent(onClose);
  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const element = ref.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : anchorRef.current;
    const position = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      if (!anchor) { dismiss(); return; }
      const rect = element.getBoundingClientRect();
      element.style.setProperty('--dg-menu-left', `${Math.max(0, Math.min(anchor.left, innerWidth - rect.width))}px`);
      element.style.setProperty('--dg-menu-top', `${Math.max(0, Math.min(anchor.bottom, innerHeight - rect.height))}px`);
    };
    position();
    (element.querySelector<HTMLElement>('[role="menuitem"]') || element).focus();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !element.contains(event.target) && !anchorRef.current?.contains(event.target)) dismiss();
    };
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    document.addEventListener('pointerdown', outside);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      document.removeEventListener('pointerdown', outside);
      if (opener?.isConnected && !opener.closest('[inert]')) opener.focus();
    };
  }, [open, anchorRef]);
  if (!open) return null;
  return createPortal(<div ref={ref} role="menu" tabIndex={-1} aria-label={label} className={styles.menu} onKeyDown={(event) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
    else if (event.key === 'Tab') onClose();
    else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const nodes = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
      const current = nodes.findIndex((node) => node === document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? nodes.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + nodes.length) % nodes.length;
      nodes[next]?.focus();
    }
  }}>
    {items.map((item) => <MenuAction key={item.id} item={item} reasonId={`${id}-${item.id}`} onClose={onClose} />)}
  </div>, portal || document.body);
}

function MenuAction({ item, reasonId, onClose }: { item: MenuItem; reasonId: string; onClose: () => void }) {
  const showSpinner = useDelayedFlag(!!item.loading);
  return <button role="menuitem" type="button" tabIndex={-1} className={styles.item} data-danger={item.danger || undefined}
    aria-disabled={!!item.disabledReason || !!item.loading} aria-busy={item.loading || undefined} aria-describedby={item.disabledReason ? reasonId : undefined} title={item.disabledReason}
    onClick={() => { if (!item.disabledReason && !item.loading) { onClose(); item.onSelect(); } }}>
    {item.label}{showSpinner && <Icon name="status.sending" className={styles.spinner} />}{item.disabledReason && <span id={reasonId} className={styles.reason}>{item.disabledReason}</span>}
  </button>;
}
