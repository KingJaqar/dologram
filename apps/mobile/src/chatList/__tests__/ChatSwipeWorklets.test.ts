import { transformFileSync } from '@babel/core';
import traverse from '@babel/traverse';
import path from 'node:path';

test('compiled swipe worklets capture the motion preference without the native theme animation', () => {
  // The runtime mocks do not serialize worklets. Check the real compiler output
  // so capturing theme.transitionOpacity cannot silently pass the render tests.
  const compiled = transformFileSync(path.join(__dirname, '../ChatSwipeActions.tsx'), {
    babelrc: false,
    configFile: false,
    presets: ['@babel/preset-typescript'],
    plugins: ['react-native-worklets/plugin'],
    ast: true,
    code: false,
  });
  const closures: string[][] = [];
  traverse(compiled!.ast!, {
    AssignmentExpression({ node }) {
      if (node.left.type !== 'MemberExpression'
        || node.left.property.type !== 'Identifier'
        || node.left.property.name !== '__closure'
        || node.right.type !== 'ObjectExpression') return;
      closures.push(node.right.properties.flatMap((property) => (
        property.type === 'ObjectProperty' && property.key.type === 'Identifier'
          ? [property.key.name]
          : []
      )));
    },
  });

  expect(closures.length).toBeGreaterThan(0);
  expect(closures.flat()).not.toContain('theme');
  expect(closures.some((names) => names.includes('reduceMotion') && names.includes('withTiming'))).toBe(true);
});
