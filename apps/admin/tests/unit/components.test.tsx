import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { Icon } from '../../src/components/Icon/Icon';
import { iconNames, iconSizes, type IconName } from '@dologram/shared/src/theme/icons';
import { Button, IconButton } from '../../src/components/Button/Button';
import { TextField } from '../../src/components/TextField/TextField';
import { SearchField } from '../../src/components/SearchField/SearchField';
import { SwitchRow } from '../../src/components/SwitchRow/SwitchRow';
import { Skeleton } from '../../src/components/Skeleton/Skeleton';
import { useDelayedFlag } from '../../src/components/Skeleton/useDelayedFlag';
import { EmptyState } from '../../src/components/EmptyState/EmptyState';
import { ErrorState } from '../../src/components/ErrorState/ErrorState';
import { StatusPill } from '../../src/components/StatusPill/StatusPill';
import { DataTable, type DataTableProps } from '../../src/components/DataTable/DataTable';
import { FilterBar } from '../../src/components/FilterBar/FilterBar';
import { UnavailablePanel } from '../../src/components/UnavailablePanel/UnavailablePanel';

afterEach(() => vi.useRealTimers());

describe('Icon', () => {
  it('resolves every shared semantic name and marks decoration hidden', () => {
    for (const name of Object.keys(iconNames) as IconName[]) {
      const { container, unmount } = render(<Icon name={name} />);
      expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
      unmount();
    }
  });
  it('uses shared dimensions/strokes and labels meaningful images', () => {
    for (const size of ['xs', 'sm', 'md', 'lg', 'xl'] as const) {
      const { unmount } = render(<Icon name="admin.overview" size={size} label="Overview" />);
      const icon = screen.getByRole('img', { name: 'Overview' });
      expect(icon.getAttribute('width')).toBe(String(iconSizes[size].size));
      expect(icon.getAttribute('stroke-width')).toBe(String(iconSizes[size].stroke));
      expect(icon.hasAttribute('aria-hidden')).toBe(false);
      unmount();
    }
  });
});

describe('Button and IconButton', () => {
  it('requires the icon label in its public type', () => {
    type Props = ComponentProps<typeof IconButton>;
    expectTypeOf<Props['label']>().toEqualTypeOf<string>();
    expectTypeOf<{ name: 'action.copy' }>().not.toExtend<Props>();
  });
  it('supports keyboard activation without submitting forms', async () => {
    const user = userEvent.setup(); const click = vi.fn();
    render(<Button variant="secondary" onClick={click}>Save</Button>);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Save' }));
    await user.keyboard('{Enter}');
    expect(click).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button').getAttribute('type')).toBe('button');
  });
  it.each(['primary', 'secondary', 'danger', 'text'] as const)('keeps %s loading named, busy and inert', async variant => {
    const click = vi.fn();
    const { rerender } = render(<Button variant={variant} loading onClick={click}>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.getAttribute('aria-busy')).toBe('true');
    await userEvent.click(button); expect(click).not.toHaveBeenCalled();
    rerender(<Button disabled onClick={click}>Save</Button>);
    await userEvent.click(screen.getByRole('button')); expect(click).not.toHaveBeenCalled();
  });
  it('gives icon buttons an accessible name and blocks loading clicks', async () => {
    const click = vi.fn();
    render(<IconButton label="Copy" name="action.copy" loading onClick={click} />);
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(click).not.toHaveBeenCalled();
  });
});

