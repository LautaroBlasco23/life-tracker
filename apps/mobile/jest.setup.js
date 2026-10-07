// jest.setup.js — mocks for modules with no JS bridge under the test runner.
// (babel.config.js compiles jest runs with the plain react JSX runtime, so
// no NativeWind interop mock is needed here; className is inert in tests.)

// lucide-react-native renders through react-native-svg, whose native module
// has no jest bridge. Stub every export as an inert component — unit tests
// assert behaviour, not icon rendering.
jest.mock('react-native-svg', () => {
  return new Proxy(
    {},
    {
      get: (_target, name) => {
        if (name === '__esModule') return false;
        const Stub = () => null;
        Stub.displayName = String(name);
        return Stub;
      },
    }
  );
});

// lucide-react-native ships untransformed ESM (dist/esm/*.mjs) which jest
// cannot parse without a transformer; icons are stubbed like react-native-svg.
jest.mock('lucide-react-native', () => {
  return new Proxy(
    {},
    {
      get: (_target, name) => {
        if (name === '__esModule') return false;
        const Stub = () => null;
        Stub.displayName = String(name);
        return Stub;
      },
    }
  );
});

jest.mock('react-native/Libraries/Animated/Animated', () =>
  require('react-native/Libraries/Animated/AnimatedMock')
);
