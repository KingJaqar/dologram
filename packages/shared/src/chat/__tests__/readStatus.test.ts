import { selectReadStatus } from '../readStatus';

const base = { senderId: 'me', currentUserId: 'me', seq: 7, otherMaxReadSeq: 6 };

test('returns Sent until another member reaches the message sequence', () => {
  expect(selectReadStatus(base)).toBe('sent');
  expect(selectReadStatus({ ...base, otherMaxReadSeq: 7 })).toBe('seen');
  expect(selectReadStatus({ ...base, otherMaxReadSeq: 8 })).toBe('seen');
});

test('does not expose receipt status for incoming, pending, invalid, or Saved Messages rows', () => {
  expect(selectReadStatus({ ...base, senderId: 'other' })).toBeNull();
  expect(selectReadStatus({ ...base, seq: null })).toBeNull();
  expect(selectReadStatus({ ...base, seq: 0 })).toBeNull();
  expect(selectReadStatus({ ...base, seq: Number.MAX_SAFE_INTEGER + 1 })).toBeNull();
  expect(selectReadStatus({ ...base, savedMessages: true })).toBeNull();
});
