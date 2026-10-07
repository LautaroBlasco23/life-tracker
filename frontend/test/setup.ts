import '@testing-library/jest-dom/vitest';

// Web env is runtime-injected via /env-config.js in production; in tests the
// window exists but __ENV__ is absent, which mirrors a first-load browser.
