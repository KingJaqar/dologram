import { renderHook } from '@testing-library/react';
import { expect, test } from 'vitest';
import { useDocumentTitle } from './useDocumentTitle';

test('unread title updates, rejects invalid counts and resets when the shell unmounts', () => {
  const { rerender, unmount } = renderHook(({ unread }) => useDocumentTitle(unread), { initialProps: { unread: 0 } });
  expect(document.title).toBe('DoloGram');
  rerender({ unread: 12 });
  expect(document.title).toBe('(12) DoloGram');
  rerender({ unread: Number.NaN });
  expect(document.title).toBe('DoloGram');
  rerender({ unread: -1 });
  expect(document.title).toBe('DoloGram');
  rerender({ unread: 0.5 });
  expect(document.title).toBe('DoloGram');
  rerender({ unread: 1 });
  expect(document.title).toBe('(1) DoloGram');
  unmount();
  expect(document.title).toBe('DoloGram');
});
