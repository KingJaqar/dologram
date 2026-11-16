import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { HeaderNavActions } from '../HeaderNavActions';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { color } from '@dologram/shared';
import { Circle } from 'react-native-svg';
import { CONNECTION_INDICATORS, type ConnectionStatus } from '../../net/connectionStatus';

jest.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ profile: null, session: null }) }));
jest.mock('../Avatar', () => ({ Avatar: () => null }));
jest.mock('../Icon', () => ({ Icon: () => null }));
jest.mock('../AccountSwitcherPopover', () => ({ AccountSwitcherPopover: () => null }));

test('updates the profile stroke and accessible status while preserving navigation', () => {
  const onProfilePress = jest.fn();
  const selection = { value: [0, 0, 0, 0, 1] } as never;
  const header = (connectionStatus: ConnectionStatus) => (
    <ThemeProvider>
      <HeaderNavActions selection={selection} activeSection="settings"
        connectionStatus={connectionStatus} onProfilePress={onProfilePress} />
    </ThemeProvider>
  );
  const screen = render(header('stable'));
  for (const status of ['stable', 'unstable', 'free', 'offline'] as const) {
    screen.rerender(header(status));
    expect(screen.UNSAFE_getByType(Circle).props.stroke).toBe(color.light.connection[status]);
    expect(screen.getByTestId('profile-connection-stroke')).toHaveStyle({ width: 30, height: 30 });
    const control = screen.getByRole('tab', {
      name: `Profile. ${CONNECTION_INDICATORS[status].label}. Long press to switch accounts`,
    });
    expect(control.props.accessibilityState.selected).toBe(true);
    fireEvent.press(control);
  }
  expect(onProfilePress).toHaveBeenCalledTimes(4);
});
