import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StrictMode, useState } from 'react';
import { Dialog } from '../../src/components/Dialog/Dialog';
import { ConfirmDialog, type ConfirmDialogProps } from '../../src/components/ConfirmDialog/ConfirmDialog';
import { Toast, ToastProvider, useToast } from '../../src/components/Toast/Toast';
import { AdminForm } from '../../src/components/AdminForm/AdminForm';
import { GeneratedPasswordPanel } from '../../src/components/AdminForm/GeneratedPasswordPanel';
import { AuditView, type AuditRow } from '../../src/components/AuditView/AuditView';
import { UsageBar } from '../../src/components/UsageBar/UsageBar';
import { JobPanel, type JobPanelProps } from '../../src/components/JobPanel/JobPanel';
import { Button } from '../../src/components/Button/Button';

beforeEach(() => {
  // jsdom has no top-layer/dialog implementation; native behavior is checked in Chrome.
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  vi.restoreAllMocks(); vi.useRealTimers();
});

function ConfirmHarness(props: Partial<ConfirmDialogProps>) {
  const [open, setOpen] = useState(false);
  return <><Button onClick={() => setOpen(true)}>Open</Button><ConfirmDialog title="Delete account" body="This erases the account."
    actionLabel="Delete" tone="danger" onConfirm={async () => ({ ok: true })} {...props} open={open} onClose={() => setOpen(false)} /></>;
}

describe('Dialog and ConfirmDialog', () => {
  it('starts at Cancel, restores the opener on Escape and starts fresh on reopen', async () => {
    const user = userEvent.setup(); render(<StrictMode><ConfirmHarness /></StrictMode>);
    await user.click(screen.getByText('Open'));
    expect(document.activeElement).toBe(screen.getByText('Cancel'));
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByText('Open'));
    await user.click(screen.getByText('Open')); await user.click(screen.getByText('Cancel'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('requires exact case and resets typed state after closing', async () => {
    const user = userEvent.setup(); const confirm = vi.fn(async () => ({ ok: true as const }));
    render(<ConfirmHarness typedConfirmation="testuser" onConfirm={confirm} />);
    await user.click(screen.getByText('Open'));
    const field = screen.getByLabelText('Type testuser to confirm'); expect(document.activeElement).toBe(field);
    await user.type(field, 'TestUser'); expect(screen.getByText('Delete').hasAttribute('disabled')).toBe(true);
    await user.clear(field); await user.type(field, 'testuser');
    expect(screen.getByText('Delete').hasAttribute('disabled')).toBe(false);
    await user.click(screen.getByText('Delete')); expect(confirm).toHaveBeenCalledTimes(1);
    await user.click(screen.getByText('Open')); expect(screen.getByLabelText('Type testuser to confirm').getAttribute('value')).toBe('');
  });
  it('blocks dismissal and duplicate actions while pending; displays returned failures and allows retry', async () => {
    let settle: (value: { ok: false; message: string }) => void = () => { throw new Error('Not started'); };
    const confirm = vi.fn(() => new Promise<{ ok: false; message: string }>(resolve => { settle = resolve; }));
    render(<ConfirmHarness onConfirm={confirm} />); fireEvent.click(screen.getByText('Open'));
    const action = screen.getByText('Delete'); fireEvent.click(action); fireEvent.click(action);
    expect(confirm).toHaveBeenCalledTimes(1); expect(screen.getByText('Cancel').hasAttribute('disabled')).toBe(true);
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true })); expect(screen.getByRole('dialog')).toBeTruthy();
    await act(async () => settle({ ok: false, message: 'Operation refused' }));
    expect(screen.getByRole('alert').textContent).toContain('Operation refused');
    fireEvent.click(screen.getByText('Delete')); expect(confirm).toHaveBeenCalledTimes(2);
    await act(async () => settle({ ok: false, message: 'Still refused' }));
  });
  it('handles thrown errors without leaking exception text; owner protection stays disabled', async () => {
    const confirm = vi.fn(async () => { throw new Error('private backend detail'); });
    const { unmount } = render(<ConfirmHarness onConfirm={confirm} />); fireEvent.click(screen.getByText('Open')); fireEvent.click(screen.getByText('Delete'));
    expect((await screen.findByRole('alert')).textContent).toContain('The request could not be completed. Try again.');
    expect(screen.queryByText('private backend detail')).toBeNull(); unmount();
    render(<ConfirmHarness disabledReason="The owner's account can't be banned or deleted." onConfirm={confirm} />);
    fireEvent.click(screen.getByText('Open')); expect(screen.getByText('Delete').hasAttribute('disabled')).toBe(true);
    expect(screen.getByText("The owner's account can't be banned or deleted.")).toBeTruthy();
  });
  it('renders form sizing, an error slot and clears children on controlled close', () => {
    const { rerender } = render(<Dialog open title="Form" size="form" onClose={vi.fn()} error="Failed"><input aria-label="Name" /></Dialog>);
    expect(document.activeElement).toBe(screen.getByLabelText('Name')); expect(screen.getByRole('alert').textContent).toContain('Failed');
    rerender(<Dialog open={false} title="Form" onClose={vi.fn()}><input aria-label="Name" /></Dialog>);
    expect(screen.queryByLabelText('Name')).toBeNull();
  });
});

