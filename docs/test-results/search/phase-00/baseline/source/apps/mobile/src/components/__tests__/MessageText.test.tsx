/**
 * MessageText render tests (D-155, M2-06, D-99).
 * Verifies:
 * - All M2-06 spike inputs render without crash.
 * - Image inputs render alt text as plain text, not a native Image element.
 * - No error is thrown.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { MessageText } from '../MessageText';

function Wrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

async function renderMsg(content: string) {
  return render(<MessageText content={content} />, { wrapper: Wrapper });
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
});
