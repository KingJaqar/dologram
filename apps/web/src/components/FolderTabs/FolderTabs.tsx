'use client';

import Link from 'next/link';
import type { FolderRow } from '@dologram/shared/src/db/repositories/folders';
import { strings } from '@dologram/shared/src/strings';
import styles from './FolderTabs.module.css';

/**
 * CMP-14: "All" plus the account's folders. A folder tab is a link, so the selection lives in
 * `?folder=` and survives a reload (12.6). Without folders there is nothing to switch between.
 */
export function FolderTabs({ folders, selected }: { folders: readonly FolderRow[]; selected: string | null }) {
  if (folders.length === 0) return null;
  return (
    <div role="tablist" aria-label={strings.chatList.folders} className={styles.tabs}>
      <Link role="tab" aria-selected={selected === null} className={styles.tab} href="/" scroll={false}>
        {strings.chatList.all}
      </Link>
      {folders.map((folder) => (
        <Link
          key={folder.folder_id}
          role="tab"
          aria-selected={selected === folder.folder_id}
          className={styles.tab}
          href={`/?folder=${encodeURIComponent(folder.folder_id)}`}
          scroll={false}
        >
          {folder.name}
        </Link>
      ))}
    </div>
  );
}
