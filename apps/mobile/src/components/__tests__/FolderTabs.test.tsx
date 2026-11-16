import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { FolderTabs } from '../FolderTabs';

describe('FolderTabs', () => {
  test('uses the shared filter-tab surface and keeps one animated indicator while switching folders', () => {
    const onSelect = jest.fn();
    const screen = render(
      <ThemeProvider>
        <FolderTabs
          folders={[{ folder_id: 'work', name: 'Work' }]}
          activeId={null}
          onSelect={onSelect}
        />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('folder-filter-indicator')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'All' }).props.accessibilityState.selected).toBe(true);

    fireEvent.press(screen.getByRole('tab', { name: 'Work' }));

    expect(onSelect).toHaveBeenCalledWith('work');
    expect(screen.getByTestId('folder-filter-indicator')).toBeTruthy();
    expect(screen.getAllByTestId('folder-filter-indicator')).toHaveLength(1);
  });
});
