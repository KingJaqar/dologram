'use client';

import { useEffect } from 'react';

export function useDocumentTitle(unread = 0) {
  useEffect(() => {
    const count = Number.isSafeInteger(unread) && unread > 0 ? unread : 0;
    document.title = count ? `(${count}) DoloGram` : 'DoloGram';
    return () => { document.title = 'DoloGram'; };
  }, [unread]);
}
