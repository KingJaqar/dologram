'use client';

import { createContext, useEffect, useEffectEvent, type RefObject } from 'react';

export const ModalPortalContext = createContext<HTMLElement | null>(null);
const modalStack: HTMLElement[] = [];
const inertOwners = new Map<HTMLElement, { count: number; original: boolean }>();
let scrollLocks = 0;
let originalOverflow = '';
const focusSelector = 'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])';
function focusable(element: HTMLElement) {
  return Array.from(element.querySelectorAll<HTMLElement>(focusSelector)).filter((node) => node.tabIndex >= 0 && !node.closest('[inert]') && node.getClientRects().length > 0);
}

/** Background inertness is reference-preserving, including nested manual/native modals. */
export function useModal(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void, native = false) {
  const dismiss = useEffectEvent(onClose);
  useEffect(() => {
    const element = ref.current;
    if (!open || !element) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = native && element instanceof HTMLDialogElement ? element : null;
    dialog?.showModal();
    if (scrollLocks === 0) originalOverflow = document.body.style.overflow;
    scrollLocks += 1;
    document.body.style.overflow = 'hidden';
    const inertNodes: HTMLElement[] = [];
    let branch: HTMLElement = element;
    while (branch.parentElement) {
      for (const sibling of Array.from(branch.parentElement.children)) {
        if (sibling !== branch && sibling instanceof HTMLElement && !['SCRIPT', 'STYLE', 'LINK'].includes(sibling.tagName)) {
          inertNodes.push(sibling);
          const owner = inertOwners.get(sibling) ?? { count: 0, original: sibling.inert };
          owner.count += 1;
          inertOwners.set(sibling, owner);
          sibling.inert = true;
        }
      }
      branch = branch.parentElement;
      if (branch === document.body) break;
    }
    modalStack.push(element);
    const first = focusable(element)[0];
    (first || element).focus();
    const keydown = (event: KeyboardEvent) => {
      if (modalStack.at(-1) !== element || event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        dismiss();
      } else if (event.key === 'Tab') {
        const items = focusable(element);
        const first = items[0];
        const last = items.at(-1);
        if (!first || !last) { event.preventDefault(); element.focus(); }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === element)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    const contain = (event: FocusEvent) => {
      if (modalStack.at(-1) === element && event.target instanceof Node && !element.contains(event.target)) (focusable(element)[0] || element).focus();
    };
    document.addEventListener('keydown', keydown);
    document.addEventListener('focusin', contain);
    return () => {
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('focusin', contain);
      const index = modalStack.lastIndexOf(element);
      if (index >= 0) modalStack.splice(index, 1);
      for (const node of inertNodes) {
        const owner = inertOwners.get(node);
        if (owner && --owner.count === 0) { node.inert = owner.original; inertOwners.delete(node); }
      }
      dialog?.close();
      scrollLocks -= 1;
      if (scrollLocks === 0) document.body.style.overflow = originalOverflow;
      if (opener?.isConnected && !opener.closest('[inert]')) opener.focus();
    };
  }, [ref, open, native]);
}
