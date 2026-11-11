import { strings } from '@dologram/shared';
import { actionToast, performToastAction, type ToastAction } from '../toastCopy';

const actions = Object.keys(strings.toasts.actions) as ToastAction[];
test.each(actions)('%s has safe, correctly placed success and rejection feedback', async (action) => {
  const show = jest.fn();
  const placement = action.endsWith('Message') ? 'top' : 'bottom';
  expect(await performToastAction(show, action, action, async () => 'confirmed')).toEqual({ ok: true, value: 'confirmed' });
  expect(show).toHaveBeenCalledTimes(1);
  expect(show).toHaveBeenLastCalledWith(expect.objectContaining({ message: strings.toasts.actions[action].success, variant: 'success', placement }));
  show.mockClear();
  expect(await performToastAction(show, action, action, async () => { throw new Error('secret server token'); })).toEqual({ ok: false });
  expect(show).toHaveBeenCalledTimes(1);
  expect(show).toHaveBeenLastCalledWith(expect.objectContaining({ message: strings.toasts.actions[action].error, variant: 'error', placement }));
});

test('only the confirmed result notifies; duplicate flights do not execute', async () => {
  let resolve!: (value: number) => void;
  const operation = jest.fn(() => new Promise<number>((done) => { resolve = done; }));
  const show = jest.fn();
  const first = performToastAction(show, 'account:message', 'editMessage', operation);
  await Promise.resolve();
  expect(show).not.toHaveBeenCalled();
  expect(await performToastAction(show, 'account:message', 'editMessage', operation)).toEqual({ ok: false });
  expect(operation).toHaveBeenCalledTimes(1);
  resolve(42);
  await first;
  expect(show).toHaveBeenCalledTimes(1);
  expect(await performToastAction(show, 'account:message', 'editMessage', async () => 43)).toEqual({ ok: true, value: 43 });
});

test('independent operations can complete out of order with accurate results', async () => {
  let reject!: (error: Error) => void;
  const show = jest.fn();
  const slow = performToastAction(show, 'slow', 'archiveChat', () => new Promise((_resolve, fail) => { reject = fail; }));
  await Promise.resolve();
  await performToastAction(show, 'fast', 'copyMessage', async () => undefined);
  reject(new Error('private'));
  await slow;
  expect(show.mock.calls.map(([options]) => [options.variant, options.placement])).toEqual([['success', 'top'], ['error', 'bottom']]);
});

test('complete translated sentences include folder and natural mute durations', () => {
  expect(actionToast('addToFolder', 'success', { folder: 'Work' }).message).toBe('Chat added to “Work”.');
  expect(actionToast('muteChat', 'success', { mute: 'eightHours' }).message).toBe('Chat muted for 8 hours.');
  expect(actionToast('muteChat', 'success', { mute: 'untilUnmuted' }).message).toBe('Chat muted until you unmute it.');
  expect(strings.toasts.membersAdded(2, 1)).toBe('2 group members added; 1 couldn’t be added. Try adding them again.');
  expect(strings.toasts.groupPartial(1)).toContain('Group chat created');
});
