/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: [
    '**/__tests__/**/*.test.{ts,tsx}',
    '**/*.test.{ts,tsx}',
  ],
  // Allow jest-expo to find @react-native/jest-preset from the workspace node_modules
  modulePaths: [
    '<rootDir>/node_modules',
    '<rootDir>/../../node_modules',
  ],
  moduleNameMapper: {
    '^@dologram/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    // Mock AsyncStorage so tests don't require a native module
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/../../node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock.js',
    // Force lucide-react-native to use the CJS build so Jest doesn't see ESM
    '^lucide-react-native$':
      '<rootDir>/../../node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
    // Reanimated's native worklet runtime is unavailable in Jest; use its
    // official mock while keeping UI-thread animations in the app build.
    '^react-native-reanimated$':
      '<rootDir>/test/mocks/react-native-reanimated.ts',
    '^react-native-gesture-handler$':
      '<rootDir>/test/mocks/react-native-gesture-handler.tsx',
  },
  // Extend jest-expo's transformIgnorePatterns to include our packages
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|standard-navigation|lucide-react-native|react-native-markdown-display|react-native-svg|@dologram))',
    '/node_modules/react-native-reanimated/plugin/',
    '/node_modules/@react-native/babel-preset/',
  ],
};
