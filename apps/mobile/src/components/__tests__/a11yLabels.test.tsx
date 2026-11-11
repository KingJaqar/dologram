/**
 * Accessibility label tests (D-95, T-40 label check part).
 * Renders each base component and verifies that interactive elements
 * have an accessibilityLabel.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { Button, IconButton } from '../Button';
import { SwitchRow } from '../SwitchRow';

function Wrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

async function renderWith(element: React.ReactElement) {
  return render(element, { wrapper: Wrapper });
}

describe('Accessibility labels', () => {
  test('Button has accessibilityLabel', async () => {
    const screen = await renderWith(<Button label="Sign in" onPress={() => {}} />);
    const btn = screen.getByRole('button');
    expect(btn.props.accessibilityLabel).toBeTruthy();
  });

  test('Button loading state sets accessibilityState.busy', async () => {
    const screen = await renderWith(<Button label="Sign in" loading onPress={() => {}} />);
    const btn = screen.getByRole('button');
    expect(btn.props.accessibilityState?.busy).toBe(true);
  });

  test('IconButton has accessibilityLabel', async () => {
    const screen = await renderWith(
      <IconButton iconName="nav.back" accessibilityLabel="Go back" onPress={() => {}} />,
    );
    const btn = screen.getByRole('button');
    expect(btn.props.accessibilityLabel).toBe('Go back');
  });

  test('SwitchRow has accessibilityRole=switch', async () => {
    const screen = await renderWith(
      <SwitchRow label="Enable feature" value={false} onValueChange={() => {}} />,
    );
    const sw = screen.getByRole('switch');
    expect(sw.props.accessibilityLabel).toBe('Enable feature');
  });

  test('SwitchRow checked state is reflected', async () => {
    const screen = await renderWith(
      <SwitchRow label="Enable feature" value={true} onValueChange={() => {}} />,
    );
    const sw = screen.getByRole('switch');
    expect(sw.props.accessibilityState?.checked).toBe(true);
  });
});
