const path = require('path');

module.exports = function (api) {
  // jest-expo compiles through babel-jest; Metro/expo runs everything else.
  // Under jest we use the plain react JSX runtime instead of nativewind's
  // interop runtime: the interop transform rewrites every createElement and
  // breaks jest.mock factories in setup/test files. Styling is not
  // unit-tested (only logic + rendering), so className is inert under jest.
  const isJest = api.caller(
    (caller) =>
      !caller || caller.name === 'babel-jest' || caller.name === 'jest-expo'
  );

  api.cache.using(() => (isJest ? 'jest' : 'metro'));

  return {
    presets: [
      [
        'babel-preset-expo',
        { jsxImportSource: isJest ? 'react' : 'nativewind' },
      ],
      ...(isJest ? [] : ['nativewind/babel']),
    ],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            '@shared': path.resolve(__dirname, '../../packages/shared/src'),
          },
        },
      ],
    ],
  };
};
