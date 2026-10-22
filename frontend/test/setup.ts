import '@testing-library/jest-dom/vitest';

declare global {
  interface Window {
    __systemPrefersDark?: boolean;
    __matchMediaListeners?: Set<() => void>;
  }
}

// jsdom doesn't implement matchMedia; stub it so matchMedia consumers
// (ThemeProvider system-preference resolution, use-mobile) work in tests.
// Tests control the system scheme via window.__systemPrefersDark and can
// broadcast changes through window.__matchMediaListeners.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches:
        query === '(prefers-color-scheme: dark)' &&
        window.__systemPrefersDark === true,
      media: query,
      onchange: null,
      addEventListener: (_: string, cb: () => void) => {
        (window.__matchMediaListeners ??= new Set()).add(cb);
      },
      removeEventListener: (_: string, cb: () => void) => {
        window.__matchMediaListeners?.delete(cb);
      },
    }),
  });
}

// Web env is runtime-injected via /env-config.js in production; in tests the
// window exists but __ENV__ is absent, which mirrors a first-load browser.
