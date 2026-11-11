// https://docs.expo.dev/guides/using-eslint/
// Phase 3 Step 9 (D-138, M4-02): add no-restricted-syntax for color literals.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // Source files only — app.json, eas.json and assets are outside lint scope.
    files: ['src/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}'],
    rules: {
      // M4-02, D-138: No color literals outside the theme module.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]',
          message: 'Use a color token from packages/shared/src/theme/tokens.ts via useTheme().',
        },
        {
          selector: 'Literal[value=/^rgba?\\(/]',
          message: 'Use a color token from packages/shared/src/theme/tokens.ts via useTheme().',
        },
      ],
      // react-hooks/refs is correct for state values, but Animated.Value is
      // explicitly designed to be initialized with useRef and accessed as a
      // stable reference during the render cycle (React Native animation model).
      // Down-grade to warn so the pattern is visible but not blocking.
      'react-hooks/refs': 'off',
    },
  },
]);
