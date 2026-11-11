/**
 * Contact checklist and member row tests (AND-11, AND-12, D-58, D-70, D-95).
 *
 * The checklist row is one checkbox for screen readers with its selected and limit-disabled states;
 * the member row shows the role and offers Remove only where D-70 allows it.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import type { ChatInfoMember } from '@dologram/shared';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { ContactRow } from '../ContactRow';
import { MemberRow } from '../MemberRow';

function renderWith(element: React.ReactElement) {
  return render(element, { wrapper: ThemeProvider });
}

function member(overrides: Partial<ChatInfoMember> = {}): ChatInfoMember {
  return {
    userId: 'user-2',
    displayName: 'Grace Hopper',
    username: 'grace',
    role: 'member',
    roleLabel: null,
    isSelf: false,
    joinedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('ContactRow (AND-11)', () => {
  test('is a checkbox that reports its selected state and toggles', () => {
    const onToggle = jest.fn();
    const screen = renderWith(
      <ContactRow userId="user-2" displayName="Grace Hopper" selected={false} onToggle={onToggle} />,
    );

    const row = screen.getByRole('checkbox', { name: 'Grace Hopper' });
    expect(row.props.accessibilityState?.checked).toBe(false);

    fireEvent.press(row);
    expect(onToggle).toHaveBeenCalledWith('user-2');
  });

  test('reports the selected state and a disabled row does not toggle', () => {
    const onToggle = jest.fn();
    const screen = renderWith(
      <ContactRow userId="user-2" displayName="Grace Hopper" selected disabled onToggle={onToggle} />,
    );

    const row = screen.getByRole('checkbox', { name: 'Grace Hopper' });
    expect(row.props.accessibilityState?.checked).toBe(true);
    expect(row.props.accessibilityState?.disabled).toBe(true);

    fireEvent.press(row);
    expect(onToggle).not.toHaveBeenCalled();
  });
});

describe('MemberRow (AND-12)', () => {
  test('shows the role label and a Remove action for the owner', () => {
    const onRemove = jest.fn();
    const screen = renderWith(
      <MemberRow member={member({ role: 'owner', roleLabel: 'Owner' })} canRemove onRemove={onRemove} />,
    );

    expect(screen.getByText('Owner')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Grace Hopper remove' }));
    expect(onRemove).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-2' }));
  });

  test('offers no Remove action to a non-owner or on the caller’s own row', () => {
    const nonOwner = renderWith(
      <MemberRow member={member()} canRemove={false} onRemove={() => {}} />,
    );
    expect(nonOwner.queryByRole('button')).toBeNull();

    const ownRow = renderWith(
      <MemberRow member={member({ isSelf: true })} canRemove onRemove={() => {}} />,
    );
    expect(ownRow.queryByRole('button')).toBeNull();
  });
});
