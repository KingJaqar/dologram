import { canPublishIgnoredChatReadReceipt } from '../ignoredChat';

test.each([
  [null, false],
  [true, false],
  [false, true],
] as const)('ignored state %s permits read receipts: %s', (ignored, expected) => {
  expect(canPublishIgnoredChatReadReceipt(ignored)).toBe(expected);
});