describe('Toast', () => {
  it('stays within the modal top layer and returns to the body after close', async () => {
    const dialog = document.createElement('dialog'); dialog.setAttribute('open', ''); document.body.appendChild(dialog);
    const { unmount } = render(<Toast message="Copied" onDismiss={vi.fn()} />);
    expect(dialog.contains(screen.getByRole('status'))).toBe(true);
    dialog.removeAttribute('open');
    await vi.waitFor(() => expect(screen.getByRole('status').parentElement).toBe(document.body));
    unmount(); dialog.remove();
  });
  it.each([false, true])('expires at the correct duration with action=%s and clears its timer', action => {
    vi.useFakeTimers(); const dismiss = vi.fn(); const click = vi.fn();
    const { unmount } = render(<Toast message="Copied" action={action ? { label: 'Undo', onClick: click } : undefined} onDismiss={dismiss} />);
    expect(screen.getByRole('status').textContent).toContain('Copied');
    act(() => vi.advanceTimersByTime((action ? 6000 : 4000) - 1)); expect(dismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1)); expect(dismiss).toHaveBeenCalledTimes(1); unmount(); expect(vi.getTimerCount()).toBe(0);
  });
  it('replaces the current toast, resets expiry, and invokes an action once', () => {
    vi.useFakeTimers(); const click = vi.fn();
    function Trigger() { const toast = useToast(); return <Button onClick={() => toast({ message: 'Copied', action: { label: 'Undo', onClick: click } })}>Show</Button>; }
    render(<ToastProvider><Trigger /></ToastProvider>);
    fireEvent.click(screen.getByText('Show')); act(() => vi.advanceTimersByTime(5000)); fireEvent.click(screen.getByText('Show'));
    act(() => vi.advanceTimersByTime(1000)); expect(screen.getAllByRole('status')).toHaveLength(1);
    fireEvent.click(screen.getByText('Undo')); expect(click).toHaveBeenCalledTimes(1); expect(screen.queryByRole('status')).toBeNull(); expect(vi.getTimerCount()).toBe(0);
  });
});

