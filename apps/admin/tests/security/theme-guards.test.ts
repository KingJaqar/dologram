// @vitest-environment node
import { ESLint } from 'eslint';
import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';

describe('theme lint guards', () => {
  it('refuses JS strings, JSX attributes and template colors', async () => {
    const eslint = new ESLint();
    for (const color of ['#' + 'aabbcc', 'rgb' + '(0,0,0)', 'rgba' + '(0,0,0,1)']) {
      for (const code of [`export const color = '${color}';`, `export const icon = <svg fill="${color}" />;`, 'export const color = `' + color + '`;']) {
        const results = await eslint.lintText(code, { filePath: 'src/theme-probe.tsx' });
        expect(results.flatMap(result => result.messages).some(message => message.ruleId === 'no-restricted-syntax')).toBe(true);
      }
    }
  });
  it('refuses CSS hex colors and allows shared token references', async () => {
    const invalid = await stylelint.lint({ code: 'a { color: ' + '#' + 'aabbcc; }', configFile: 'stylelint.config.mjs' });
    expect(invalid.results.flatMap(result => result.warnings).some(message => message.rule === 'color-no-hex')).toBe(true);
    const valid = await stylelint.lint({ code: 'a { color: var(--dg-color-text-primary); }', configFile: 'stylelint.config.mjs' });
    expect(valid.errored).toBe(false);
  });
});
