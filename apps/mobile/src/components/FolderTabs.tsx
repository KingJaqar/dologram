/** Horizontally scrolling folder filters, matching the chat-list tabs. */
import React from 'react';
import { strings } from '@dologram/shared';
import { IconButton } from './Button';
import { FilterTabs } from './FilterTabs';

export interface FolderTabsFolder {
  folder_id: string;
  name: string;
}

export interface FolderTabsProps {
  folders: readonly FolderTabsFolder[];
  /** Selected folder id; null is "All". */
  activeId: string | null;
  onSelect: (folderId: string | null) => void;
  onOpenFolders?: () => void;
}

export function FolderTabs({ folders, activeId, onSelect, onOpenFolders }: FolderTabsProps) {
  return (
    <FilterTabs<string | null>
      tabs={[
        { value: null, label: strings.chatList.all },
        ...folders.map((folder) => ({ value: folder.folder_id, label: folder.name })),
      ]}
      activeValue={activeId}
      onSelect={onSelect}
      indicatorTestID="folder-filter-indicator"
      trailing={onOpenFolders ? (
        <IconButton
          iconName="action.folder"
          iconSize="md"
          accessibilityLabel={strings.chatList.folders}
          onPress={onOpenFolders}
        />
      ) : null}
    />
  );
}