describe('AdminForm and GeneratedPasswordPanel', () => {
  it('submits with named fields/actions; copies only to clipboard/toast and removes the password on unmount', async () => {
    const user = userEvent.setup(); const submit = vi.fn(event => event.preventDefault());
    const clipboard = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    const regenerate = vi.fn(); const sentinel = 'synthetic-leak-sentinel';
    const { unmount } = render(<ToastProvider><AdminForm title="Create account" onSubmit={submit} actions={<Button type="submit">Create</Button>}>
      <GeneratedPasswordPanel password={sentinel} mode="beforeCreate" onRegenerate={regenerate} />
    </AdminForm></ToastProvider>);
    await user.click(screen.getByText('Copy')); expect(clipboard).toHaveBeenCalledWith(sentinel); expect(screen.getByRole('status').textContent).toBe('Copied');
    await user.click(screen.getByText('Regenerate')); expect(regenerate).toHaveBeenCalledTimes(1); expect(submit).not.toHaveBeenCalled();
    await user.click(screen.getByText('Create')); expect(submit).toHaveBeenCalledTimes(1);
    unmount(); expect(screen.queryByText(sentinel)).toBeNull(); expect(screen.queryByDisplayValue(sentinel)).toBeNull();
    expect(document.body.textContent).not.toContain(sentinel);
  });
  it('selects text and shows keyboard fallback on clipboard denial; CSV and created modes expose correct actions', async () => {
    const user = userEvent.setup(); vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('Denied'));
    const download = vi.fn(); const { rerender } = render(<ToastProvider><GeneratedPasswordPanel mode="csv" password="synthetic" onDownloadCsv={download} /></ToastProvider>);
    await user.click(screen.getByText('Copy')); const field = screen.getByLabelText('Generated password', { selector: 'input' }) as HTMLInputElement;
    expect(document.activeElement).toBe(field); expect(field.selectionStart).toBe(0); expect(field.selectionEnd).toBe(9);
    expect(screen.getByRole('status').textContent).toBe('Press Ctrl+C to copy');
    await user.click(screen.getByText('Download as CSV')); expect(download).toHaveBeenCalledTimes(1); expect(screen.queryByText('Regenerate')).toBeNull();
    rerender(<ToastProvider><GeneratedPasswordPanel mode="created" password="synthetic" /></ToastProvider>);
    expect(screen.queryByText('Download as CSV')).toBeNull(); expect(screen.queryByText('Regenerate')).toBeNull();
  });
});

const auditRows: AuditRow[] = [{ id: '1', at: '2026-11-15T01:02:03Z', action: 'account.create', targetUsername: null, result: 'success', detail: 'Safe detail\nSecond line' },
  { id: '2', at: '2026-11-15T01:02:03Z', action: 'account.ban', targetUsername: 'testuser', result: 'failed', detail: '<script>inert text</script>' }];
describe('AuditView', () => {
  it('renders columns/local timestamp/safe details, controlled action/search filters and pagination', async () => {
    const user = userEvent.setup(); const action = vi.fn(); const target = vi.fn(); const page = vi.fn();
    render(<AuditView rows={auditRows} page={1} total={51} onPageChange={page} state="ready" errorContent="Unavailable"
      actionNames={['account.create', 'account.ban']} action="" onActionChange={action} target="" onTargetChange={target} />);
    expect(screen.getAllByRole('columnheader').map(x => x.textContent)).toEqual(['Time', 'Action', 'Target username', 'Result', 'Detail']);
    const date = new Date('2026-11-15T01:02:03Z'); const two = (value: number) => String(value).padStart(2, '0');
    expect(screen.getAllByText(`2026-11-15 ${two(date.getHours())}:02:03`)).toHaveLength(2);
    expect(screen.getByText('Success')).toBeTruthy(); expect(screen.getByText('Failed')).toBeTruthy();
    const button = screen.getAllByRole('button', { name: 'Show detail' })[0];
    if (!button) throw new Error('Missing detail button');
    await user.click(button);
    expect(screen.getByRole('button', { name: 'Hide detail' }).getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(button.getAttribute('aria-controls') ?? '')?.hidden).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Hide detail' })); expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('script')).toBeNull();
    await user.selectOptions(screen.getByLabelText('Action', { selector: 'select' }), 'account.ban'); expect(action).toHaveBeenCalledWith('account.ban');
    await user.type(screen.getByRole('searchbox'), 'testuser'); await vi.waitFor(() => expect(target).toHaveBeenCalledWith('testuser'));
    await user.click(screen.getByText('Next')); expect(page).toHaveBeenCalledWith(2);
  });
  it('delegates empty/error/loading to the existing table', () => {
    vi.useFakeTimers(); const props = { rows: [], page: 1, total: 0, onPageChange: vi.fn(), errorContent: <div role="alert">Offline</div>, actionNames: [], action: '', onActionChange: vi.fn(), target: '', onTargetChange: vi.fn() };
    const { rerender, unmount } = render(<AuditView {...props} state="empty" />); expect(screen.getByText('No actions yet')).toBeTruthy();
    rerender(<AuditView {...props} state="error" />); expect(screen.getByRole('alert').textContent).toBe('Offline');
    rerender(<AuditView {...props} state="loading" />); act(() => vi.advanceTimersByTime(300)); expect(screen.getByLabelText('Loading')).toBeTruthy();
    unmount(); expect(vi.getTimerCount()).toBe(0);
  });
});

