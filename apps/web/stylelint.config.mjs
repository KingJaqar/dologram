const config = {
  rules: {
    'block-no-empty': true,
    'color-no-invalid-hex': true,
    'property-no-unknown': true,
    'declaration-block-no-duplicate-properties': true,
    'declaration-property-value-disallowed-list': {
      '/.*/': ['/#[0-9a-fA-F]{3,8}\\b/', '/\\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\\(/'],
      '/^(?:color|background(?:-color)?|border(?:-(?:top|right|bottom|left))?-color|fill|stroke)$/': ['/^(?!(?:var\\(|inherit$|initial$|unset$|revert$|currentcolor$|transparent$)).+/i'],
      '/^font-family$/': ['/^(?!var\\().+/'],
    },
  },
  overrides: [{ files: ['src/theme/tokens.css', 'src/theme/generated/**/*.css'], rules: { 'declaration-property-value-disallowed-list': null } }],
};

export default config;
