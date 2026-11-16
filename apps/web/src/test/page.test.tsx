import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { MainLayout } from '../features/shell/MainLayout';

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock('../lib/session/SessionProvider', () => ({ useSession: () => ({ profile: { user_id: 'owner', display_name: 'Owner' } }) }));
vi.mock('../lib/store/StoreProvider', () => ({ StoreFeedback: () => <p role="status">Syncing your history…</p> }));
// The shell test covers composition; the list query has its own unit coverage.
vi.mock('../features/chatList/ChatListProvider', () => ({
  useChatListData: () => ({ status: 'ready', error: null, retry: vi.fn(), data: { active: [], archived: [], folders: [], folderChats: [], totalUnread: 0 } }),
}));

test('the guarded shell contains navigation, list, feedback and chat selection', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  render(<MainLayout>{null}</MainLayout>);
  expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { name: 'DoloGram' }));
  expect(screen.getByRole('region', { name: 'Chat list' })).toContainElement(screen.getByRole('status'));
  expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Select a chat' })).toBeInTheDocument();
  vi.unstubAllGlobals();
});

test('the configured IndexedDB environment persists a transaction', async () => {
  const request = indexedDB.open('phase-00-tooling', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('checks');
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    const tx = db.transaction('checks', 'readwrite');
    tx.objectStore('checks').put('ready', 'tooling');
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    });
    const read = db.transaction('checks').objectStore('checks').get('tooling');
    const value: unknown = await new Promise((resolve, reject) => {
      read.onsuccess = () => resolve(read.result);
      read.onerror = () => reject(read.error);
    });
    expect(value).toBe('ready');
  } finally {
    db.close();
    indexedDB.deleteDatabase('phase-00-tooling');
  }
});
