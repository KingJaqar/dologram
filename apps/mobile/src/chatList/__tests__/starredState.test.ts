import { beginStarChange, clearStarredState, getStarredState } from '../starredState';

beforeEach(clearStarredState);

test('rapid changes keep the latest intent through earlier failures and roll back to the last saved value', () => {
  const star = beginStarChange('alice', 'chat', true);
  const unstar = beginStarChange('alice', 'chat', false);
  expect(getStarredState().get('alice')?.get('chat')).toBe(false);
  star(true);
  expect(getStarredState().get('alice')?.get('chat')).toBe(false);
  unstar(false);
  expect(getStarredState().get('alice')?.get('chat')).toBe(true);
  const retry = beginStarChange('alice', 'chat', false);
  retry(true);
  expect(getStarredState().get('alice')?.get('chat')).toBe(false);
});

test('failed overlapping changes restore the original row state and isolate accounts', () => {
  const first = beginStarChange('alice', 'chat', true);
  const second = beginStarChange('alice', 'chat', false);
  beginStarChange('bob', 'chat', true)(true);
  first(false);
  expect(getStarredState().get('alice')?.get('chat')).toBe(false);
  second(false);
  expect(getStarredState().get('alice')?.has('chat')).toBe(false);
  expect(getStarredState().get('bob')?.get('chat')).toBe(true);
});

test('cleanup prevents late writes from restoring stale feedback', () => {
  const finish = beginStarChange('alice', 'chat', true);
  clearStarredState();
  finish(true);
  expect(getStarredState().size).toBe(0);
});
