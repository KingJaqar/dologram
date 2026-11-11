import { highlightRanges, searchPreview } from '../matching';

test.each([
  ['Hello hello', 'HELLO', [[0, 5], [6, 11]]],
  ['banana', 'ana', [[1, 6]]],
  ['ﬃ next', 'ffi', [[0, 1]]],
  ['e\u0301 next', 'é', [[0, 2]]],
  ['İX', 'i', [[0, 1]]],
  ['İX', 'x', [[1, 2]]],
  ['ΟΣ ΟΣΑ', 'οσ', [[3, 5]]],
  ['ΟΣ ΟΣΑ', 'ος', [[0, 2]]],
  ['🙂ＣＡＦÉ!', 'café', [[2, 6]]],
  ['abc', ' ', []],
  ['가X', '가', [[0, 2]]],
])('maps %s / %s to original UTF-16 text', (text, query, expected) => {
  expect(highlightRanges(text, query).map(({ start, end }) => [start, end])).toEqual(expected);
});

test('snippets preserve original text and surround the original normalized match', () => {
  const content = `${'a'.repeat(190)} 🙂ＣＡＦÉ ${'z'.repeat(190)}`;
  const preview = searchPreview(content, 'café');
  expect(preview.startsWith('…')).toBe(true);
  expect(preview.endsWith('…')).toBe(true);
  expect(preview).toContain('🙂ＣＡＦÉ');
});
