/** Small id helper. Uses crypto.randomUUID when available, falls back otherwise
 *  (e.g. non-secure contexts, old test runners). */
export function newId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
