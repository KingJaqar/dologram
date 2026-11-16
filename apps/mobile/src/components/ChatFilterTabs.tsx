/** Filter tabs for the main chat list. */
import React from 'react';
import { strings } from '@dologram/shared';
import { FilterTabs } from './FilterTabs';

export type ChatFilter = 'all' | 'unread' | 'groups' | 'memo' | 'starred';

export interface ChatFilterTabsProps {
  activeFilter: ChatFilter;
  onSelect: (filter: ChatFilter) => void;
}

export function ChatFilterTabs({ activeFilter, onSelect }: ChatFilterTabsProps) {
  return (
    <FilterTabs<ChatFilter>
      tabs={[
        { value: 'all', label: strings.chatList.all },
        { value: 'unread', label: strings.chatList.unread },
        { value: 'groups', label: strings.chatList.groups },
        { value: 'memo', label: strings.chatList.memo },
        { value: 'starred', label: strings.chatList.starred },
      ]}
      activeValue={activeFilter}
      onSelect={onSelect}
      indicatorTestID="chat-filter-indicator"
    />
  );
}
