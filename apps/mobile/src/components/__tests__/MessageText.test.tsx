/**
 * MessageText render tests (D-155, M2-06, D-99).
 * Verifies:
 * - All M2-06 spike inputs render without crash.
 * - Image inputs render alt text as plain text, not a native Image element.
 * - No error is thrown.
 * - Search highlighting covers visible Markdown text only, including matches that
 *   span inline leaves, and never exposes hidden syntax or link destinations.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { MessageText } from '../MessageText';

function Wrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

async function renderMsg(content: string) {
  return render(<MessageText content={content} />, { wrapper: Wrapper });
}

function renderHighlighted(content: string, highlightQuery?: string) {
  return render(<MessageText content={content} highlightQuery={highlightQuery} />, { wrapper: Wrapper });
}

/** Text nodes the renderer marked as highlighted matches. */
function highlightedStrings(screen: ReturnType<typeof render>): string[] {
  return screen.UNSAFE_getAllByType(Text)
    .filter((node) => typeof node.props.children === 'string' && Boolean(StyleSheet.flatten(node.props.style)?.backgroundColor))
    .map((node) => node.props.children as string);
}

describe('MessageText', () => {
  describe('M2-06 spike inputs — render without crash', () => {
    const cases: [string, string][] = [
      ['XSS script tag', '<script>alert(1)</script>'],
      ['HTML bold tag', '<b>x</b>'],
      ['Unclosed strong', '**unclosed'],
      ['Unbalanced link', '[a](b'],
      ['Heading (h1)', '# Heading'],
      ['Image tag', '![alt text](https://example.com/x.png)'],
      ['Block quote', '> This is a quote'],
      ['Bullet list', '- item one\n- item two'],
      ['Table', '| Col A | Col B |\n|---|---|\n| 1 | 2 |'],
      ['Bold and italic', 'This is **bold** and _italic_ text.'],
      ['Inline code', 'Use `console.log()` to debug.'],
      ['Fenced code block', '```\nfunction hello() {}\n```'],
    ];

    for (const [name, input] of cases) {
      test(`${name} renders without crash`, async () => {
        await expect(renderMsg(input)).resolves.toBeDefined();
      });
    }
  });

  test('Image input renders alt text as text, no <img> role', async () => {
    const screen = await renderMsg('![alt text](https://example.com/x.png)');
    // No element with accessibilityRole "image" that is an actual image source
    const imgRoles = screen.queryAllByRole('imagebutton');
    expect(imgRoles.length).toBe(0);
    // Alt text should be present as a text node
    const altNodes = screen.queryAllByText('alt text');
    expect(altNodes.length).toBeGreaterThan(0);
  });

  test('toJSON() produces a snapshot that contains no "Image" source node', async () => {
    const screen = await renderMsg('![photo](https://example.com/photo.jpg)');
    const json = screen.toJSON();
    const jsonStr = JSON.stringify(json);
    // No "source" prop (which native Image uses) should appear
    expect(jsonStr).not.toMatch(/"source":/);
    // The rendered output should not be null
    expect(json).not.toBeNull();
  });

  test('highlights visible Markdown text without replacing the rendered content', async () => {
    const screen = renderHighlighted('**needle** and [needle](https://example.com)', 'needle');
    expect(highlightedStrings(screen)).toEqual(['needle', 'needle']);
    expect(screen.getByText('and')).toBeTruthy();
  });

  test('renders no highlight when no query is supplied', async () => {
    expect(highlightedStrings(renderHighlighted('needle in plain text'))).toEqual([]);
  });

  test('highlights a term that spans inline Markdown leaves', () => {
    expect(highlightedStrings(renderHighlighted('nee**dle** here', 'needle'))).toEqual(['nee', 'dle']);
  });

  test('highlights repeated matches including surrounding emoji', () => {
    expect(highlightedStrings(renderHighlighted('🔥 needle 🔥 needle', 'needle'))).toEqual(['needle', 'needle']);
  });

  test('highlights heading, table, inline code and fenced code text', () => {
    expect(highlightedStrings(renderHighlighted('# needle', 'needle'))).toEqual(['needle']);
    expect(highlightedStrings(renderHighlighted('| needle | b |\n|---|---|\n| 1 | 2 |', 'needle'))).toEqual(['needle']);
    expect(highlightedStrings(renderHighlighted('`needle`', 'needle'))).toEqual(['needle']);
    expect(highlightedStrings(renderHighlighted('```\nneedle\n```', 'needle'))).toEqual(['needle']);
  });

  test('highlights image alt text', () => {
    expect(highlightedStrings(renderHighlighted('![needle](https://example.com/x.png)', 'needle'))).toEqual(['needle']);
  });

  test('does not highlight hidden link destinations or raw Markdown syntax', () => {
    expect(highlightedStrings(renderHighlighted('[click](https://needle.example)', 'needle'))).toEqual([]);
    expect(highlightedStrings(renderHighlighted('**needle** text', 'asterisk'))).toEqual([]);
  });

  test('never highlights across a block boundary', () => {
    expect(highlightedStrings(renderHighlighted('nee\n\ndle', 'needle'))).toEqual([]);
  });

  test('maps compatibility and combining normalization back to the displayed characters', () => {
    expect(highlightedStrings(renderHighlighted('ｎｅｅｄｌｅ', 'needle'))).toEqual(['ｎｅｅｄｌｅ']);
    expect(highlightedStrings(renderHighlighted('cafe\u0301', 'café'))).toEqual(['cafe\u0301']);
  });
});