describe('UsageBar', () => {
  it.each([[399.5, null], [400, '80%+'], [499, '80%+'], [499.5, '80%+'], [500, 'Limit reached'], [600, 'Limit reached']] as const)('shows exact threshold for %s/500 with icon/text', (used, text) => {
    const { container } = render(<UsageBar name="Database" used={used} limit={500} unit="count" action="Export data" />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(String(Math.min(used, 500)));
    if (text) { expect(screen.getByText(text)).toBeTruthy(); expect(container.querySelector('svg')).toBeTruthy(); expect(screen.getByText('Export data')).toBeTruthy(); }
    else { expect(container.querySelector('svg')).toBeNull(); expect(screen.queryByText('Export data')).toBeNull(); }
  });
  it('uses binary MB/GB, manual-entry label, zero usage and capped fill with actual over-limit text', () => {
    const { rerender } = render(<UsageBar name="Storage" used={1024 ** 2} limit={1024 ** 3} unit="bytes" enteredByHandOn="2026-11-15" />);
    expect(screen.getByText('1.00 MB of 1.00 GB (0%)')).toBeTruthy(); expect(screen.getByText('Entered by hand on 2026-11-15')).toBeTruthy();
    rerender(<UsageBar name="Storage" used={0} limit={500} unit="count" />); expect(screen.getByText('0 of 500 (0%)')).toBeTruthy();
    rerender(<UsageBar name="Storage" used={600} limit={500} unit="count" />); expect(screen.getByText('600 of 500 (120%)')).toBeTruthy();
    expect((screen.getByRole('progressbar').firstElementChild as HTMLElement).style.width).toBe('100%');
  });
  it.each([[-1, 5], [1, 0], [NaN, 5], [1, Infinity]])('refuses invalid usage %s / %s', (used, limit) => {
    expect(() => render(<UsageBar name="Invalid" used={used} limit={limit} unit="count" />)).toThrow('UsageBar requires');
  });
});

const jobProps: JobPanelProps = { title: 'Export database', due: 'due', running: false, logLines: [], failed: false, onRun: vi.fn(), onRetry: vi.fn() };
describe('JobPanel', () => {
  it('shows due/overdue/last run, invokes run/retry/retry failed, blocks conflicting jobs', async () => {
    const user = userEvent.setup(); const run = vi.fn(); const retry = vi.fn(); const retryFailed = vi.fn();
    const props = { ...jobProps, onRun: run, onRetry: retry, onRetryFailed: retryFailed };
    const { rerender } = render(<JobPanel {...props} />); expect(screen.getByText('Due')).toBeTruthy(); expect(screen.getByText('Last run Never')).toBeTruthy();
    await user.click(screen.getByText('Run')); expect(run).toHaveBeenCalledTimes(1);
    rerender(<JobPanel {...props} failed due="overdue" lastRun="2026-11-15" logLines={['Failed safely']} />);
    expect(screen.getByText('Overdue')).toBeTruthy(); expect(screen.getByText('Failed')).toBeTruthy(); expect(screen.getByRole('log').textContent).toContain('Failed safely');
    await user.click(screen.getByText('Retry')); await user.click(screen.getByText('Retry failed')); expect(retry).toHaveBeenCalledTimes(1); expect(retryFailed).toHaveBeenCalledTimes(1);
    rerender(<JobPanel {...props} blockedReason="Another job is running" />); expect(screen.getByText('Run').hasAttribute('disabled')).toBe(true); expect(screen.getByRole('status').textContent).toBe('Another job is running');
  });
  it('delays progress, keeps only eight log lines, disables actions and clears timers on unmount', () => {
    vi.useFakeTimers(); const lines = Array.from({ length: 20 }, (_, i) => `Line ${i}`);
    const { unmount } = render(<JobPanel {...jobProps} running logLines={lines} />);
    expect(screen.queryByRole('progressbar')).toBeNull(); act(() => vi.advanceTimersByTime(299)); expect(screen.queryByRole('progressbar')).toBeNull();
    act(() => vi.advanceTimersByTime(1)); expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.getByRole('log').textContent?.trim()).toBe(lines.slice(-8).join('\n')); expect(screen.getByText('Run').hasAttribute('disabled')).toBe(true);
    unmount(); expect(vi.getTimerCount()).toBe(0);
  });
});
