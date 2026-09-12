/**
 * `server-only` throws when it is imported outside a React Server Component,
 * which is exactly right in the app and exactly wrong in a unit test. Vitest
 * aliases the package to this empty module so the server modules can be
 * tested directly.
 */
export {};