describe('TextField', () => {
  it('connects label, helper and invalid state; preserves native options', async () => {
    const change = vi.fn();
    const { rerender } = render(<TextField label="Passcode" type="password" autoComplete="current-password" value="" onChange={change} error="Required" aria-describedby="hint" />);
    const input = screen.getByLabelText('Passcode');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe(`hint ${screen.getByText('Required').id}`);
    expect(input.getAttribute('autocomplete')).toBe('current-password');
    await userEvent.type(input, 'a'); expect(change).toHaveBeenCalledWith('a');
    rerender(<TextField label="Passcode" value="success" onChange={change} />);
    expect(screen.getByLabelText('Passcode').hasAttribute('aria-invalid')).toBe(false);
    expect(screen.getByLabelText('Passcode').hasAttribute('aria-describedby')).toBe(false);
  });
  it('generates unique label and error identities', () => {
    render(<><TextField label="First" value="" onChange={vi.fn()} error="First error" /><TextField label="Second" value="" onChange={vi.fn()} error="Second error" /></>);
    expect(screen.getByLabelText('First').id).not.toBe(screen.getByLabelText('Second').id);
  });
});

describe('SearchField', () => {
  it('debounces edits/clear, uses the latest callback and cleans up on unmount', () => {
    vi.useFakeTimers(); const first = vi.fn(); const latest = vi.fn();
    const { rerender, unmount } = render(<SearchField placeholder="Search accounts" value="" onSearch={first} />);
    const input = screen.getByRole('searchbox', { name: 'Search accounts' });
    fireEvent.change(input, { target: { value: 'a' } });
    act(() => vi.advanceTimersByTime(100));
    fireEvent.change(input, { target: { value: 'ab' } });
    rerender(<SearchField placeholder="Search accounts" value="" onSearch={latest} />);
    act(() => vi.advanceTimersByTime(149)); expect(latest).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1)); expect(latest).toHaveBeenCalledExactlyOnceWith('ab');
    expect(first).not.toHaveBeenCalled();
    rerender(<SearchField placeholder="Search accounts" value="ab" onSearch={latest} />);
    fireEvent.change(input, { target: { value: '' } });
    act(() => vi.advanceTimersByTime(150)); expect(latest).toHaveBeenLastCalledWith('');
    fireEvent.change(input, { target: { value: 'cancelled' } }); unmount();
    act(() => vi.advanceTimersByTime(150)); expect(latest).toHaveBeenCalledTimes(2);
  });
  it('syncs external resets and cancels work when disabled', () => {
    vi.useFakeTimers(); const search = vi.fn();
    const { rerender } = render(<SearchField placeholder="Search" value="initial" onSearch={search} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'draft' } });
    rerender(<SearchField placeholder="Search" value="reset" onSearch={search} disabled />);
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('reset');
    act(() => vi.advanceTimersByTime(150)); expect(search).not.toHaveBeenCalled();
  });
});

describe('SwitchRow', () => {
  it('requests changes without optimistic state and ignores pending/disabled input', async () => {
    const user = userEvent.setup(); const change = vi.fn();
    const { rerender } = render(<SwitchRow label="Premium" checked={false} onChange={change} />);
    await user.tab(); await user.keyboard(' ');
    expect(change).toHaveBeenCalledExactlyOnceWith(true);
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
    rerender(<SwitchRow label="Premium" checked pending onChange={change} />);
    expect(screen.getByRole('switch').getAttribute('aria-busy')).toBe('true');
    await user.click(screen.getByRole('switch')); expect(change).toHaveBeenCalledTimes(1);
    rerender(<SwitchRow label="Premium" checked disabled onChange={change} />);
    await user.click(screen.getByRole('switch')); expect(change).toHaveBeenCalledTimes(1);
  });
});

