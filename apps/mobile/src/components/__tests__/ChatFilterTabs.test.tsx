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
    expect(screen.getByRole('tab', { name: 'Starred' })).toBeTruthy();

    fireEvent.press(screen.getByRole('tab', { name: 'Groups' }));
    expect(onSelect).toHaveBeenCalledWith('groups');
  });
});
