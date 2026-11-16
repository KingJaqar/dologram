'use client';

import { useRouter } from 'next/navigation';
import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { TopBar } from '../../components/TopBar/TopBar';
import { useOverlay } from './OverlayProvider';

export function ChatPane({ chatId }: { chatId?: string }) {
  const router = useRouter();
  const { open } = useOverlay();
  return chatId ? <section aria-label="Chat"><TopBar variant="screen" title={chatId} onBack={() => router.push('/')} /></section>
    : <EmptyState icon="action.newChat" title="Select a chat" action={<Button onClick={() => open('newChat')}>New chat</Button>} />;
}
