import '@testing-library/jest-dom/vitest';

// jsdom lacks these; provide harmless stubs so modules that touch them at import
// time don't explode during unit tests.
if (!('matchMedia' in window)) {
  // @ts-expect-error test stub
  window.matchMedia = () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  });
}

if (!('randomUUID' in crypto)) {
  // @ts-expect-error test stub
  crypto.randomUUID = () => 'test-' + Math.random().toString(36).slice(2);
}
