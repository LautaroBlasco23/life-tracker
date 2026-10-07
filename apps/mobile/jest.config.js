module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/*.test.ts?(x)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    // Mirrors tsconfig + babel-plugin-module-resolver: shared is consumed
    // from source, no build step.
    '^@shared/(.*)$': '<rootDir>/../../packages/shared/src/$1',
  },
  setupFiles: ['./jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', '/out/'],
};