describe('Skeleton and delayed loading', () => {
  it('draws ten rows and exposes busy state', () => {
    render(<Skeleton variant="adminTable" />);
    const skeleton = screen.getByLabelText('Loading');
    expect(skeleton.getAttribute('aria-busy')).toBe('true'); expect(skeleton.children).toHaveLength(10);
  });
  it('never mounts a skeleton for a fast load and restarts subsequent delays', () => {
    vi.useFakeTimers();
    function Loading({ loading }: { loading: boolean }) { return useDelayedFlag(loading) ? <Skeleton /> : null; }
    const { rerender, unmount } = render(<Loading loading />);
    act(() => vi.advanceTimersByTime(299)); expect(screen.queryByLabelText('Loading')).toBeNull();
    rerender(<Loading loading={false} />);
    act(() => vi.advanceTimersByTime(1)); expect(screen.queryByLabelText('Loading')).toBeNull();
    rerender(<Loading loading />);
    act(() => vi.advanceTimersByTime(300)); expect(screen.getByLabelText('Loading')).toBeTruthy();
    rerender(<Loading loading={false} />); rerender(<Loading loading />);
    expect(screen.queryByLabelText('Loading')).toBeNull();
    unmount(); expect(vi.getTimerCount()).toBe(0);
  });
  it('cancels an obsolete delay', () => {
    vi.useFakeTimers();
    const { result, rerender, unmount } = renderHook(({ delay }) => useDelayedFlag(true, delay), { initialProps: { delay: 300 } });
    act(() => vi.advanceTimersByTime(200)); rerender({ delay: 500 });
    act(() => vi.advanceTimersByTime(300)); expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(200)); expect(result.current).toBe(true);
    unmount(); expect(vi.getTimerCount()).toBe(0);
  });
});

