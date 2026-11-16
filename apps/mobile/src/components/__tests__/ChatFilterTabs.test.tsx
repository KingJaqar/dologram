import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { ChatFilterTabs } from '../ChatFilterTabs';

describe('ChatFilterTabs', () => {
  test('renders all filters and reports the selected filter', () => {
    const onSelect = jest.fn();
    const screen = render(
      <ThemeProvider>
        <ChatFilterTabs activeFilter="all" onSelect={onSelect} />
      </ThemeProvider>,
    );

    expect(screen.getByRole('tab', { name: 'All' }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByRole('tab', { name: 'Unread' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Groups' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Memo' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Starred' })).toBeTruthy();

    fireEvent.press(screen.getByRole('tab', { name: 'Memo' }));
    expect(onSelect).toHaveBeenCalledWith('memo');
  });

  test('keeps one indicator mounted through rapid selection changes and ignores reselects', () => {
    const onSelect = jest.fn();
    const renderTabs = (activeFilter: 'all' | 'unread' | 'groups' | 'memo' | 'starred') => (
      <ThemeProvider>
        <ChatFilterTabs activeFilter={activeFilter} onSelect={onSelect} />
      </ThemeProvider>
    );
    const screen = render(renderTabs('all'));
    ['All', 'Unread', 'Groups', 'Memo', 'Starred'].forEach((name, index) => {
      fireEvent(screen.getByRole('tab', { name }), 'layout', {
        nativeEvent: { layout: { x: index * 90, y: 0, width: 82, height: 36 } },
      });
    });
    const indicator = screen.getByTestId('chat-filter-indicator');
    for (const filter of ['starred', 'memo', 'unread', 'groups', 'all'] as const) {
      screen.rerender(renderTabs(filter));
      expect(screen.getAllByTestId('chat-filter-indicator')).toHaveLength(1);
      expect(screen.getByTestId('chat-filter-indicator')).toBe(indicator);
    }
    fireEvent.press(screen.getByRole('tab', { name: 'All' }));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('tab', { name: 'All' }).props.accessibilityState.selected).toBe(true);
  });
});
