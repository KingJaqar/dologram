import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  { rules: jsxA11y.flatConfigs.strict.rules },
  globalIgnores(['.next/**', 'out/**', 'coverage/**', 'test-results/**', 'playwright-report/**', 'next-env.d.ts']),
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/components/Icon/**'],
    rules: { 'no-restricted-imports': ['error', { patterns: ['lucide-react', 'lucide-react/*', 'lucide-react-native', 'lucide-react-native/*'] }] },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/theme/generated/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'no-restricted-syntax': [
        'error',
        { selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]', message: 'Use shared theme tokens.' },
        { selector: 'Literal[value=/^(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\\(/]', message: 'Use shared theme tokens.' },
        { selector: 'JSXAttribute[name.name="style"]', message: 'Use token-based CSS instead of inline styles.' },
      ],
    },
  },
]);