describe('EmptyState and ErrorState', () => {
  it('labels the empty section and supports optional body', () => {
    render(<EmptyState icon="admin.accounts" title="No accounts" body="Try another search." />);
    expect(screen.getByRole('region', { name: 'No accounts' })).toBeTruthy();
    expect(screen.getByText('Try another search.')).toBeTruthy();
  });
  it('announces errors, runs retry once and omits unavailable retry', async () => {
    const retry = vi.fn(); const { rerender } = render(<ErrorState error="Could not load." onRetry={retry} />);
    expect(screen.getByRole('alert').textContent).toContain('Could not load.');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' })); expect(retry).toHaveBeenCalledTimes(1);
    rerender(<ErrorState error="Could not load." />); expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('StatusPill', () => {
  it.each([
    ['active', 'Active', 'circle-check'], ['banned', 'Banned', 'x-circle'],
    ['mustChangePassword', 'Must change password', 'alert-triangle'], ['admin', 'Admin', 'badge-check'],
    ['pass', 'Pass', 'circle-check'], ['fail', 'Fail', 'x-circle'], ['due', 'Due', 'alert-triangle'],
    ['overdue', 'Overdue', 'x-circle'], ['success', 'Success', 'circle-check'], ['failed', 'Failed', 'x-circle'],
    ['premiumBadge', 'badge', 'badge-check'], ['premiumExtraReactions', 'extra_reactions', 'heart'],
    ['premiumStickers', 'premium_stickers', 'smile'],
  ] as const)('renders %s with text and a 16px semantic icon', (value, text, icon) => {
    render(<StatusPill value={value} />);
    const svg = screen.getByText(text).querySelector('svg');
    expect(svg?.classList.contains(`lucide-${icon}`)).toBe(true);
    expect(svg?.getAttribute('width')).toBe('16');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });
});

type TableRow = { id: number; name: string };
const sampleRows: TableRow[] = Array.from({ length: 120 }, (_, index) => ({ id: index + 1, name: `Account ${index + 1}` }));
function tableProps(overrides: Partial<DataTableProps<TableRow>> = {}): DataTableProps<TableRow> {
  return {
    columns: [{ key: 'name', header: 'Username', widthPercent: 80, align: 'left', mono: true },
      { key: 'id', header: 'Id', widthPercent: 20, align: 'right' }],
    rows: sampleRows.slice(0, 50), rowKey: row => row.id, page: 1, pageSize: 50, total: 120,
    onPageChange: vi.fn(), state: 'ready', emptyText: 'No accounts match',
    errorContent: <UnavailablePanel variant="panel" dashboardUrl="https://supabase.com/dashboard" />, ...overrides,
  };
}

describe('DataTable', () => {
  it('renders 50 rows with accessible headers, range and first-page controls', async () => {
    const onPageChange = vi.fn();
    render(<DataTable {...tableProps({ onPageChange })} />);
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(51);
    expect(screen.getByText('1-50 of 120')).toBeTruthy();
    expect(screen.queryByText('Account 51')).toBeNull();
    expect((screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPageChange).toHaveBeenCalledExactlyOnceWith(2);
    expect(screen.getByRole('columnheader', { name: 'Username' }).getAttribute('scope')).toBe('col');
  });
  it('renders the final page without slicing already paginated rows', async () => {
    const onPageChange = vi.fn();
    render(<DataTable {...tableProps({ page: 3, rows: sampleRows.slice(100), onPageChange })} />);
    expect(screen.getByText('101-120 of 120')).toBeTruthy();
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(21);
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Next' })); expect(onPageChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Previous' })); expect(onPageChange).toHaveBeenCalledExactlyOnceWith(2);
  });
  it('opens focused rows on Enter and click, without intercepting nested actions', async () => {
    const user = userEvent.setup(); const open = vi.fn(); const action = vi.fn();
    const props = tableProps({ rows: sampleRows.slice(0, 1), onRowOpen: open });
    const { rerender } = render(<DataTable {...props} />);
    await user.tab();
    const row = screen.getByRole('row', { name: 'Account 1 1' });
    expect(document.activeElement).toBe(row);
    await user.keyboard('{Enter}'); expect(open).toHaveBeenCalledExactlyOnceWith(sampleRows[0]);
    await user.click(screen.getByText('Account 1')); expect(open).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(row, { key: 'Enter', repeat: true }); expect(open).toHaveBeenCalledTimes(2);
    rerender(<DataTable {...props} columns={[{ key: 'name', header: 'Action', widthPercent: 100, align: 'left',
      render: () => <Button onClick={action}>Copy identity</Button> }]} />);
    const button = screen.getByRole('button', { name: 'Copy identity' });
    button.focus(); await user.keyboard('{Enter}');
    expect(action).toHaveBeenCalledTimes(1); expect(open).toHaveBeenCalledTimes(2);
  });
  it('keeps passive rows out of tab order and renders custom content', () => {
    render(<DataTable {...tableProps({ rows: sampleRows.slice(0, 1), columns: [{ key: 'id', header: 'Status', widthPercent: 100,
      align: 'right', render: () => <StatusPill value="admin" /> }] })} />);
    expect(screen.getByText('Admin')).toBeTruthy();
    expect(screen.getByRole('row', { name: 'Admin' }).hasAttribute('tabindex')).toBe(false);
  });
  it('delays skeleton, suppresses stale rows and disables pagination while loading', () => {
    vi.useFakeTimers();
    const { rerender, unmount } = render(<DataTable {...tableProps({ state: 'loading' })} />);
    expect(screen.queryByText('Account 1')).toBeNull();
    act(() => vi.advanceTimersByTime(299)); expect(screen.queryByLabelText('Loading')).toBeNull();
    act(() => vi.advanceTimersByTime(1)); expect(screen.getByLabelText('Loading').children).toHaveLength(10);
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<DataTable {...tableProps()} />); expect(screen.queryByLabelText('Loading')).toBeNull();
    rerender(<DataTable {...tableProps({ state: 'loading' })} />);
    expect(screen.queryByLabelText('Loading')).toBeNull(); unmount(); expect(vi.getTimerCount()).toBe(0);
  });
  it('renders caller error/retry and empty/zero/stale-page states without stale data', async () => {
    const retry = vi.fn(); const change = vi.fn();
    const { rerender } = render(<DataTable {...tableProps({ state: 'error',
      errorContent: <UnavailablePanel variant="panel" dashboardUrl="https://supabase.com/dashboard" onRetry={retry} /> })} />);
    expect(screen.queryByText('Account 1')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' })); expect(retry).toHaveBeenCalledTimes(1);
    rerender(<DataTable {...tableProps({ state: 'empty', rows: [], total: 0 })} />);
    expect(screen.getByRole('region', { name: 'No accounts match' })).toBeTruthy();
    expect(screen.getByText('0-0 of 0')).toBeTruthy();
    expect(screen.getAllByRole('button').every(button => (button as HTMLButtonElement).disabled)).toBe(true);
    rerender(<DataTable {...tableProps({ rows: [], page: 4, total: 120, onPageChange: change })} />);
    expect(screen.getByText('0-0 of 120')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Previous' })); expect(change).toHaveBeenCalledExactlyOnceWith(3);
  });
  it.each([{ page: 0 }, { page: 1.5 }, { total: -1 }, { total: NaN }, { rows: sampleRows },
    { columns: [] }, { columns: [{ key: 'id', header: 'Id', widthPercent: 0, align: 'right' }] }] as const)(
    'rejects invalid pagination/column inputs: %j', invalid => {
      expect(() => render(<DataTable {...tableProps(invalid)} />)).toThrow(/DataTable/);
    });
});

describe('FilterBar', () => {
  it('keeps exactly one selected chip, delegates changes, labels select and debounces search', () => {
    vi.useFakeTimers(); const search = vi.fn(); const chip = vi.fn(); const select = vi.fn();
    const props = { search: { placeholder: 'Search by username or email', value: '', onSearch: search },
      chips: [{ id: 'all', label: 'All' }, { id: 'active', label: 'Active' }], selectedChip: 'all', onChip: chip,
      select: { label: 'Action', options: ['All actions', 'Create'], value: 'All actions', onChange: select } };
    const { rerender, unmount } = render(<FilterBar {...props} />);
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Active' })); expect(chip).toHaveBeenCalledExactlyOnceWith('active');
    expect(screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('true');
    rerender(<FilterBar {...props} selectedChip="active" />);
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Active' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'Create' } });
    expect(select).toHaveBeenCalledExactlyOnceWith('Create');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'owner' } });
    act(() => vi.advanceTimersByTime(149)); expect(search).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1)); expect(search).toHaveBeenCalledExactlyOnceWith('owner');
    unmount(); expect(vi.getTimerCount()).toBe(0);
  });
  it('supports search only and keyboard chip operation without form submission', async () => {
    const user = userEvent.setup(); const chip = vi.fn();
    const search = { placeholder: 'Filter by target', value: '', onSearch: vi.fn() };
    const { rerender } = render(<FilterBar search={search} />);
    expect(screen.queryByRole('button')).toBeNull(); expect(screen.queryByRole('combobox')).toBeNull();
    rerender(<FilterBar search={search} chips={[{ id: 'all', label: 'All' }]} onChip={chip} selectedChip="all" />);
    await user.tab(); await user.tab(); await user.keyboard(' ');
    expect(chip).toHaveBeenCalledExactlyOnceWith('all');
    expect(screen.getByRole('button').getAttribute('type')).toBe('button');
  });
});

describe('UnavailablePanel', () => {
  it.each(['panel', 'row'] as const)('renders %s with a safe new-tab link and optional actions', async variant => {
    const retry = vi.fn(); const enter = vi.fn();
    const { rerender } = render(<UnavailablePanel dashboardUrl="https://supabase.com/dashboard" variant={variant} onRetry={retry} onEnterByHand={enter} />);
    expect(screen.getByText(variant === 'panel' ? 'unavailable' : 'Check by hand')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Open Dashboard' });
    expect(link.getAttribute('target')).toBe('_blank'); expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.getAttribute('href')).toBe('https://supabase.com/dashboard');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' })); expect(retry).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Enter by hand' })); expect(enter).toHaveBeenCalledTimes(1);
    rerender(<UnavailablePanel dashboardUrl="https://supabase.com/dashboard" variant={variant} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
  it.each(['javascript:alert(1)', 'http://supabase.com/dashboard', 'https://user:password@example.com', '/dashboard'])(
    'rejects unsafe Dashboard URL %s', dashboardUrl => {
      expect(() => render(<UnavailablePanel dashboardUrl={dashboardUrl} variant="panel" />)).toThrow();
    });
});
